import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { getClubsConnection } from "../server/config/clubsDatabase.js";
import PlayerWallet from "../server/models/clubs/PlayerWallet.js";
import ClubMatch from "../server/models/clubs/ClubMatch.js";
import { runWithWorldDataScope } from "../server/services/worldDataScope.js";

let database;
const worldA = new mongoose.Types.ObjectId();
const worldB = new mongoose.Types.ObjectId();
const samePlayerId = new mongoose.Types.ObjectId();
const clubA1 = new mongoose.Types.ObjectId();
const clubA2 = new mongoose.Types.ObjectId();
const clubB1 = new mongoose.Types.ObjectId();
const clubB2 = new mongoose.Types.ObjectId();

before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1 },
  });
  await mongoose.connect(database.getUri("core-world-clubs"));
  await getClubsConnection().openUri(database.getUri("clubs-world-scope"), {
    serverSelectionTimeoutMS: 10_000,
  });
  await Promise.all([PlayerWallet.init(), ClubMatch.init()]);
}, { timeout: 120_000 });

after(async () => {
  await Promise.allSettled([
    mongoose.disconnect(),
    getClubsConnection().close(),
  ]);
  await database?.stop();
});

test("Clubs wallets and fixture dates coexist independently across Worlds", async () => {
  await PlayerWallet.create([
    { worldId: worldA, playerId: samePlayerId, balance: 120 },
    { worldId: worldB, playerId: samePlayerId, balance: 850 },
  ]);

  await ClubMatch.create([
    {
      worldId: worldA,
      clubAId: clubA1,
      clubBId: clubA2,
      fixtureDate: "2026-11-01",
      scheduledAt: new Date("2026-11-01T00:00:00.000Z"),
      source: "booked",
      status: "requested",
    },
    {
      worldId: worldB,
      clubAId: clubB1,
      clubBId: clubB2,
      fixtureDate: "2026-11-01",
      scheduledAt: new Date("2026-11-01T00:00:00.000Z"),
      source: "booked",
      status: "requested",
    },
  ]);

  await runWithWorldDataScope(worldA, async () => {
    const wallet = await PlayerWallet.findOne({ playerId: samePlayerId }).lean();
    assert.equal(wallet.balance, 120);
    assert.equal(await PlayerWallet.countDocuments({}), 1);
    const fixtures = await ClubMatch.find({ fixtureDate: "2026-11-01" }).lean();
    assert.equal(fixtures.length, 1);
    assert.equal(String(fixtures[0].clubAId), String(clubA1));
  });

  await runWithWorldDataScope(worldB, async () => {
    const wallet = await PlayerWallet.findOne({ playerId: samePlayerId }).lean();
    assert.equal(wallet.balance, 850);
    const fixtures = await ClubMatch.find({ fixtureDate: "2026-11-01" }).lean();
    assert.equal(fixtures.length, 1);
    assert.equal(String(fixtures[0].clubAId), String(clubB1));
  });

  await runWithWorldDataScope(null, async () => {
    assert.equal(await PlayerWallet.countDocuments({}), 0);
    assert.equal(await ClubMatch.countDocuments({}), 0);
  });
});
