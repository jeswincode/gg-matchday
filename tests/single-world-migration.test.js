import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

test("migration CLI refuses to guess the Core database when its URI has no path", () => {
  const env = {
    ...process.env,
    MONGODB_URI: "mongodb+srv://private.example/",
    CLUBS_MONGODB_URI: "mongodb+srv://private.example/gg_matchday_clubs",
    GG_PRIMARY_WORLD_SLUG: "original-gg",
  };
  delete env.MONGODB_DATABASE;
  delete env.CLUBS_DB_NAME;
  const result = spawnSync(process.execPath, ["scripts/migrations/backfill-original-gg-world.mjs"], {
    encoding: "utf8",
    env,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Core MongoDB database name is missing/i);
  assert.doesNotMatch(result.stdout + result.stderr, /private\.example/);
});

test("migration CLI refuses to guess the Clubs database when its URI has no path", () => {
  const env = {
    ...process.env,
    MONGODB_URI: "mongodb+srv://private.example/gg_matchday",
    CLUBS_MONGODB_URI: "mongodb+srv://private.example/",
    GG_PRIMARY_WORLD_SLUG: "original-gg",
  };
  delete env.MONGODB_DATABASE;
  delete env.CLUBS_DB_NAME;
  const result = spawnSync(process.execPath, ["scripts/migrations/backfill-original-gg-world.mjs"], {
    encoding: "utf8",
    env,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Clubs MongoDB database name is missing/i);
  assert.doesNotMatch(result.stdout + result.stderr, /private\.example/);
});
