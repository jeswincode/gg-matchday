import express from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { getClubsConnection } from "../config/clubsDatabase.js";
import Player from "../models/Player.js";
import Club from "../models/clubs/Club.js";
import ClubGround from "../models/clubs/ClubGround.js";
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
    if (playerId) {
      const [player, savedAvatar, savedTraining] = await Promise.all([
        Player.findById(playerId).select("name").lean(),
        PlayerAvatar.findOne({ playerId }).lean(),
        TrainingProfile.findOne({ playerId }).lean(),
      ]);
      avatar = publicAvatar(savedAvatar, player?.name || req.user?.name || "GG Player");
      training = savedTraining || {
        totals: { pushups: 0, pullups: 0, squats: 0, planks: 0, totalReps: 0, sessions: 0 },
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
    const appearanceByPlayer = new Map(avatars.map((item) => [String(item.playerId), item.appearance]));
    return res.json({
      world: { slug: world.slug, title: world.title, version: world.version, layout: world.layout },
      playerId: playerId ? String(playerId) : null,
      clubs: clubs.map((club) => ({ id: String(club._id), name: club.name, logoUrl: club.logoUrl, memberCount: club.memberIds?.length || 0 })),
      clubGrounds: clubGrounds.map((ground) => ({ id: "ground-" + String(ground.clubId), clubId: String(ground.clubId), name: ground.name, kind: "club-ground", x: ground.x, y: ground.y, level: ground.level, accessPolicy: ground.accessPolicy })),
      canCreateCharacter: Boolean(playerId),
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
          "totals.totalReps": payload.totalReps,
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
