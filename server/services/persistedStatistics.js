import mongoose from "mongoose";
import Player from "../models/Player.js";
import Match from "../models/Match.js";
import PlayerStats from "../models/PlayerStats.js";
import SeasonStats from "../models/SeasonStats.js";
import { buildStatistics, dateQuery, id } from "./statistics.js";

const MATCH_FIELDS = "_id date createdAt updatedAt teamA teamB participants events";
const PLAYER_BATCH_SIZE = 20;

function chunks(values, size = PLAYER_BATCH_SIZE) {
  const batches = [];
  for (let index = 0; index < values.length; index += size) batches.push(values.slice(index, index + size));
  return batches;
}

function latestSourceTime(matches) {
  let latest = null;
  for (const match of matches) {
    const value = match.updatedAt || match.date;
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isFinite(time) && (latest === null || time > latest.getTime())) latest = new Date(time);
  }
  return latest;
}

function matchesForPlayer(matches, playerId) {
  const target = String(playerId);
  return matches.filter(match => (match.participants || []).some(participant => id(participant.player) === target));
}

function decorateStats(stats, player) {
  return {
    ...stats,
    playerId: String(player._id),
    name: player.name,
    profileImage: player.profileImage,
    position: player.position,
    preferredPositions: player.preferredPositions || [],
    clasicoSide: player.clasicoSide || "",
  };
}

async function rebuildPlayer(player, history) {
  const matches = matchesForPlayer(history, player._id);
  const stats = buildStatistics([player], matches)[0];
  await PlayerStats.findOneAndUpdate(
    { playerId: player._id },
    { $set: { stats, matchCount: matches.length, sourceLatestMatchAt: latestSourceTime(matches) } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const byYear = new Map();
  for (const match of matches) {
    const year = new Date(match.date).getUTCFullYear();
    if (!Number.isInteger(year) || year < 2000 || year > 2100) continue;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(match);
  }
  const years = [...byYear.keys()];
  if (years.length) await SeasonStats.deleteMany({ playerId: player._id, year: { $nin: years } });
  else await SeasonStats.deleteMany({ playerId: player._id });

  for (const [year, seasonMatches] of byYear) {
    const seasonStats = buildStatistics([player], seasonMatches)[0];
    await SeasonStats.findOneAndUpdate(
      { playerId: player._id, year },
      { $set: { stats: seasonStats, matchCount: seasonMatches.length, sourceLatestMatchAt: latestSourceTime(seasonMatches) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}

export async function rebuildPlayerStatistics(playerIds) {
  const ids = [...new Set((playerIds || []).map(String).filter(mongoose.isValidObjectId))];
  if (!ids.length) return { rebuilt: 0 };

  const players = await Player.find({ _id: { $in: ids } }).lean();
  const existingIds = new Set(players.map(player => String(player._id)));
  const removed = ids.filter(playerId => !existingIds.has(playerId));
  if (removed.length) await Promise.all([
    PlayerStats.deleteMany({ playerId: { $in: removed } }),
    SeasonStats.deleteMany({ playerId: { $in: removed } }),
  ]);

  let rebuilt = 0;
  for (const batch of chunks(players)) {
    const history = await Match.find({ "participants.player": { $in: batch.map(player => player._id) } })
      .select(MATCH_FIELDS).lean();
    for (const player of batch) {
      await rebuildPlayer(player, history);
      rebuilt++;
    }
  }
  return { rebuilt };
}

export async function rebuildAllPlayerStatistics() {
  let batch = [];
  let rebuilt = 0;
  const cursor = Player.find({}).select("_id").lean().cursor();
  for await (const player of cursor) {
    batch.push(String(player._id));
    if (batch.length === PLAYER_BATCH_SIZE) {
      rebuilt += (await rebuildPlayerStatistics(batch)).rebuilt;
      batch = [];
    }
  }
  if (batch.length) rebuilt += (await rebuildPlayerStatistics(batch)).rebuilt;
  return { rebuilt };
}

export async function loadPlayerStatistics(players, { year = null } = {}) {
  const list = Array.isArray(players) ? players : [];
  if (!list.length) return [];
  const numericYear = year == null ? null : Number(year);
  if (numericYear !== null && (!Number.isInteger(numericYear) || numericYear < 2000 || numericYear > 2100)) {
    throw new Error("Choose a valid year.");
  }

  const ids = list.map(player => player._id).filter(Boolean);
  const period = numericYear === null ? {} : dateQuery(numericYear);
  const snapshots = numericYear === null
    ? await PlayerStats.find({ playerId: { $in: ids } }).lean()
    : await SeasonStats.find({ playerId: { $in: ids }, year: numericYear }).lean();
  const snapshotById = new Map(snapshots.map(snapshot => [String(snapshot.playerId), snapshot]));

  // Validate snapshot freshness using indexed aggregation metadata instead of
  // trusting persisted rows indefinitely or loading all history for every read.
  const sourceRows = await Match.aggregate([
    { $match: { "participants.player": { $in: ids }, ...period } },
    { $unwind: "$participants" },
    { $match: { "participants.player": { $in: ids } } },
    {
      $group: {
        _id: { playerId: "$participants.player", matchId: "$_id" },
        latestSourceAt: { $max: { $ifNull: ["$updatedAt", "$date"] } },
      },
    },
    {
      $group: {
        _id: "$_id.playerId",
        matchCount: { $sum: 1 },
        sourceLatestMatchAt: { $max: "$latestSourceAt" },
      },
    },
  ]);
  const sourceById = new Map(sourceRows.map(row => [String(row._id), row]));
  const stalePlayers = list.filter(player => {
    const key = String(player._id);
    const snapshot = snapshotById.get(key);
    const source = sourceById.get(key);
    const expectedCount = Number(source?.matchCount || 0);
    const snapshotCount = Number(snapshot?.matchCount ?? -1);
    const expectedTime = source?.sourceLatestMatchAt
      ? new Date(source.sourceLatestMatchAt).getTime()
      : null;
    const snapshotTime = snapshot?.sourceLatestMatchAt
      ? new Date(snapshot.sourceLatestMatchAt).getTime()
      : null;
    return !snapshot || snapshotCount !== expectedCount || snapshotTime !== expectedTime;
  });

  const rows = new Map(
    [...snapshotById.entries()].map(([playerId, snapshot]) => [playerId, snapshot.stats]),
  );
  // Missing or stale rows are calculated from only affected-player history.
  // This read path stays read-only; normal mutations/maintenance persist repairs.
  for (const batch of chunks(stalePlayers)) {
    const history = await Match.find({
      "participants.player": { $in: batch.map(player => player._id) },
      ...period,
    }).select(MATCH_FIELDS).lean();
    for (const player of batch) {
      rows.set(
        String(player._id),
        buildStatistics([player], matchesForPlayer(history, player._id))[0],
      );
    }
  }
  return list.map(player => decorateStats(
    rows.get(String(player._id)) || buildStatistics([player], [])[0],
    player,
  ));
}

export function startStatisticsMaintenanceWorker(intervalMs = 24 * 60 * 60 * 1000) {
  const run = async () => {
    try {
      const result = await rebuildAllPlayerStatistics();
      console.info("Player/season statistics snapshots refreshed:", result.rebuilt);
    } catch (error) {
      console.error("Player/season statistics refresh failed:", error);
    }
  };
  void run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}
