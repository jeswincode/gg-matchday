import express from "express";
import mongoose from "mongoose";
import { randomInt, randomUUID } from "node:crypto";
import { normalizeChallengeInput, simulateChallengeRun } from "../../shared/trainingChallengeEngine.js";
import { requireAuth, requireOriginalGGAccess } from "../middleware/auth.js";
import { createPublicWorldMapProjection } from "../services/worldMapProjection.js";
import { isVerifiedGmailAddress } from "../services/worldAccessPolicy.js";
import { getClubsConnection } from "../config/clubsDatabase.js";
import Player from "../models/Player.js";
import User from "../models/User.js";
import ResidenceTransfer from "../models/clubs/ResidenceTransfer.js";
import Club from "../models/clubs/Club.js";
import ClubGround from "../models/clubs/ClubGround.js";
import ClubWalletTransaction from "../models/clubs/ClubWalletTransaction.js";
import WorldMessage from "../models/clubs/WorldMessage.js";
import WorldMessageReport from "../models/clubs/WorldMessageReport.js";
import WorldInteraction from "../models/clubs/WorldInteraction.js";
import WorldSocialRateLimit from "../models/clubs/WorldSocialRateLimit.js";
import { debitClubWallet } from "../services/clubsEconomy.js";
import { attachWorldStream, publishWorldEvent } from "../services/worldRealtime.js";
import PlayerResidence from "../models/clubs/PlayerResidence.js";
import WorldMap from "../models/clubs/WorldMap.js";
import PlayerAvatar from "../models/clubs/PlayerAvatar.js";
import TrainingProfile from "../models/clubs/TrainingProfile.js";
import TrainingSession from "../models/clubs/TrainingSession.js";
import WorldPresence from "../models/clubs/WorldPresence.js";
import TrainingChallengeRun from "../models/clubs/TrainingChallengeRun.js";
import TrainingChallengeProfile from "../models/clubs/TrainingChallengeProfile.js";
import WorldEconomy from "../models/clubs/WorldEconomy.js";
import { grantWorldReward, unlockTrainingAchievements } from "../services/worldProgression.js";
import { trainingRewardForSession, levelProgress } from "../config/worldProgression.js";
import WorldInventoryItem from "../models/clubs/WorldInventoryItem.js";
import { WORLD_COSMETIC_CATALOG } from "../../shared/worldCustomization.js";
import { FREE_AVATAR_OPTIONS } from "../../shared/worldAvatarOptions.js";
import {
  DEFAULT_WORLD_LAYOUT,
  WORLD_MAP_SLUG,
  normalizeAvatarPayload,
  normalizePresencePayload,
  normalizeTrainingSession,
} from "../config/ggWorldRules.js";

const router = express.Router();

// Public map discovery is a static projection only. It never returns accounts,
// private homes, player presence, avatar appearances, interiors or activities.
router.get("/public-map", (req, res) => res.json(createPublicWorldMapProjection(DEFAULT_WORLD_LAYOUT)));

router.use(requireAuth, requireOriginalGGAccess);

function ensureClubsDatabase(res) {
  if (getClubsConnection().readyState === 1) return true;
  res.status(503).json({ message: "Original GG is temporarily unavailable because the Clubs database is disconnected." });
  return false;
}

function linkedPlayerId(req, res) {
  const id = req.user?.playerProfile;
  if (!id || !mongoose.isValidObjectId(id)) {
    res.status(403).json({ message: "Link your GG player profile to create a character and save world progress." });
    return null;
  }
  return id;
}

async function getWorldMap() {
  const existing = await WorldMap.findOne({ slug: WORLD_MAP_SLUG }).lean();
  if (!existing) {
    return WorldMap.findOneAndUpdate(
      { slug: WORLD_MAP_SLUG },
      {
        $setOnInsert: {
          slug: WORLD_MAP_SLUG,
          title: "Original GG",
          version: DEFAULT_WORLD_LAYOUT.version,
          layout: structuredClone(DEFAULT_WORLD_LAYOUT),
          active: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  }
  if ((existing.version || 1) < DEFAULT_WORLD_LAYOUT.version) {
    const existingLocations = new Map((existing.layout?.locations || []).map((location) => [location.id, location]));
    const locations = DEFAULT_WORLD_LAYOUT.locations.map((defaults) => {
      const saved = existingLocations.get(defaults.id);
      return saved ? { ...defaults, ...saved, description: defaults.description || saved.description, interior: defaults.id === "market-square" ? defaults.interior : saved.interior || defaults.interior } : defaults;
    });
    const savedDistricts = new Map((existing.layout?.districts || []).map((district) => [district.id, district]));
    const districts = DEFAULT_WORLD_LAYOUT.districts.map((defaults) => ({
      ...defaults,
      ...(savedDistricts.get(defaults.id) || {}),
      label: defaults.label,
      tone: defaults.tone,
    }));
    const defaultDistrictIds = new Set(DEFAULT_WORLD_LAYOUT.districts.map((district) => district.id));
    for (const district of existing.layout?.districts || []) if (!defaultDistrictIds.has(district.id)) districts.push(district);
    const savedPlots = new Map((existing.layout?.plots || []).map((plot) => [plot.id, plot]));
    const plots = DEFAULT_WORLD_LAYOUT.plots.map((defaults) => {
      const saved = savedPlots.get(defaults.id);
      return saved ? { ...defaults, ...saved } : defaults;
    });
    const defaultPlotIds = new Set(DEFAULT_WORLD_LAYOUT.plots.map((plot) => plot.id));
    for (const plot of existing.layout?.plots || []) if (!defaultPlotIds.has(plot.id)) plots.push(plot);
    const layout = {
      ...structuredClone(DEFAULT_WORLD_LAYOUT),
      ...(existing.layout || {}),
      layers: existing.layout?.layers?.length ? existing.layout.layers : DEFAULT_WORLD_LAYOUT.layers,
      districts,
      locations,
      plots,
    };
    return WorldMap.findOneAndUpdate(
      { slug: WORLD_MAP_SLUG },
      { $set: { version: DEFAULT_WORLD_LAYOUT.version, layout } },
      { new: true, runValidators: true },
    ).lean();
  }
  return existing;
}

function residencePosition(playerId) {
  const seed = Number.parseInt(String(playerId).slice(-6), 16) || 0;
  const slot = seed % 16;
  return { x: 1010 + (slot % 4) * 145, y: 955 + Math.floor(slot / 4) * 62 };
}

async function assertOwnedAvatarAppearance(playerId, appearance) {
  const inventory = await WorldInventoryItem.find({ playerId, quantity: { $gt: 0 } }).select("itemId").lean();
  const ownedIds = new Set(inventory.map((item) => item.itemId));
  for (const [field, value] of Object.entries(appearance || {})) {
    if (FREE_AVATAR_OPTIONS[field]?.includes(value)) continue;
    const unlock = WORLD_COSMETIC_CATALOG.find((item) => item.appearancePatch?.[field] === value);
    if (!unlock || !ownedIds.has(unlock.id)) {
      const error = new Error("Unlock "+String(value).replaceAll("-", " ")+" in the GG Market before equipping it.");
      error.status = 403;
      throw error;
    }
  }
}

function publicAvatar(avatar, playerName = "GG Player") {
  if (!avatar) {
    return {
      displayName: playerName,
      appearance: { skinTone: "medium", bodyType: "athletic", hairStyle: "short", hairColor: "black", kitPrimary: "black", kitSecondary: "gold", bootColor: "white", headAccessory: "none" },
      tutorialComplete: false,
    };
  }
  return {
    displayName: avatar.displayName || playerName,
    appearance: avatar.appearance,
    tutorialComplete: avatar.tutorialComplete === true,
  };
}

router.get("/bootstrap", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const playerId = req.user?.playerProfile || null;
    const [world, clubs] = await Promise.all([
      getWorldMap(),
      Club.find({ status: "approved" }).select("name logoUrl memberIds captainIds").sort({ nameNormalized: 1 }).lean(),
    ]);
    const clubGrounds = await Promise.all(clubs.map((club, index) => ClubGround.findOneAndUpdate(
      { clubId: club._id },
      { $setOnInsert: {
        clubId: club._id,
        name: club.name + " Ground",
        x: 220 + (index % 4) * 250,
        y: 1010 + Math.floor(index / 4) * 90,
        level: 1,
        accessPolicy: "public-exterior-private-interior",
        layout: {
          rooms: [
            { id: "clubhouse", name: "Clubhouse", description: "The meeting point for club members and supporters.", theme: "clubhouse", items: ["club-banner", "meeting-table", "member-board"] },
            { id: "club-trophy-room", name: "Trophy Room", description: "A place to display club achievements and memorable seasons.", theme: "gold", items: ["trophy-cabinet", "medal-wall", "season-records"] },
            { id: "tactics-room", name: "Tactics Room", description: "Plan line-ups, formations and the next big club challenge.", theme: "dark-wood", items: ["tactics-board", "formation-screen", "team-sheet"] },
            { id: "locker-room", name: "Locker Room", description: "A changing space for the players who represent this club.", theme: "training", items: ["player-lockers", "kit-rack", "club-colours"] },
          ],
        },
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean()));
    let avatar = null;
    let training = null;
    let trainingHistory = [];
    let residence = null;
    if (playerId) {
      const [player, savedAvatar, savedTraining, savedSessions] = await Promise.all([
        Player.findById(playerId).select("name").lean(),
        PlayerAvatar.findOne({ playerId }).lean(),
        TrainingProfile.findOne({ playerId }).lean(),
        TrainingSession.find({ playerId }).sort({ recordedAt: -1 }).limit(5).lean(),
      ]);
      avatar = publicAvatar(savedAvatar, player?.name || req.user?.name || "GG Player");
      const position = residencePosition(playerId);
      residence = await PlayerResidence.findOneAndUpdate(
        { ownerPlayerId: playerId },
        { $setOnInsert: {
          ownerPlayerId: playerId,
          name: (player?.name || req.user?.name || "GG Player") + "'s Home",
          ...position,
          level: 1,
          privacy: "private",
          interior: {
            rooms: [
              { id: "lounge", name: "Player Lounge", theme: "clubhouse", items: ["sofa", "coffee-table", "team-banner"] },
              { id: "trophy-room", name: "Trophy Room", theme: "gold", items: ["trophy-cabinet", "medal-wall", "match-ball-display"] },
              { id: "training-corner", name: "Training Corner", theme: "training", items: ["exercise-mat", "weights", "record-board"] },
            ],
          },
        } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
      trainingHistory = savedSessions;
      training = savedTraining || {
        totals: { pushups: 0, pullups: 0, squats: 0, planks: 0, totalCounts: 0, sessions: 0 },
        personalBests: { pushups: 0, pullups: 0, squats: 0, planks: 0 },
        lastWorkoutAt: null,
      };
    }
    const activePresence = await WorldPresence.find({ lastSeenAt: { $gte: new Date(Date.now() - 45000) } })
      .select("playerId displayName locationId x y direction lastSeenAt")
      .limit(100)
      .lean();
    const presenceIds = activePresence.map((item) => item.playerId);
    const avatars = await PlayerAvatar.find({ playerId: { $in: presenceIds } }).select("playerId appearance").lean();
    const residenceFilter = playerId
      ? { $or: [{ privacy: "public" }, { ownerPlayerId: playerId }, { visitorPlayerIds: playerId }] }
      : { privacy: "public" };
    const activeResidences = await PlayerResidence.find(residenceFilter)
      .select("ownerPlayerId name x y level privacy")
      .sort({ updatedAt: -1 })
      .limit(120)
      .lean();
    const appearanceByPlayer = new Map(avatars.map((item) => [String(item.playerId), item.appearance]));
    const privateLayout = { ...(world.layout || {}) };
    delete privateLayout.plots; // Keep legacy records stored, but never expose plot/claim data.
    return res.json({
      world: { slug: world.slug, title: world.title, version: world.version, layout: privateLayout },
      playerId: playerId ? String(playerId) : null,
      clubs: clubs.map((club) => ({ id: String(club._id), name: club.name, logoUrl: club.logoUrl, memberCount: club.memberIds?.length || 0 })),
      clubGrounds: clubGrounds.map((ground) => { const club = clubs.find((item) => String(item._id) === String(ground.clubId)); return { id: "ground-" + String(ground.clubId), clubId: String(ground.clubId), name: ground.name, kind: "club-ground", x: ground.x, y: ground.y, level: ground.level, accessPolicy: ground.accessPolicy, interiorAccess: ground.interiorAccess || "members", isCaptain: Boolean(playerId && (club?.captainIds || []).some((id) => String(id) === String(playerId))) }; }),
      canCreateCharacter: Boolean(playerId),
      residence: residence ? { ownerPlayerId: String(residence.ownerPlayerId), name: residence.name, x: residence.x, y: residence.y, level: residence.level, privacy: residence.privacy } : null,
      residences: activeResidences.map((home) => ({ ownerPlayerId: String(home.ownerPlayerId), name: home.name, x: home.x, y: home.y, level: home.level, privacy: home.privacy })),
      avatar,
      training,
      trainingHistory,
      presence: activePresence.map((item) => ({
        playerId: String(item.playerId),
        displayName: item.displayName,
        locationId: item.locationId,
        x: item.x,
        y: item.y,
        direction: item.direction || "down",
        appearance: appearanceByPlayer.get(String(item.playerId)) || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/tutorial/complete", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  const session = await getClubsConnection().startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const existingAvatar = await PlayerAvatar.findOne({ playerId }).session(session);
      if (existingAvatar?.tutorialComplete) {
        result = { success: true, duplicate: true, reward: null };
        return;
      }
      if (!existingAvatar) {
        await PlayerAvatar.create([{
          playerId, displayName: String(req.user?.name || "GG Player").slice(0, 24),
          tutorialComplete: true,
        }], { session });
      } else {
        existingAvatar.tutorialComplete = true;
        await existingAvatar.save({ session });
      }
      const reward = await grantWorldReward({
        playerId, sourceKey: "tutorial:original-gg-v1", sourceType: "tutorial",
        xp: 40, coins: 20, metadata: { reason: "Completed the Original GG welcome tour" }, session,
      });
      result = { success: true, duplicate: reward.duplicate, reward };
    });
    return res.json(result);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  } finally {
    await session.endSession();
  }
});

router.put("/avatar", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  try {
    const payload = normalizeAvatarPayload(req.body);
    await assertOwnedAvatarAppearance(playerId, payload.appearance);
    const avatar = await PlayerAvatar.findOneAndUpdate(
      { playerId },
      { $set: payload },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json({ success: true, avatar: publicAvatar(avatar, req.user?.name) });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ message: error.message });
    return next(error);
  }
});

router.get("/avatar/presets", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  try {
    const avatar = await PlayerAvatar.findOne({ playerId }).select("presets").lean();
    return res.json({ presets: avatar?.presets || [], limit: 5 });
  } catch (error) { return next(error); }
});

router.post("/avatar/presets", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  const name = String(req.body?.name || "").trim().replace(/\\s+/g, " ").slice(0, 24);
  if (!name) return res.status(400).json({ message: "Give this character preset a name." });
  try {
    const payload = normalizeAvatarPayload({ appearance: req.body?.appearance });
    await assertOwnedAvatarAppearance(playerId, payload.appearance);
    let avatar = await PlayerAvatar.findOne({ playerId });
    if (!avatar) avatar = new PlayerAvatar({ playerId });
    if (avatar.presets.length >= 5) return res.status(409).json({ message: "You can save up to five character presets." });
    avatar.presets.push({ name, appearance: payload.appearance });
    await avatar.save();
    return res.status(201).json({ presets: avatar.presets, limit: 5 });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error instanceof TypeError) return res.status(400).json({ message: error.message });
    return next(error);
  }
});

router.post("/avatar/presets/:presetId/apply", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.presetId)) return res.status(400).json({ message: "Invalid character preset." });
  try {
    const avatar = await PlayerAvatar.findOne({ playerId });
    const preset = avatar?.presets.id(req.params.presetId);
    if (!avatar || !preset) return res.status(404).json({ message: "Character preset not found." });
    const presetAppearance = preset.appearance.toObject();
    await assertOwnedAvatarAppearance(playerId, presetAppearance);
    avatar.appearance = presetAppearance;
    await avatar.save();
    return res.json({ success: true, avatar: publicAvatar(avatar.toObject(), req.user?.name) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
});

router.delete("/avatar/presets/:presetId", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.presetId)) return res.status(400).json({ message: "Invalid character preset." });
  try {
    const avatar = await PlayerAvatar.findOne({ playerId });
    if (!avatar) return res.status(404).json({ message: "Character profile not found." });
    avatar.presets = avatar.presets.filter((preset) => String(preset._id) !== req.params.presetId);
    await avatar.save();
    return res.json({ success: true, presets: avatar.presets });
  } catch (error) { return next(error); }
});

router.get("/training", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  try {
    const [profile, sessions] = await Promise.all([
      TrainingProfile.findOne({ playerId }).lean(),
      TrainingSession.find({ playerId }).sort({ recordedAt: -1 }).limit(12).lean(),
    ]);
    return res.json({
      profile: profile || {
        totals: { pushups: 0, pullups: 0, squats: 0, planks: 0, totalReps: 0, sessions: 0 },
        personalBests: { pushups: 0, pullups: 0, squats: 0, planks: 0 },
        lastWorkoutAt: null,
      },
      sessions,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/training/sessions", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  try {
    const payload = normalizeTrainingSession(req.body);
    const connection = getClubsConnection();
    const session = await connection.startSession();
    let result = null;
    try {
      await session.withTransaction(async () => {
        const existing = await TrainingSession.findOne({ sessionId: payload.sessionId }).session(session).lean();
        if (existing) {
          if (String(existing.playerId) !== String(playerId)) {
            const conflict = new Error("This workout session ID has already been used.");
            conflict.status = 409;
            throw conflict;
          }
          const profile = await TrainingProfile.findOne({ playerId }).session(session).lean();
          result = { session: existing, profile, duplicate: true };
          return;
        }
        const recordedAt = new Date();
        const [saved] = await TrainingSession.create([{
          ...payload,
          playerId,
          recordedAt,
        }], { session });
        const increment = {
          "totals.pushups": payload.counts.pushups,
          "totals.pullups": payload.counts.pullups,
          "totals.squats": payload.counts.squats,
          "totals.planks": payload.counts.planks,
          "totals.totalCounts": payload.totalCounts,
          "totals.sessions": 1,
        };
        const maximum = Object.fromEntries(Object.entries(payload.counts).map(([key, value]) => [`personalBests.${key}`, value]));
        const profile = await TrainingProfile.findOneAndUpdate(
          { playerId },
          { $inc: increment, $max: maximum, $set: { lastWorkoutAt: recordedAt } },
          { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, session },
        ).lean();
        const rewardAmounts = trainingRewardForSession(payload);
        const reward = await grantWorldReward({
          playerId,
          sourceKey: "training:" + payload.sessionId,
          sourceType: "training-session",
          xp: rewardAmounts.xp,
          coins: rewardAmounts.coins,
          metadata: { sessionId: payload.sessionId, totalCounts: payload.totalCounts, durationSeconds: payload.durationSeconds },
          session,
        });
        const achievements = await unlockTrainingAchievements(playerId, profile, session);
        const economy = await WorldEconomy.findOne({ playerId }).session(session).lean();
        result = { session: saved.toObject(), profile, duplicate: false, reward, achievements, economy: economy ? { ...economy, ...levelProgress(economy.xp) } : null };
      });
    } finally {
      await session.endSession();
    }
    return res.status(result?.duplicate ? 200 : 201).json({ success: true, ...result });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ message: error.message });
    if (error?.code === 11000) return res.status(409).json({ message: "This workout session has already been recorded." });
    return next(error);
  }
});

router.post("/training/challenges/start", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  try {
    const now = new Date();
    const recentAttempts = await TrainingChallengeRun.countDocuments({ playerId, challengeId: "ball-control-v2", startedAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) } });
    if (recentAttempts >= 30) return res.status(429).json({ message: "You have reached the hourly challenge limit. Try again later." });
    const seed = randomInt(1, 0x7fffffff);
    const run = await TrainingChallengeRun.create({
      runId: randomUUID(),
      playerId,
      challengeId: "ball-control-v2",
      seed,
      inputEvents: [],
      startedAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    });
    return res.status(201).json({ success: true, runId: run.runId, seed: run.seed, startedAt: run.startedAt, expiresAt: run.expiresAt });
  } catch (error) {
    return next(error);
  }
});

router.post("/training/challenges/:runId/input", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  const runId = String(req.params.runId || "").trim();
  const seq = Number(req.body?.seq);
  if (!runId || runId.length > 80 || !Number.isInteger(seq) || seq < 1 || seq > 400) {
    return res.status(400).json({ message: "Invalid training input sequence." });
  }
  const direction = normalizeChallengeInput(req.body?.direction);
  try {
    const session = await getClubsConnection().startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const run = await TrainingChallengeRun.findOne({
          runId, playerId, challengeId: "ball-control-v2",
          completedAt: null, expiresAt: { $gt: now },
        }).session(session);
        if (!run) {
          const error = new Error("This challenge run is no longer accepting inputs.");
          error.status = 409; throw error;
        }
        const expected = run.inputEvents.length + 1;
        if (seq !== expected) {
          const error = new Error("Training input arrived out of order. Restart the run to keep the replay in sync.");
          error.status = 409; throw error;
        }
        if (run.inputEvents.length >= 400) {
          const error = new Error("This run has reached its input-event limit.");
          error.status = 429; throw error;
        }
        run.inputEvents.push({ seq, direction, receivedAt: now });
        await run.save({ session });
        result = { success: true, seq };
      });
      return res.json(result);
    } finally { await session.endSession(); }
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
});

router.post("/training/challenges/finish", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  const runId = String(req.body?.runId || "").trim();
  if (!runId || runId.length > 80) return res.status(400).json({ message: "A valid training run is required." });
  const session = await getClubsConnection().startSession();
  let profile = null;
  let verifiedScore = 0;
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const run = await TrainingChallengeRun.findOne({
        runId,
        playerId,
        challengeId: "ball-control-v2",
        completedAt: null,
        expiresAt: { $gt: now },
      }).session(session);
      if (!run) {
        const conflict = new Error("This training run is expired or has already been submitted.");
        conflict.status = 409;
        throw conflict;
      }
      if (!run.seed || run.inputEvents.length > 400) {
        const invalid = new Error("This run is missing a valid challenge replay.");
        invalid.status = 400;
        throw invalid;
      }
      const replay = simulateChallengeRun(run.seed, run.inputEvents, run.startedAt, now, { graceMs: 300 });
      if (!replay.collided || !Number.isFinite(replay.scoreSeconds) || replay.scoreSeconds < 0.4 || replay.scoreSeconds > 600) {
        const invalid = new Error("The server replay did not verify a completed collision. Keep playing until full time, then try again.");
        invalid.status = 400;
        throw invalid;
      }
      verifiedScore = Number(replay.scoreSeconds.toFixed(1));
      run.completedAt = now;
      run.scoreSeconds = verifiedScore;
      await run.save({ session });
      profile = await TrainingChallengeProfile.findOneAndUpdate(
        { playerId, challengeId: "ball-control-v2" },
        { $min: { bestSeconds: verifiedScore }, $inc: { attempts: 1 }, $set: { lastPlayedAt: now } },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, session },
      ).lean();
    });
    return res.status(201).json({ success: true, verifiedScore, bestSeconds: profile.bestSeconds, attempts: profile.attempts });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "This training run has already been submitted." });
    if (error?.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  } finally {
    await session.endSession();
  }
});

router.get("/training/challenges/leaderboard", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const playerId = linkedPlayerId(req, res);
    if (!playerId) return;
    const [personal, rows] = await Promise.all([
      TrainingChallengeProfile.findOne({ playerId, challengeId: "ball-control-v2" }).select("bestSeconds attempts").lean(),
      TrainingChallengeProfile.find({ challengeId: "ball-control-v2" })
      .sort({ bestSeconds: 1, lastPlayedAt: 1 })
      .limit(10)
      .select("playerId bestSeconds attempts lastPlayedAt")
      .lean(),
    ]);
    const ids = rows.map((row) => row.playerId);
    const [avatars, players] = await Promise.all([
      PlayerAvatar.find({ playerId: { $in: ids } }).select("playerId displayName").lean(),
      Player.find({ _id: { $in: ids } }).select("name").lean(),
    ]);
    const names = new Map(players.map((player) => [String(player._id), player.name]));
    const displayNames = new Map(avatars.map((avatar) => [String(avatar.playerId), avatar.displayName]));
    return res.json({ personalBestSeconds: personal?.bestSeconds || 0, attempts: personal?.attempts || 0, leaderboard: rows.map((row, index) => ({
      rank: index + 1,
      playerId: String(row.playerId),
      displayName: displayNames.get(String(row.playerId)) || names.get(String(row.playerId)) || "GG Player",
      bestSeconds: row.bestSeconds,
      attempts: row.attempts,
    })) });
  } catch (error) {
    return next(error);
  }
});

router.get("/club-grounds/:clubId/interior", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.clubId)) return res.status(400).json({ message: "Invalid club ground." });
  try {
    const [club, ground] = await Promise.all([
      Club.findById(req.params.clubId).select("memberIds captainIds").lean(),
      ClubGround.findOne({ clubId: req.params.clubId }).lean(),
    ]);
    if (!club || !ground) return res.status(404).json({ message: "This club ground is not available." });
    const isMember = (club.memberIds || []).some((memberId) => String(memberId) === String(playerId));
    const isCaptain = (club.captainIds || []).some((captainId) => String(captainId) === String(playerId));
    const isAdmin = req.user?.role === "admin";
    if (!isMember && ground.interiorAccess !== "public" && !isAdmin) return res.status(403).json({ message: "This club ground is for club members." });
    return res.json({
      interior: {
        type: "club",
        name: ground.name,
        level: ground.level,
        interior: ground.layout || { rooms: [] },
        permissions: { isMember, isCaptain: isCaptain || isAdmin, interiorAccess: ground.interiorAccess || "members" },
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/interiors/:locationId", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const world = await WorldMap.findOne({ slug: WORLD_MAP_SLUG }).lean();
    const location = world?.layout?.locations?.find((item) => item.id === req.params.locationId);
    if (!location || !location.interior) return res.status(404).json({ message: "This building interior is not available yet." });
    return res.json({ interior: { type: "public", name: location.name, level: 1, interior: location.interior } });
  } catch (error) {
    return next(error);
  }
});

router.get("/residences/:playerId", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const viewerPlayerId = linkedPlayerId(req, res);
  if (!viewerPlayerId) return;
  if (!mongoose.isValidObjectId(req.params.playerId)) return res.status(400).json({ message: "Invalid residence owner." });
  try {
    const residence = await PlayerResidence.findOne({ ownerPlayerId: req.params.playerId }).lean();
    if (!residence) return res.status(404).json({ message: "This residence has not been created yet." });
    const isOwner = String(residence.ownerPlayerId) === String(viewerPlayerId);
    const isVisitor = (residence.visitorPlayerIds || []).some((id) => String(id) === String(viewerPlayerId));
    if (!isOwner && residence.privacy !== "public" && !(residence.privacy === "friends" && isVisitor)) {
      return res.status(403).json({ message: "This player's home interior is private." });
    }
    return res.json({
      residence: {
        ownerPlayerId: String(residence.ownerPlayerId),
        name: residence.name,
        level: residence.level,
        interior: residence.interior,
        ...(isOwner ? { access: { privacy: residence.privacy, visitorPlayerIds: (residence.visitorPlayerIds || []).map(String) } } : {}),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/presence", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  try {
    const position = normalizePresencePayload(req.body);
    const [player, avatar] = await Promise.all([
      Player.findById(playerId).select("name").lean(),
      PlayerAvatar.findOne({ playerId }).select("displayName appearance").lean(),
    ]);
    const presence = await WorldPresence.findOneAndUpdate(
      { playerId },
      { $set: { ...position, displayName: avatar?.displayName || player?.name || "GG Player", lastSeenAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();
    const payload = { playerId: String(playerId), displayName: presence.displayName, locationId: presence.locationId, x: presence.x, y: presence.y, direction: presence.direction || position.direction, appearance: avatar?.appearance || null };
    publishWorldEvent("presence:update", payload, { locationId: "world", exceptPlayerId: playerId });
    return res.json({ success: true, presence: payload });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ message: error.message });
    return next(error);
  }
});

router.get("/presence", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const presence = await WorldPresence.find({ lastSeenAt: { $gte: new Date(Date.now() - 45000) } })
      .select("playerId displayName locationId x y direction lastSeenAt")
      .limit(100)
      .lean();
    const ids = presence.map((item) => item.playerId);
    const avatars = await PlayerAvatar.find({ playerId: { $in: ids } }).select("playerId appearance").lean();
    const appearanceByPlayer = new Map(avatars.map((item) => [String(item.playerId), item.appearance]));
    return res.json({
      presence: presence.map((item) => ({
        playerId: String(item.playerId),
        displayName: item.displayName,
        locationId: item.locationId,
        x: item.x,
        y: item.y,
        direction: item.direction || "down",
        appearance: appearanceByPlayer.get(String(item.playerId)) || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});


// One authenticated event stream carries movement, chat and character interactions.
// The stream is process-local; a shared pub/sub adapter can be added before horizontal API scaling.
router.get("/stream", async (req, res) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  const locationId = String(req.query.locationId || "world").trim();
  if (!/^[a-z0-9-]{1,64}$/i.test(locationId)) return res.status(400).json({ message: "Invalid world stream location." });
  const cleanup = attachWorldStream({ response: res, playerId, locationId });
  if (!cleanup) return res.status(429).json({ message: "Too many active world connections." });
});

router.get("/residences/me/access", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  try {
    const home = await PlayerResidence.findOne({ ownerPlayerId: playerId }).select("name privacy visitorPlayerIds").lean();
    if (!home) return res.status(404).json({ message: "Your residence has not been created yet." });
    const ids = home.visitorPlayerIds || [];
    const [players, avatars] = await Promise.all([
      Player.find({ _id: { $in: ids } }).select("name").lean(),
      PlayerAvatar.find({ playerId: { $in: ids } }).select("playerId displayName").lean(),
    ]);
    const names = new Map(players.map((item) => [String(item._id), item.name]));
    const displayNames = new Map(avatars.map((item) => [String(item.playerId), item.displayName]));
    return res.json({
      residence: { name: home.name, privacy: home.privacy || "private" },
      visitors: ids.map((id) => ({ playerId: String(id), displayName: displayNames.get(String(id)) || names.get(String(id)) || "GG Player" })),
    });
  } catch (error) { return next(error); }
});

router.get("/residence-directory/players", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  const search = String(req.query.search || "").trim().replace(/[^a-zA-Z0-9 _.'-]/g, "").slice(0, 32);
  if (search.length < 2) return res.json({ players: [] });
  try {
    const escaped = [...search].map(char => ".*+?^${}()|[]".includes(char) || char === String.fromCharCode(92) ? String.fromCharCode(92) + char : char).join("");
    const players = await Player.find({ _id: { $ne: playerId }, name: { $regex: escaped, $options: "i" } }).select("name").limit(12).lean();
    const ids = players.map((item) => item._id);
    const [avatars, linkedAccounts] = await Promise.all([
      PlayerAvatar.find({ playerId: { $in: ids } }).select("playerId displayName").lean(),
      User.find({ playerProfile: { $in: ids }, emailVerified: true }).select("playerProfile email emailVerified").lean(),
    ]);
    const displayNames = new Map(avatars.map((item) => [String(item.playerId), item.displayName]));
    const eligiblePlayerIds = new Set(linkedAccounts
      .filter((account) => isVerifiedGmailAddress(account.email, account.emailVerified))
      .map((account) => String(account.playerProfile)));
    return res.json({
      players: players
        .filter((item) => eligiblePlayerIds.has(String(item._id)))
        .map((item) => ({ playerId: String(item._id), displayName: displayNames.get(String(item._id)) || item.name })),
    });
  } catch (error) { return next(error); }
});

router.patch("/residences/me/access", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  const privacy = String(req.body?.privacy || "");
  if (!["private", "friends", "public"].includes(privacy)) return res.status(400).json({ message: "Choose private, visitors or public access." });
  const rawVisitors = Array.isArray(req.body?.visitorPlayerIds) ? req.body.visitorPlayerIds : [];
  const unique = [...new Set(rawVisitors.map((id) => String(id).trim()))];
  if (unique.length > 30 || unique.some((id) => !mongoose.isValidObjectId(id) || id === String(playerId))) {
    return res.status(400).json({ message: "Choose up to 30 valid visitors, excluding your own player." });
  }
  try {
    const existing = await PlayerResidence.findOne({ ownerPlayerId: playerId }).select("_id").lean();
    if (!existing) return res.status(404).json({ message: "Your residence has not been created yet." });
    const count = unique.length ? await Player.countDocuments({ _id: { $in: unique } }) : 0;
    if (count !== unique.length) return res.status(400).json({ message: "One or more selected visitors are no longer available." });
    const home = await PlayerResidence.findOneAndUpdate(
      { ownerPlayerId: playerId },
      { $set: { privacy, visitorPlayerIds: unique } },
      { new: true, runValidators: true },
    ).select("name privacy visitorPlayerIds").lean();
    return res.json({ success: true, residence: { name: home.name, privacy: home.privacy, visitorPlayerIds: (home.visitorPlayerIds || []).map(String) } });
  } catch (error) { return next(error); }
});


function isReplaceableStarterResidence(home, expectedName = "") {
  if (!home) return true;
  if (
    Number(home.level || 1) > 1 ||
    Number(home.furnishingVersion || 1) > 1 ||
    (expectedName && home.name !== expectedName) ||
    (home.plotId && String(home.plotId).trim()) ||
    (home.privacy || "private") !== "private" ||
    (Array.isArray(home.visitorPlayerIds) && home.visitorPlayerIds.length > 0)
  ) return false;
  const rooms = Array.isArray(home.interior?.rooms) ? home.interior.rooms : [];
  return rooms.every((room) => !Array.isArray(room.furniture) || room.furniture.length === 0);
}

router.get("/residences/me/transfers", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  try {
    const now = new Date();
    await ResidenceTransfer.updateMany(
      {
        $or: [{ fromPlayerId: playerId }, { toPlayerId: playerId }],
        status: "pending",
        expiresAt: { $lte: now },
      },
      { $set: { status: "expired", respondedAt: now } },
    );
    const transfers = await ResidenceTransfer.find({
      $or: [{ fromPlayerId: playerId }, { toPlayerId: playerId }],
    }).sort({ createdAt: -1 }).limit(30).lean();
    const otherIds = [...new Set(transfers.map((item) =>
      String(item.fromPlayerId) === String(playerId) ? String(item.toPlayerId) : String(item.fromPlayerId)
    ))].map((id) => new mongoose.Types.ObjectId(id));
    const [players, avatars] = await Promise.all([
      Player.find({ _id: { $in: otherIds } }).select("name").lean(),
      PlayerAvatar.find({ playerId: { $in: otherIds } }).select("playerId displayName").lean(),
    ]);
    const names = new Map(players.map((item) => [String(item._id), item.name]));
    const displayNames = new Map(avatars.map((item) => [String(item.playerId), item.displayName]));
    return res.json({
      transfers: transfers.map((item) => {
        const incoming = String(item.toPlayerId) === String(playerId);
        const otherId = incoming ? String(item.fromPlayerId) : String(item.toPlayerId);
        return {
          id: String(item._id),
          role: incoming ? "incoming" : "outgoing",
          otherPlayerId: otherId,
          otherPlayerName: displayNames.get(otherId) || names.get(otherId) || "GG Player",
          status: item.status,
          createdAt: item.createdAt,
          expiresAt: item.expiresAt,
          respondedAt: item.respondedAt || null,
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/residences/me/transfers", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const fromPlayerId = linkedPlayerId(req, res);
  if (!fromPlayerId) return;
  const toPlayerId = String(req.body?.toPlayerId || "").trim();
  if (!mongoose.isValidObjectId(toPlayerId) || toPlayerId === String(fromPlayerId)) {
    return res.status(400).json({ message: "Choose another valid player to receive your home." });
  }
  try {
    const [residence, recipient, recipientAccount] = await Promise.all([
      PlayerResidence.findOne({ ownerPlayerId: fromPlayerId }).lean(),
      Player.findById(toPlayerId).select("name").lean(),
      User.findOne({ playerProfile: toPlayerId }).select("email emailVerified").lean(),
    ]);
    if (!residence) return res.status(404).json({ message: "Your residence has not been created yet." });
    if (!recipient) return res.status(404).json({ message: "The selected player is no longer available." });
    if (!recipientAccount || !isVerifiedGmailAddress(recipientAccount.email, recipientAccount.emailVerified)) {
      return res.status(409).json({ message: "Home transfers can only be sent to a player linked to a verified Gmail account." });
    }
    const recipientHome = await PlayerResidence.findOne({ ownerPlayerId: toPlayerId }).lean();
    if (!isReplaceableStarterResidence(recipientHome, recipient.name + "'s Home")) {
      return res.status(409).json({ message: "This player already has a customised or upgraded home. They must keep it; transfers can only replace an untouched starter home." });
    }
    const now = new Date();
    await ResidenceTransfer.updateMany(
      { status: "pending", expiresAt: { $lte: now }, $or: [{ fromPlayerId }, { toPlayerId }] },
      { $set: { status: "expired", respondedAt: now } },
    );
    const pending = await ResidenceTransfer.findOne({
      status: "pending",
      expiresAt: { $gt: now },
      $or: [{ residenceId: residence._id }, { toPlayerId }],
    }).lean();
    if (pending) return res.status(409).json({ message: "This home or recipient already has a pending transfer invitation." });
    const transfer = await ResidenceTransfer.create({
      residenceId: residence._id,
      fromPlayerId,
      toPlayerId,
      status: "pending",
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    });
    return res.status(201).json({
      success: true,
      transfer: {
        id: String(transfer._id),
        toPlayerId,
        recipientName: recipient.name,
        status: transfer.status,
        expiresAt: transfer.expiresAt,
      },
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "A home transfer invitation is already pending." });
    return next(error);
  }
});

router.post("/residences/transfers/:transferId/accept", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.transferId)) return res.status(400).json({ message: "Invalid home transfer invitation." });
  const recipient = await Player.findById(playerId).select("name").lean();
  if (!recipient) return res.status(404).json({ message: "Your GG player profile could not be found." });
  const session = await getClubsConnection().startSession();
  try {
    let result = null;
    await session.withTransaction(async () => {
      const now = new Date();
      const transfer = await ResidenceTransfer.findOne({
        _id: req.params.transferId,
        toPlayerId: playerId,
        status: "pending",
      }).session(session);
      if (!transfer) {
        result = { errorStatus: 404, message: "This home transfer invitation is no longer pending." };
        return;
      }
      if (transfer.expiresAt <= now) {
        transfer.status = "expired";
        transfer.respondedAt = now;
        await transfer.save({ session });
        result = { errorStatus: 410, message: "This home transfer invitation has expired." };
        return;
      }
      const residence = await PlayerResidence.findOne({
        _id: transfer.residenceId,
        ownerPlayerId: transfer.fromPlayerId,
      }).session(session);
      if (!residence) {
        transfer.status = "cancelled";
        transfer.respondedAt = now;
        await transfer.save({ session });
        result = { errorStatus: 409, message: "The current owner no longer owns this home." };
        return;
      }
      const existingHome = await PlayerResidence.findOne({ ownerPlayerId: playerId }).session(session);
      if (!isReplaceableStarterResidence(existingHome?.toObject?.() || existingHome, recipient.name + "'s Home")) {
        result = { errorStatus: 409, message: "Your current home is customised or upgraded and cannot be replaced by this transfer." };
        return;
      }
      if (existingHome) await PlayerResidence.deleteOne({ _id: existingHome._id }).session(session);
      residence.ownerPlayerId = playerId;
      residence.name = (recipient.name || "GG Player") + "'s Home";
      residence.privacy = "private";
      residence.visitorPlayerIds = [];
      await residence.save({ session });
      transfer.status = "accepted";
      transfer.respondedAt = now;
      await transfer.save({ session });
      result = {
        success: true,
        message: "Home ownership transferred. Your previous untouched starter home was replaced.",
        residence: { ownerPlayerId: String(playerId), name: residence.name, level: residence.level },
      };
    });
    if (result?.errorStatus) return res.status(result.errorStatus).json({ message: result.message });
    return res.json(result || { success: true });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "You already own a home. Your current home must be an untouched starter home before accepting this transfer." });
    return next(error);
  } finally {
    await session.endSession();
  }
});

router.post("/residences/transfers/:transferId/decline", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.transferId)) return res.status(400).json({ message: "Invalid home transfer invitation." });
  try {
    const now = new Date();
    const transfer = await ResidenceTransfer.findOneAndUpdate(
      { _id: req.params.transferId, toPlayerId: playerId, status: "pending" },
      { $set: { status: "declined", respondedAt: now } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!transfer) return res.status(404).json({ message: "This home transfer invitation is no longer pending." });
    return res.json({ success: true, status: transfer.status });
  } catch (error) {
    return next(error);
  }
});

router.post("/residences/me/transfers/:transferId/cancel", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.transferId)) return res.status(400).json({ message: "Invalid home transfer invitation." });
  try {
    const now = new Date();
    const transfer = await ResidenceTransfer.findOneAndUpdate(
      { _id: req.params.transferId, fromPlayerId: playerId, status: "pending" },
      { $set: { status: "cancelled", respondedAt: now } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!transfer) return res.status(404).json({ message: "This home transfer invitation is no longer pending." });
    return res.json({ success: true, status: transfer.status });
  } catch (error) {
    return next(error);
  }
});

router.patch("/club-grounds/:clubId/manage", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.clubId)) return res.status(400).json({ message: "Invalid club ground." });
  const name = String(req.body?.name || "").trim();
  const interiorAccess = String(req.body?.interiorAccess || "");
  if (name.length < 2 || name.length > 100) return res.status(400).json({ message: "Ground names must be between 2 and 100 characters." });
  if (!["members", "public"].includes(interiorAccess)) return res.status(400).json({ message: "Choose member-only or public interior access." });
  try {
    const club = await Club.findById(req.params.clubId).select("memberIds captainIds status").lean();
    if (!club || club.status !== "approved") return res.status(404).json({ message: "This approved club is not available." });
    const isCaptain = (club.captainIds || []).some((id) => String(id) === String(playerId));
    const isAdmin = req.user?.role === "admin";
    if (!isCaptain && !isAdmin) return res.status(403).json({ message: "Only club captains can manage this ground." });
    const ground = await ClubGround.findOneAndUpdate(
      { clubId: req.params.clubId },
      { $set: { name, interiorAccess } },
      { new: true, runValidators: true },
    ).lean();
    if (!ground) return res.status(404).json({ message: "Club ground not found." });
    return res.json({ success: true, ground: { name: ground.name, level: ground.level, interiorAccess: ground.interiorAccess } });
  } catch (error) { return next(error); }
});

router.post("/club-grounds/:clubId/upgrade", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.clubId)) return res.status(400).json({ message: "Invalid club ground." });
  const requestKey = String(req.body?.idempotencyKey || "").trim();
  if (!/^[a-zA-Z0-9:_-]{12,90}$/.test(requestKey)) return res.status(400).json({ message: "A valid ground upgrade request key is required." });
  const idempotencyKey = "world-ground:" + String(req.params.clubId) + ":" + requestKey;
  const session = await getClubsConnection().startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const prior = await ClubWalletTransaction.findOne({ idempotencyKey }).session(session).lean();
      const [club, ground] = await Promise.all([
        Club.findById(req.params.clubId).select("captainIds status").session(session),
        ClubGround.findOne({ clubId: req.params.clubId }).session(session),
      ]);
      if (!club || !ground || club.status !== "approved") {
        const error = new Error("This club ground is not available.");
        error.status = 404; throw error;
      }
      const isCaptain = (club.captainIds || []).some((id) => String(id) === String(playerId));
      if (!isCaptain && req.user?.role !== "admin") {
        const error = new Error("Only club captains can upgrade this ground.");
        error.status = 403; throw error;
      }
      if (prior) {
        if (prior.type !== "expense" || !String(prior.description || "").includes("ground upgrade")) {
          const error = new Error("This upgrade key was already used for another club transaction.");
          error.status = 409; throw error;
        }
        result = { success: true, duplicate: true, level: ground.level };
        return;
      }
      if (ground.level >= 20) {
        const error = new Error("This ground has reached its current level cap.");
        error.status = 409; throw error;
      }
      const nextLevel = ground.level + 1;
      const cost = Math.round(250 * Math.pow(nextLevel, 1.45));
      await debitClubWallet({
        clubId: req.params.clubId, amount: cost, type: "expense",
        description: "Original GG ground upgrade to level " + nextLevel,
        idempotencyKey, session,
      });
      ground.level = nextLevel;
      await ground.save({ session });
      result = { success: true, duplicate: false, level: nextLevel, cost };
    });
    return res.json(result);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ message: error.message });
    if (error?.code === 11000) return res.status(409).json({ message: "This ground upgrade was already processed." });
    return next(error);
  } finally { await session.endSession(); }
});

router.get("/social/messages", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  const locationId = String(req.query.locationId || "city-plaza").trim();
  if (!/^[a-z0-9-]{1,64}$/i.test(locationId)) return res.status(400).json({ message: "Invalid chat location." });
  try {
    const messages = await WorldMessage.find({ locationId, expiresAt: { $gt: new Date() }, moderationStatus: "visible" })
      .sort({ createdAt: -1 }).limit(60).lean();
    return res.json({ messages: messages.reverse().map((item) => ({
      id: String(item._id), locationId, senderPlayerId: String(item.senderPlayerId),
      displayName: item.displayName, text: item.text, createdAt: item.createdAt,
    })) });
  } catch (error) { return next(error); }
});

router.post("/social/messages", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  const locationId = String(req.body?.locationId || "city-plaza").trim();
  // Strip control characters from untrusted chat text before validation and storage.
  // eslint-disable-next-line no-control-regex
  const message = String(req.body?.text || "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!/^[a-z0-9-]{1,64}$/i.test(locationId)) return res.status(400).json({ message: "Invalid chat location." });
  if (!message || message.length > 240) return res.status(400).json({ message: "Write a message between 1 and 240 characters." });
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15000);
    const rate = await WorldSocialRateLimit.findOneAndUpdate(
      { playerId },
      [
        { $set: {
          playerId: { $ifNull: ["$playerId", playerId] },
          messageWindowStart: { $cond: [
            { $or: [{ $eq: [{ $ifNull: ["$messageWindowStart", null] }, null] }, { $lte: ["$messageWindowStart", windowStart] }] },
            now,
            "$messageWindowStart",
          ] },
          messageCount: { $cond: [
            { $or: [{ $eq: [{ $ifNull: ["$messageWindowStart", null] }, null] }, { $lte: ["$messageWindowStart", windowStart] }] },
            1,
            { $add: [{ $ifNull: ["$messageCount", 0] }, 1] },
          ] },
        } },
      ],
      { new: true, upsert: true },
    ).lean();
    if ((rate?.messageCount || 0) > 5) return res.status(429).json({ message: "You're sending messages too quickly. Take a short breather." });
    const [player, avatar] = await Promise.all([
      Player.findById(playerId).select("name").lean(),
      PlayerAvatar.findOne({ playerId }).select("displayName").lean(),
    ]);
    const [saved] = await WorldMessage.create([{
      locationId, senderPlayerId: playerId,
      displayName: avatar?.displayName || player?.name || "GG Player",
      text: message,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    }]);
    const payload = { id: String(saved._id), locationId, senderPlayerId: String(playerId), displayName: saved.displayName, text: saved.text, createdAt: saved.createdAt };
    publishWorldEvent("social:message", payload, { locationId: "world" });
    return res.status(201).json({ success: true, message: payload });
  } catch (error) { return next(error); }
});

router.post("/social/messages/:messageId/report", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(400).json({ message: "Invalid message." });
  const reason = String(req.body?.reason || "other");
  if (!["spam", "harassment", "inappropriate", "other"].includes(reason)) return res.status(400).json({ message: "Choose a valid report reason." });
  try {
    const message = await WorldMessage.findOne({ _id: req.params.messageId, expiresAt: { $gt: new Date() } });
    if (!message || message.moderationStatus === "hidden") return res.status(404).json({ message: "Message not found." });
    if (String(message.senderPlayerId) === String(playerId)) return res.status(400).json({ message: "You cannot report your own message." });
    await WorldMessageReport.create([{ messageId: message._id, playerId, reason }]);
    const updated = await WorldMessage.findOneAndUpdate(
      { _id: message._id, expiresAt: { $gt: new Date() } },
      [{ $set: { reportCount: { $add: [{ $ifNull: ["$reportCount", 0] }, 1] } } }],
      { new: true },
    ).lean();
    const moderationStatus = updated.reportCount >= 5 ? "hidden" : updated.reportCount >= 3 ? "pending_review" : "visible";
    if (moderationStatus !== updated.moderationStatus) await WorldMessage.updateOne({ _id: message._id }, { $set: { moderationStatus } });
    if (moderationStatus === "hidden") publishWorldEvent("social:message_hidden", { id: String(message._id), locationId: message.locationId }, { locationId: "world" });
    return res.status(201).json({ success: true, moderationStatus });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "You have already reported this message." });
    return next(error);
  }
});

router.post("/social/interactions", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const fromPlayerId = linkedPlayerId(req, res);
  if (!fromPlayerId) return;
  const toPlayerId = String(req.body?.toPlayerId || "");
  const type = String(req.body?.type || "");
  if (!mongoose.isValidObjectId(toPlayerId) || toPlayerId === String(fromPlayerId)) return res.status(400).json({ message: "Choose another active player." });
  if (!["wave", "high-five", "cheer", "dance"].includes(type)) return res.status(400).json({ message: "Choose a supported character interaction." });
  try {
    const activeTarget = await WorldPresence.findOne({ playerId: toPlayerId, lastSeenAt: { $gte: new Date(Date.now() - 45000) } }).select("playerId locationId").lean();
    if (!activeTarget) return res.status(404).json({ message: "That player is no longer in the city." });
    const now = new Date();
    await WorldSocialRateLimit.updateOne({ playerId: fromPlayerId }, { $setOnInsert: { playerId: fromPlayerId } }, { upsert: true });
    const rate = await WorldSocialRateLimit.findOneAndUpdate(
      { playerId: fromPlayerId, $or: [{ lastInteractionAt: null }, { lastInteractionAt: { $lte: new Date(now.getTime() - 2500) } }] },
      { $set: { lastInteractionAt: now } },
      { new: true },
    ).lean();
    if (!rate) return res.status(429).json({ message: "Wait a moment before sending another interaction." });
    const [player, avatar] = await Promise.all([
      Player.findById(fromPlayerId).select("name").lean(),
      PlayerAvatar.findOne({ playerId: fromPlayerId }).select("displayName").lean(),
    ]);
    const interaction = await WorldInteraction.create({
      fromPlayerId, toPlayerId, fromName: avatar?.displayName || player?.name || "GG Player",
      type, locationId: activeTarget.locationId,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    });
    const payload = { id: String(interaction._id), fromPlayerId: String(fromPlayerId), toPlayerId, fromName: interaction.fromName, type, locationId: interaction.locationId, createdAt: interaction.createdAt };
    publishWorldEvent("social:interaction", payload, { locationId: "world" });
    return res.status(201).json({ success: true, interaction: payload });
  } catch (error) { return next(error); }
});

router.get("/social/interactions", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  try {
    const rows = await WorldInteraction.find({ toPlayerId: playerId, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(20).lean();
    return res.json({ interactions: rows.map((item) => ({ id: String(item._id), fromPlayerId: String(item.fromPlayerId), fromName: item.fromName, type: item.type, createdAt: item.createdAt })) });
  } catch (error) { return next(error); }
});

router.post("/social/interactions/:interactionId/acknowledge", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  if (!mongoose.isValidObjectId(req.params.interactionId)) return res.status(400).json({ message: "Invalid interaction." });
  try {
    const result = await WorldInteraction.deleteOne({ _id: req.params.interactionId, toPlayerId: playerId });
    return res.json({ success: true, acknowledged: result.deletedCount === 1 });
  } catch (error) { return next(error); }
});

export default router;
