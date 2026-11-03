import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import Player from "../server/models/Player.js";
import Match from "../server/models/Match.js";
import Award from "../server/models/Award.js";
import Achievement from "../server/models/Achievement.js";
import { syncHistory } from "../server/services/history.js";

let database;
const worldA = new mongoose.Types.ObjectId();
const worldB = new mongoose.Types.ObjectId();
let playerA;
let playerB;

before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1 },
  });
  await mongoose.connect(database.getUri("monthly-award-history"));
  await Promise.all([Player.init(), Match.init(), Award.init(), Achievement.init()]);

  [playerA, playerB] = await Player.create([
    { worldId: worldA, name: "Monthly Award Player A", position: "CAM" },
    { worldId: worldB, name: "Monthly Award Player B", position: "CAM" },
  ]);
}, { timeout: 120_000 });

after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

async function addPeriodMatches(player, worldId, year, month, days) {
  await Match.create(days.map(day => ({
    worldId,
    date: new Date(Date.UTC(year, month - 1, day, 12)),
    name: "Monthly award test",
    teamA: { label: "Award FC", score: 1 },
    teamB: { label: "Opposition", score: 0 },
    participants: [{
      player: player._id,
      team: "A",
      rating: 8,
      ratingSystem: "gg-v3",
      defensivePerformance: 7.5,
      ownGoals: 0,
    }],
    events: [
      { player: player._id, type: "goal" },
      { player: player._id, type: "assist" },
    ],
  })));
}

test("monthly awards finalize after month-end, stay idempotent and remain isolated by World", async () => {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const previous = new Date(Date.UTC(currentYear, currentMonth - 2, 1));
  const previousYear = previous.getUTCFullYear();
  const previousMonth = previous.getUTCMonth() + 1;

  await Promise.all([
    addPeriodMatches(playerA, worldA, previousYear, previousMonth, [2, 10, 18]),
    addPeriodMatches(playerB, worldB, previousYear, previousMonth, [2, 10, 18]),
    addPeriodMatches(playerA, worldA, currentYear, currentMonth, [1, 2, 3]),
    addPeriodMatches(playerB, worldB, currentYear, currentMonth, [1, 2, 3]),
  ]);

  await syncHistory();

  const [awardsA, awardsB] = await Promise.all([
    Award.find({ worldId: worldA }).sort({ type: 1 }).lean(),
    Award.find({ worldId: worldB }).sort({ type: 1 }).lean(),
  ]);

  assert.ok(awardsA.length > 0, "the previous completed month should be finalized");
  assert.ok(awardsB.length > 0, "the previous completed month should be finalized in the second World");
  assert.ok(awardsA.every(award => String(award.player) === String(playerA._id)));
  assert.ok(awardsB.every(award => String(award.player) === String(playerB._id)));
  assert.ok(awardsA.every(award => String(award.worldId) === String(worldA)));
  assert.ok(awardsB.every(award => String(award.worldId) === String(worldB)));
  assert.ok(awardsA.every(award => award.year === previousYear && award.month === previousMonth));
  assert.ok(awardsB.every(award => award.year === previousYear && award.month === previousMonth));
  assert.deepEqual(
    new Set(awardsA.map(award => award.type)),
    new Set(["player", "offensive", "defensive"]),
  );

  const beforeRetry = await Award.countDocuments({});
  await syncHistory();
  assert.equal(await Award.countDocuments({}), beforeRetry, "re-running the history sync must not duplicate finalized awards");

  const currentMonthAwards = await Award.countDocuments({
    year: currentYear,
    month: currentMonth,
    type: { $in: ["player", "offensive", "defensive"] },
  });
  assert.equal(currentMonthAwards, 0, "the current month remains provisional until it ends");
});
