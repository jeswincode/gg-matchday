import express from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { getClubsConnection } from "../config/clubsDatabase.js";
import Player from "../models/Player.js";
import Club from "../models/clubs/Club.js";
import ClubGround from "../models/clubs/ClubGround.js";
import PlayerResidence from "../models/clubs/PlayerResidence.js";
import WorldMap from "../models/clubs/WorldMap.js";
import PlayerAvatar from "../models/clubs/PlayerAvatar.js";
import TrainingProfile from "../models/clubs/TrainingProfile.js";
import TrainingSession from "../models/clubs/TrainingSession.js";
import WorldPresence from "../models/clubs/WorldPresence.js";
import {
  DEFAULT_WORLD_LAYOUT,
  WORLD_MAP_SLUG,
  normalizeAvatarPayload,
  normalizePresencePayload,
  normalizeTrainingSession,
} from "../config/ggWorldRules.js";

const router = express.Router();
router.use(requireAuth);

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
      return saved ? { ...defaults, ...saved, interior: saved.interior || defaults.interior } : defaults;
    });
    const layout = {
      ...structuredClone(DEFAULT_WORLD_LAYOUT),
      ...(existing.layout || {}),
      layers: existing.layout?.layers?.length ? existing.layout.layers : DEFAULT_WORLD_LAYOUT.layers,
      locations,
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

function publicAvatar(avatar, playerName = "GG Player") {
  if (!avatar) {
    return {
      displayName: playerName,
      appearance: { skinTone: "medium", hairStyle: "short", hairColor: "black", kitPrimary: "black", kitSecondary: "gold", bootColor: "white" },
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
      Club.find({ status: "approved" }).select("name logoUrl memberIds").sort({ nameNormalized: 1 }).lean(),
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
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean()));
    let avatar = null;
    let training = null;
    let residence = null;
    if (playerId) {
      const [player, savedAvatar, savedTraining] = await Promise.all([
        Player.findById(playerId).select("name").lean(),
        PlayerAvatar.findOne({ playerId }).lean(),
        TrainingProfile.findOne({ playerId }).lean(),
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
      training = savedTraining || {
        totals: { pushups: 0, pullups: 0, squats: 0, planks: 0, totalCounts: 0, sessions: 0 },
        personalBests: { pushups: 0, pullups: 0, squats: 0, planks: 0 },
        lastWorkoutAt: null,
      };
    }
    const activePresence = await WorldPresence.find({ lastSeenAt: { $gte: new Date(Date.now() - 45000) } })
      .select("playerId displayName locationId x y lastSeenAt")
      .limit(100)
      .lean();
    const presenceIds = activePresence.map((item) => item.playerId);
    const avatars = await PlayerAvatar.find({ playerId: { $in: presenceIds } }).select("playerId appearance").lean();
    const activeResidences = await PlayerResidence.find({ ownerPlayerId: { $in: presenceIds } })
      .select("ownerPlayerId name x y level privacy")
      .lean();
    const appearanceByPlayer = new Map(avatars.map((item) => [String(item.playerId), item.appearance]));
    return res.json({
      world: { slug: world.slug, title: world.title, version: world.version, layout: world.layout },
      playerId: playerId ? String(playerId) : null,
      clubs: clubs.map((club) => ({ id: String(club._id), name: club.name, logoUrl: club.logoUrl, memberCount: club.memberIds?.length || 0 })),
      clubGrounds: clubGrounds.map((ground) => ({ id: "ground-" + String(ground.clubId), clubId: String(ground.clubId), name: ground.name, kind: "club-ground", x: ground.x, y: ground.y, level: ground.level, accessPolicy: ground.accessPolicy })),
      canCreateCharacter: Boolean(playerId),
      residence: residence ? { ownerPlayerId: String(residence.ownerPlayerId), name: residence.name, x: residence.x, y: residence.y, level: residence.level, privacy: residence.privacy } : null,
      residences: activeResidences.map((home) => ({ ownerPlayerId: String(home.ownerPlayerId), name: home.name, x: home.x, y: home.y, level: home.level, privacy: home.privacy })),
      avatar,
      training,
      presence: activePresence.map((item) => ({
        playerId: String(item.playerId),
        displayName: item.displayName,
        locationId: item.locationId,
        x: item.x,
        y: item.y,
        appearance: appearanceByPlayer.get(String(item.playerId)) || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/avatar", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  const playerId = linkedPlayerId(req, res);
  if (!playerId) return;
  try {
    const payload = normalizeAvatarPayload(req.body);
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
        result = { session: saved.toObject(), profile, duplicate: false };
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
    if (!isOwner && residence.privacy !== "public") {
      return res.status(403).json({ message: "This player's home interior is private." });
    }
    return res.json({
      residence: {
        ownerPlayerId: String(residence.ownerPlayerId),
        name: residence.name,
        level: residence.level,
        interior: residence.interior,
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
      PlayerAvatar.findOne({ playerId }).select("displayName").lean(),
    ]);
    const presence = await WorldPresence.findOneAndUpdate(
      { playerId },
      { $set: { ...position, displayName: avatar?.displayName || player?.name || "GG Player", lastSeenAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();
    return res.json({ success: true, presence: { playerId: String(playerId), displayName: presence.displayName, locationId: presence.locationId, x: presence.x, y: presence.y } });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ message: error.message });
    return next(error);
  }
});

router.get("/presence", async (req, res, next) => {
  if (!ensureClubsDatabase(res)) return;
  try {
    const presence = await WorldPresence.find({ lastSeenAt: { $gte: new Date(Date.now() - 45000) } })
      .select("playerId displayName locationId x y lastSeenAt")
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
        appearance: appearanceByPlayer.get(String(item.playerId)) || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
