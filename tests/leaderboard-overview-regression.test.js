import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import statsRoutes from "../server/routes/stats.js";
import Player from "../server/models/Player.js";
import Match from "../server/models/Match.js";
import PlayerStats from "../server/models/PlayerStats.js";
import SeasonStats from "../server/models/SeasonStats.js";
import Award from "../server/models/Award.js";
import Achievement from "../server/models/Achievement.js";

let database;
let server;
let origin;

async function get(path) {
  const response = await fetch(origin + path);
  return { status: response.status, data: await response.json() };
}

before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1 },
  });
  await mongoose.connect(database.getUri("leaderboard-overview-regression"));
  await Promise.all([Player, Match, PlayerStats, SeasonStats, Award, Achievement].map(model => model.init()));

  const app = express();
  app.use("/api/stats", statsRoutes);
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 120_000 });

after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await database?.stop();
});

test("overview counts detailed goal events and own goals", async () => {
  const scorer = await Player.create({ name: "Overview Regression Scorer" });
  const opponent = await Player.create({ name: "Overview Regression Opponent" });
  const before = await get("/api/stats/overview");
  assert.equal(before.status, 200);

  await Match.create({
    date: new Date("2026-10-09T12:00:00.000Z"),
    name: "Overview goal aggregation regression",
    teamA: { label: "A", score: 0 },
    teamB: { label: "B", score: 0 },
    participants: [
      { player: scorer._id, team: "A", rating: 8, defensivePerformance: 7 },
      { player: opponent._id, team: "B", rating: 6, defensivePerformance: 6, ownGoals: 1 },
    ],
    events: [
      { player: scorer._id, type: "goal" },
      { player: scorer._id, type: "goal" },
    ],
  });

  const after = await get("/api/stats/overview");
  assert.equal(after.status, 200);
  assert.equal(after.data.goals - before.data.goals, 3);
});

test("leaderboard globally sorts ratings and assigns unique table ranks", async () => {
  const leader = await Player.create({ name: "Leaderboard Regression Leader", position: "ST" });
  const runnerUp = await Player.create({ name: "Leaderboard Regression Runner Up", position: "CB" });

  for (let index = 0; index < 5; index++) {
    await Match.create({
      date: new Date(Date.UTC(2026, 7, index + 1, 12)),
      name: `Leaderboard rank regression ${index + 1}`,
      teamA: { label: "A", score: 0 },
      teamB: { label: "B", score: 0 },
      participants: [
        { player: leader._id, team: "A", rating: 9, defensivePerformance: 8 },
        { player: runnerUp._id, team: "B", rating: 6, defensivePerformance: 7 },
      ],
      events: [{ player: leader._id, type: "goal" }],
    });
  }

  const response = await get("/api/stats/leaderboard");
  assert.equal(response.status, 200);
  const rated = response.data.leaderboard.filter(row => row.ggRating !== null);
  assert.ok(rated.length >= 2);
  assert.deepEqual(rated.map(row => row.rank), rated.map((_, index) => index + 1));

  for (let index = 1; index < rated.length; index++) {
    assert.ok(
      rated[index - 1].ggRating >= rated[index].ggRating,
      `leaderboard must descend by GG Rating: ${rated[index - 1].name} then ${rated[index].name}`,
    );
  }

  const leaderRow = rated.find(row => row.playerId === String(leader._id));
  const runnerUpRow = rated.find(row => row.playerId === String(runnerUp._id));
  assert.ok(leaderRow.ggRating > runnerUpRow.ggRating);
  assert.ok(leaderRow.rank < runnerUpRow.rank);
});

test("overview preserves legacy stored scores when a match only has assist events", async () => {
  const scorer = await Player.create({ name: "Legacy Assist Only Scorer" });
  const teammate = await Player.create({ name: "Legacy Assist Only Teammate" });
  const before = await get("/api/stats/overview");
  assert.equal(before.status, 200);

  await Match.collection.insertOne({
    _id: new mongoose.Types.ObjectId(),
    date: new Date("2024-03-15T12:00:00.000Z"),
    name: "Legacy score with assist event only",
    teamA: { label: "A", score: 2 },
    teamB: { label: "B", score: 1 },
    participants: [
      { player: scorer._id, team: "A", rating: 8, defensivePerformance: 7, ownGoals: 0 },
      { player: teammate._id, team: "B", rating: 7, defensivePerformance: 6, ownGoals: 0 },
    ],
    events: [{ player: scorer._id, type: "assist" }],
    createdAt: new Date("2024-03-15T12:00:00.000Z"),
    updatedAt: new Date("2024-03-15T12:00:00.000Z"),
  });

  const after = await get("/api/stats/overview");
  assert.equal(after.status, 200);
  assert.equal(after.data.goals - before.data.goals, 3);
});
