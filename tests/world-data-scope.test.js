import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Player from "../server/models/Player.js";
import { runWithWorldDataScope } from "../server/services/worldDataScope.js";

let database;
const worldA = new mongoose.Types.ObjectId();
const worldB = new mongoose.Types.ObjectId();

before(async () => {
  database = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1 },
  });
  await mongoose.connect(database.getUri("world-data-scope"));
  await Player.init();
}, { timeout: 120_000 });

after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

test("queries, counts and aggregations are constrained to the active World", async () => {
  const [playerA] = await Player.create([{
    worldId: worldA,
    name: "Scope Player A",
  }]);
  const [playerB] = await Player.create([{
    worldId: worldB,
    name: "Scope Player B",
  }]);

  await runWithWorldDataScope(worldA, async () => {
    const players = await Player.find({}).lean();
    assert.deepEqual(players.map(item => String(item._id)), [String(playerA._id)]);
    assert.equal(await Player.countDocuments({}), 1);
    assert.equal(await Player.findById(playerB._id).lean(), null);

    const [aggregate] = await Player.aggregate([
      { $group: { _id: null, count: { $sum: 1 } } },
    ]);
    assert.equal(aggregate.count, 1);
  });

  await runWithWorldDataScope(worldB, async () => {
    const players = await Player.find({}).lean();
    assert.deepEqual(players.map(item => String(item._id)), [String(playerB._id)]);
    assert.equal(await Player.countDocuments({}), 1);
  });
});

test("writes cannot target another World and new records inherit active World ownership", async () => {
  const playerA = await runWithWorldDataScope(worldA, () =>
    Player.create({ name: "Auto Scoped Player" }),
  );
  assert.equal(String(playerA.worldId), String(worldA));

  await runWithWorldDataScope(worldA, async () => {
    const changed = await Player.updateOne(
      { _id: playerA._id },
      { $set: { bio: "Updated in A" } },
    );
    assert.equal(changed.modifiedCount, 1);

    const crossWorldWrite = await Player.updateOne(
      { _id: new mongoose.Types.ObjectId(), worldId: worldB },
      { $set: { bio: "This must not write" } },
    );
    assert.equal(crossWorldWrite.matchedCount, 0);
  });

  await runWithWorldDataScope(worldB, async () => {
    const protectedRecord = await Player.findById(playerA._id).lean();
    assert.equal(protectedRecord, null);
  });

  await assert.rejects(
    runWithWorldDataScope(worldA, () => Player.create({
      worldId: worldB,
      name: "Cross World Insert",
    })),
    /outside the active World/,
  );
});

test("aggregation-style update pipelines cannot move records across Worlds", async () => {
  const player = await Player.create({ worldId: worldA, name: "Pipeline Scoped Player" });
  await runWithWorldDataScope(worldA, async () => {
    const result = await Player.updateOne(
      { _id: player._id },
      [{ $set: { worldId: worldB, bio: "attempted move" } }],
      { updatePipeline: true },
    );
    assert.equal(result.matchedCount, 1);

    const unsetAttempt = await Player.updateOne(
      { _id: player._id },
      { $unset: { worldId: 1 }, $set: { bio: "ownership retained" } },
    );
    assert.equal(unsetAttempt.matchedCount, 1);
  });
  const stored = await Player.findById(player._id).lean();
  assert.equal(String(stored.worldId), String(worldA));
  assert.equal(stored.bio, "ownership retained");
});

test("legacy scope can see only null or missing World ownership", async () => {
  const legacy = await Player.create({ name: "Legacy Scope Player" });
  assert.equal(legacy.worldId, null);

  await runWithWorldDataScope(worldA, async () => {
    const ids = (await Player.find({}).select("_id").lean()).map(item => String(item._id));
    assert.ok(!ids.includes(String(legacy._id)));
  });

  await runWithWorldDataScope(null, async () => {
    const legacyRows = await Player.find({}).lean();
    assert.deepEqual(legacyRows.map(item => String(item._id)), [String(legacy._id)]);
  });
});
