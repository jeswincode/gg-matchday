import test from "node:test";
import assert from "node:assert/strict";
import {
  CORE_BACKFILL_COLLECTIONS,
  CORE_CONDITIONAL_COLLECTIONS,
  CLUBS_BACKFILL_COLLECTIONS,
  applySingleWorldMigration,
} from "../scripts/migrations/backfill-original-gg-world.mjs";

test("legacy Matchday backfill covers history, ratings, awards and derived statistics", () => {
  for (const collection of [
    "players", "matches", "playerStats", "seasonStats", "awards",
    "achievements", "votes", "news", "notifications", "ratingDisputes",
  ]) {
    assert.ok(CORE_BACKFILL_COLLECTIONS.includes(collection), collection);
  }
});

test("legacy Clubs backfill covers clubs, contracts, auctions and financial ledgers", () => {
  for (const collection of [
    "clubs", "clubMatches", "clubContracts", "clubHistory",
    "auctionOffers", "clubWalletTransactions", "playerWallets",
    "playerWalletTransactions", "clubMatchBets", "clubSyncJobs",
  ]) {
    assert.ok(CLUBS_BACKFILL_COLLECTIONS.includes(collection), collection);
  }
});

test("only world-scoped media is eligible for automatic backfill", () => {
  assert.deepEqual(CORE_CONDITIONAL_COLLECTIONS, [
    { name: "mediaAssets", filter: { scope: "world" } },
  ]);
});

test("global account identities, World access records and map layout are not backfill collections", () => {
  const all = [
    ...CORE_BACKFILL_COLLECTIONS,
    ...CORE_CONDITIONAL_COLLECTIONS.map(item => item.name),
    ...CLUBS_BACKFILL_COLLECTIONS,
  ];
  for (const excluded of [
    "users", "worlds", "worldMemberships", "worldAccessGrants",
    "worldMapLayouts", "worldMapFacilities",
  ]) {
    assert.ok(!all.includes(excluded), excluded);
  }
});

test("apply refuses to start without explicit Original GG ownership confirmation", async () => {
  await assert.rejects(
    applySingleWorldMigration({}),
    /explicit confirmation that every legacy null\/missing-worldId record belongs to Original GG/,
  );
});

test("apply refuses to start without a maintenance window", async () => {
  await assert.rejects(
    applySingleWorldMigration({ confirmOwnership: true }),
    /maintenance window with application writes paused/,
  );
});

test("apply refuses to start without a verified backup reference", async () => {
  await assert.rejects(
    applySingleWorldMigration({ confirmOwnership: true, confirmMaintenance: true }),
    /verified pre-migration backup reference/,
  );
});
