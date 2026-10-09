import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const { default: Player } = await import("../server/models/Player.js");
const { default: Match } = await import("../server/models/Match.js");
const { default: PlayerStats } = await import("../server/models/PlayerStats.js");
const { default: SeasonStats } = await import("../server/models/SeasonStats.js");
const { loadPlayerStatistics, rebuildPlayerStatistics } = await import("../server/services/persistedStatistics.js");

let database;
let player;

before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1 },
  });
  await mongoose.connect(database.getUri("persisted-statistics"));
  await Promise.all([Player.init(), Match.init(), PlayerStats.init(), SeasonStats.init()]);
  player = await Player.create({ name: "Snapshot Regression Player", position: "CM" });
}, { timeout: 120_000 });

after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

async function addRatedMatch(rating = 7.5) {
  return Match.create({
    date: new Date("2026-09-18T12:00:00.000Z"),
    name: "Snapshot freshness regression",
    teamA: { label: "A", score: 0 },
    teamB: { label: "B", score: 0 },
    participants: [{
      player: player._id,
      team: "A",
      rating,
      ratingSystem: "gg-v3",
      ownGoals: 1,
      defensivePerformance: 6,
    }],
    events: [],
  });
}

test("statistics reads recompute stale/missing snapshots without writing them", async () => {
  await PlayerStats.create({
    playerId: player._id,
    stats: { playerId: String(player._id), matches: 0, ratedMatches: 0, averageRating: 3 },
    matchCount: 0,
    sourceLatestMatchAt: null,
  });
  await addRatedMatch(7.5);

  const result = await loadPlayerStatistics([player]);
  assert.equal(result[0].matches, 1);
  assert.equal(result[0].averageRating, 7.5, "GG-v3 ratings must not receive a second own-goal deduction");

  const stored = await PlayerStats.findOne({ playerId: player._id }).lean();
  assert.equal(stored.matchCount, 0, "a GET fallback must not persist its repair");
  assert.equal(stored.stats.averageRating, 3);
});

test("statistics reads detect edits and deletions while keeping snapshots read-only", async () => {
  const [match] = await Match.find({ "participants.player": player._id }).sort({ date: -1 });
  assert.ok(match);
  await rebuildPlayerStatistics([player._id]);
  const baseline = await PlayerStats.findOne({ playerId: player._id }).lean();
  assert.equal(baseline.matchCount, 1);
  assert.equal(baseline.stats.averageRating, 7.5);

  match.participants[0].rating = 8.25;
  await match.save();
  const afterEdit = await loadPlayerStatistics([player]);
  assert.equal(afterEdit[0].averageRating, 8.25, "an edited match invalidates same-count snapshots");
  const stillOld = await PlayerStats.findOne({ playerId: player._id }).lean();
  assert.equal(stillOld.stats.averageRating, 7.5, "reads must not rewrite stale snapshots");

  await Match.deleteOne({ _id: match._id });
  const afterDelete = await loadPlayerStatistics([player]);
  assert.equal(afterDelete[0].matches, 0);
  assert.equal(afterDelete[0].averageRating, null);
  const stillStored = await PlayerStats.findOne({ playerId: player._id }).lean();
  assert.equal(stillStored.matchCount, 1, "deletion is detected without a write from the GET path");
});
