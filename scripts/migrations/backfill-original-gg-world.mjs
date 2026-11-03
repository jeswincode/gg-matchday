import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import { pathToFileURL } from "node:url";

export const CORE_BACKFILL_COLLECTIONS = [
  "players",
  "matches",
  "playerStats",
  "seasonStats",
  "news",
  "awards",
  "achievements",
  "notifications",
  "chatmessages",
  "votes",
  "profilechangerequests",
  "ratingDisputes",
];

export const CORE_CONDITIONAL_COLLECTIONS = [
  { name: "mediaAssets", filter: { scope: "world" } },
];

export const CLUBS_BACKFILL_COLLECTIONS = [
  "clubs",
  "clubMatches",
  "clubContracts",
  "clubHistory",
  "clubWalletTransactions",
  "playerWallets",
  "playerWalletTransactions",
  "auctionOffers",
  "joinRequests",
  "playerReviews",
  "clubFormationApplications",
  "clubRenewalDecisions",
  "clubMatchBets",
  "clubAdminAuditEvents",
  "clubPlayerStats",
  "clubSyncJobs",
];

const REFERENCE_CHECKS = [
  { sourceDb: "core", source: "matches", path: "participants.player", parentDb: "core", parent: "players" },
  { sourceDb: "core", source: "matches", path: "events.player", parentDb: "core", parent: "players" },
  { sourceDb: "core", source: "matches", path: "motmWinner", parentDb: "core", parent: "players" },
  { sourceDb: "core", source: "awards", path: "player", parentDb: "core", parent: "players" },
  { sourceDb: "core", source: "awards", path: "match", parentDb: "core", parent: "matches" },
  { sourceDb: "core", source: "achievements", path: "player", parentDb: "core", parent: "players" },
  { sourceDb: "core", source: "playerStats", path: "playerId", parentDb: "core", parent: "players" },
  { sourceDb: "core", source: "seasonStats", path: "playerId", parentDb: "core", parent: "players" },
  { sourceDb: "core", source: "news", path: "match", parentDb: "core", parent: "matches" },
  { sourceDb: "core", source: "news", path: "featuredPlayer", parentDb: "core", parent: "players" },
  { sourceDb: "core", source: "votes", path: "match", parentDb: "core", parent: "matches" },
  { sourceDb: "core", source: "votes", path: "player", parentDb: "core", parent: "players" },
  { sourceDb: "core", source: "profilechangerequests", path: "player", parentDb: "core", parent: "players" },
  { sourceDb: "core", source: "ratingDisputes", path: "match", parentDb: "core", parent: "matches" },
  { sourceDb: "core", source: "ratingDisputes", path: "player", parentDb: "core", parent: "players" },


  { sourceDb: "clubs", source: "clubs", path: "memberIds", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubs", path: "captainIds", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubMatches", path: "clubAId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubMatches", path: "clubBId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubMatches", path: "requestedByClubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubMatches", path: "winnerClubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubMatches", path: "mainMatchId", parentDb: "core", parent: "matches" },
  { sourceDb: "clubs", source: "clubContracts", path: "clubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubContracts", path: "playerId", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubFormationApplications", path: "founderPlayerId", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubFormationApplications", path: "memberIds", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubFormationApplications", path: "captainCandidates", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubFormationApplications", path: "electedCaptainIds", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubFormationApplications", path: "detailsApprovedBy", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubFormationApplications", path: "approvedClubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubHistory", path: "clubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubHistory", path: "playerId", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubHistory", path: "relatedClubMatchId", parentDb: "clubs", parent: "clubMatches" },
  { sourceDb: "clubs", source: "clubHistory", path: "relatedMainMatchId", parentDb: "core", parent: "matches" },
  { sourceDb: "clubs", source: "clubWalletTransactions", path: "clubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubWalletTransactions", path: "mainMatchId", parentDb: "core", parent: "matches" },
  { sourceDb: "clubs", source: "clubWalletTransactions", path: "clubMatchId", parentDb: "clubs", parent: "clubMatches" },
  { sourceDb: "clubs", source: "clubWalletTransactions", path: "auctionOfferId", parentDb: "clubs", parent: "auctionOffers" },
  { sourceDb: "clubs", source: "playerWallets", path: "playerId", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "playerWalletTransactions", path: "playerId", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "playerWalletTransactions", path: "clubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "playerWalletTransactions", path: "mainMatchId", parentDb: "core", parent: "matches" },
  { sourceDb: "clubs", source: "playerWalletTransactions", path: "clubMatchId", parentDb: "clubs", parent: "clubMatches" },
  { sourceDb: "clubs", source: "playerWalletTransactions", path: "auctionOfferId", parentDb: "clubs", parent: "auctionOffers" },
  { sourceDb: "clubs", source: "auctionOffers", path: "playerId", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "auctionOffers", path: "clubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "auctionOffers", path: "captainApprovalIds", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "joinRequests", path: "playerId", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "joinRequests", path: "clubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "joinRequests", path: "captainApprovalIds", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "playerReviews", path: "reviewerPlayerId", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "playerReviews", path: "reviewedPlayerId", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "playerReviews", path: "clubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubRenewalDecisions", path: "clubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubRenewalDecisions", path: "retainedPlayerIds", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubRenewalDecisions", path: "captainApprovalIds", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubMatchBets", path: "clubMatchId", parentDb: "clubs", parent: "clubMatches" },
  { sourceDb: "clubs", source: "clubMatchBets", path: "playerId", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubMatchBets", path: "clubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubPlayerStats", path: "clubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubPlayerStats", path: "playerId", parentDb: "core", parent: "players" },
  { sourceDb: "clubs", source: "clubAdminAuditEvents", path: "clubId", parentDb: "clubs", parent: "clubs" },
  { sourceDb: "clubs", source: "clubSyncJobs", path: "mainMatchId", parentDb: "core", parent: "matches" },
];

const FINANCIAL_SNAPSHOTS = {
  clubs: ["balance", "committedBalance"],
  playerWallets: ["balance"],
  clubWalletTransactions: ["amount", "balanceAfter"],
  playerWalletTransactions: ["amount", "balanceAfter"],
};

const legacyWorldFilter = { worldId: null };

function flattenPathValues(value, segments) {
  if (Array.isArray(value)) return value.flatMap(item => flattenPathValues(item, segments));
  if (segments.length === 0) return value === null || value === undefined ? [] : [value];
  if (!value || typeof value !== "object") return [];
  return flattenPathValues(value[segments[0]], segments.slice(1));
}

function normalizeReferenceId(value) {
  if (value instanceof ObjectId) return value;
  const text = String(value);
  return /^[a-f\d]{24}$/i.test(text) ? new ObjectId(text) : null;
}

function databasePlanEntries(coreDb, clubsDb) {
  const entries = [
    ...CORE_BACKFILL_COLLECTIONS.map(name => ({ database: "core", db: coreDb, name, filter: {} })),
    ...CORE_CONDITIONAL_COLLECTIONS.map(item => ({ database: "core", db: coreDb, name: item.name, filter: item.filter })),
    ...CLUBS_BACKFILL_COLLECTIONS.map(name => ({ database: "clubs", db: clubsDb, name, filter: {} })),
  ];
  return entries.filter(entry => Boolean(entry.db));
}

async function collectionExists(db, name) {
  return Boolean(await db.listCollections({ name }, { nameOnly: true }).hasNext());
}

async function inventoryEntry(entry, targetWorldId) {
  if (!(await collectionExists(entry.db, entry.name))) {
    return { database: entry.database, collection: entry.name, exists: false, selectedWorld: 0, legacy: 0, otherWorld: 0, eligibleLegacy: 0 };
  }
  const collection = entry.db.collection(entry.name);
  const filter = { $and: [legacyWorldFilter, entry.filter] };
  const [selectedWorld, legacy, eligibleLegacy, otherWorld] = await Promise.all([
    collection.countDocuments({ worldId: targetWorldId }),
    collection.countDocuments(legacyWorldFilter),
    collection.countDocuments(filter),
    collection.countDocuments({
      $and: [
        { worldId: { $exists: true } },
        { worldId: { $ne: null } },
        { worldId: { $ne: targetWorldId } },
        entry.filter,
      ],
    }),
  ]);
  return {
    database: entry.database,
    collection: entry.name,
    exists: true,
    selectedWorld,
    legacy,
    eligibleLegacy,
    excludedLegacy: legacy - eligibleLegacy,
    otherWorld,
  };
}

async function findUniqueIndexCollisions(entry, targetWorldId) {
  if (!(await collectionExists(entry.db, entry.name))) return [];
  const collection = entry.db.collection(entry.name);
  const indexes = await collection.listIndexes().toArray();
  const collisions = [];

  for (const index of indexes) {
    if (!index.unique || !Object.hasOwn(index.key || {}, "worldId")) continue;
    const groupKey = {};
    for (const field of Object.keys(index.key)) groupKey[field.replaceAll(".", "_")] = "$" + field;

    const pipeline = [
      {
        $set: {
          worldId: {
            $cond: [
              { $eq: [{ $ifNull: ["$worldId", null] }, null] },
              targetWorldId,
              "$worldId",
            ],
          },
        },
      },
    ];
    if (index.partialFilterExpression) pipeline.push({ $match: index.partialFilterExpression });
    pipeline.push(
      { $group: { _id: groupKey, count: { $sum: 1 }, sampleIds: { $push: { $toString: "$_id" } } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 10 },
    );

    const options = index.collation ? { collation: index.collation } : {};
    const duplicates = await collection.aggregate(pipeline, options).toArray();
    for (const duplicate of duplicates) {
      collisions.push({
        database: entry.database,
        collection: entry.name,
        index: index.name,
        count: duplicate.count,
        sampleIds: duplicate.sampleIds.slice(0, 5),
        key: duplicate._id,
      });
    }
  }

  return collisions;
}

async function findCrossWorldReferenceConflicts(entriesByDb, targetWorldId, batchSize = 500) {
  const entryMap = new Map(entriesByDb.map(entry => [entry.database + ":" + entry.name, entry]));
  const conflicts = [];
  const orphanReferences = [];

  for (const check of REFERENCE_CHECKS) {
    const sourceEntry = entryMap.get(check.sourceDb + ":" + check.source);
    const parentEntry = entryMap.get(check.parentDb + ":" + check.parent);
    if (!sourceEntry || !parentEntry) continue;
    if (!(await collectionExists(sourceEntry.db, sourceEntry.name))) continue;
    if (!(await collectionExists(parentEntry.db, parentEntry.name))) continue;

    const cursor = sourceEntry.db.collection(sourceEntry.name)
      .find({ $and: [legacyWorldFilter, check.sourceFilter || {}] }, { projection: { [check.path]: 1 } })
      .batchSize(batchSize);
    const referencedIds = new Map();

    async function flush() {
      if (referencedIds.size === 0) return;
      const ids = [...referencedIds.values()];
      const parents = await parentEntry.db.collection(parentEntry.name)
        .find({ _id: { $in: ids } }, { projection: { _id: 1, worldId: 1 } })
        .toArray();
      const found = new Set(parents.map(parent => String(parent._id)));
      const parentWorld = new Map(parents.map(parent => [String(parent._id), parent.worldId ?? null]));

      for (const [key, originalId] of referencedIds) {
        if (!found.has(key)) {
          orphanReferences.push({
            database: check.sourceDb,
            collection: check.source,
            path: check.path,
            referencedId: key,
            parent: check.parent,
          });
          continue;
        }
        const parentWorldId = parentWorld.get(key);
        if (parentWorldId !== null && String(parentWorldId) !== String(targetWorldId)) {
          conflicts.push({
            database: check.sourceDb,
            collection: check.source,
            path: check.path,
            referencedId: key,
            parent: check.parent,
            parentWorldId: String(parentWorldId),
          });
        }
      }
      referencedIds.clear();
    }

    for await (const document of cursor) {
      for (const value of flattenPathValues(document, check.path.split("."))) {
        const id = normalizeReferenceId(value);
        if (id) referencedIds.set(String(id), id);
        if (referencedIds.size >= batchSize) await flush();
      }
    }
    await flush();
  }

  return { conflicts, orphanReferences };
}

async function financialSnapshot(db) {
  const result = {};
  for (const [name, fields] of Object.entries(FINANCIAL_SNAPSHOTS)) {
    if (!(await collectionExists(db, name))) {
      result[name] = { exists: false, count: 0 };
      continue;
    }
    const sums = Object.fromEntries(fields.map(field => [field, { $sum: { $ifNull: ["$" + field, 0] } }]));
    const rows = await db.collection(name).aggregate([
      { $group: { _id: null, count: { $sum: 1 }, ...sums } },
    ]).toArray();
    result[name] = rows[0] || { count: 0, ...Object.fromEntries(fields.map(field => [field, 0])) };
    delete result[name]._id;
  }
  return result;
}

function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

export async function inspectSingleWorldMigration({ coreDb, clubsDb, primarySlug, batchSize = 500 }) {
  if (!coreDb || !clubsDb) throw new Error("Both Core and Clubs databases are required for a complete migration inspection.");
  if (!primarySlug) throw new Error("GG_PRIMARY_WORLD_SLUG is required; the migration never creates or guesses a World.");

  const worldMatches = await coreDb.collection("worlds").find({ slug: primarySlug }).limit(2).toArray();
  if (worldMatches.length !== 1 || worldMatches[0].status !== "active") {
    throw new Error("The configured active primary World was not found uniquely. Verify the existing World record before continuing.");
  }
  const world = worldMatches[0];
  const targetWorldId = world._id;
  const entries = databasePlanEntries(coreDb, clubsDb);
  const collections = [];
  for (const entry of entries) collections.push(await inventoryEntry(entry, targetWorldId));

  const activeWorlds = await coreDb.collection("worlds")
    .find({ status: "active", _id: { $ne: targetWorldId } })
    .project({ _id: 1, name: 1, slug: 1 })
    .toArray();

  const uniqueIndexCollisions = [];
  for (const entry of entries) {
    uniqueIndexCollisions.push(...await findUniqueIndexCollisions(entry, targetWorldId));
  }

  const references = await findCrossWorldReferenceConflicts(entries, targetWorldId, batchSize);
  const financialBefore = await financialSnapshot(clubsDb);
  const otherWorldRecords = collections.filter(item => item.otherWorld > 0);

  const blockers = [];
  if (activeWorlds.length) blockers.push("Other active World records exist; resolve the single-World invariant before migrating.");
  if (otherWorldRecords.length) blockers.push("Records already assigned to a different World exist in the migration domain; preserve and reconcile them before applying.");
  if (uniqueIndexCollisions.length) blockers.push("The proposed World assignment would violate one or more existing unique indexes.");
  if (references.conflicts.length) blockers.push("Legacy records reference Player, Match or Club records already assigned to a different World.");
  if (references.orphanReferences.length) blockers.push("Legacy records contain orphaned Player, Match or Club references; reconcile them before migration.");

  return {
    mode: "READ_ONLY_PREFLIGHT",
    generatedAt: new Date().toISOString(),
    primaryWorld: {
      id: String(world._id),
      name: world.name,
      slug: world.slug,
      status: world.status,
    },
    activeOtherWorlds: activeWorlds.map(item => ({ id: String(item._id), name: item.name, slug: item.slug })),
    collections,
    uniqueIndexCollisions,
    crossWorldReferenceConflicts: references.conflicts,
    orphanReferences: references.orphanReferences.slice(0, 100),
    orphanReferenceCount: references.orphanReferences.length,
    financialSnapshot: financialBefore,
    excludedFromAutomaticBackfill: [
      "users: global account identities and legacy account-to-player links",
      "worlds, worldMemberships, worldAccessGrants: World configuration and access-control records",
      "worldMapLayouts, worldMapFacilities: World map configuration, not legacy Matchday data",
      "mediaAssets with scope=account: account-owned media remains unscoped",
    ],
    blockers,
    eligibleLegacyCount: collections.reduce((sum, item) => sum + item.eligibleLegacy, 0),
    writesPerformed: false,
  };
}

async function updateLedger(coreDb, migrationId, fields) {
  await coreDb.collection("worldMigrationRuns").updateOne(
    { _id: migrationId },
    { $set: { ...fields, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
}

async function backfillEntry(entry, targetWorldId, { batchSize, onBatch }) {
  if (!(await collectionExists(entry.db, entry.name))) return { collection: entry.name, modified: 0, batches: 0 };
  const collection = entry.db.collection(entry.name);
  const filter = { $and: [legacyWorldFilter, entry.filter] };
  let modified = 0;
  let batches = 0;

  while (true) {
    const documents = await collection.find(filter, { projection: { _id: 1 } })
      .sort({ _id: 1 })
      .limit(batchSize)
      .toArray();
    if (!documents.length) break;

    const ids = documents.map(document => document._id);
    const result = await collection.updateMany(
      { _id: { $in: ids }, $and: [legacyWorldFilter, entry.filter] },
      { $set: { worldId: targetWorldId } },
    );
    modified += result.modifiedCount;
    batches += 1;
    await onBatch?.({ modified: result.modifiedCount, batches, lastId: String(ids[ids.length - 1]) });
  }

  const remaining = await collection.countDocuments(filter);
  if (remaining !== 0) {
    throw new Error("Backfill did not converge for " + entry.database + "." + entry.name + "; remaining legacy records: " + remaining);
  }
  return { collection: entry.name, modified, batches, remaining };
}

export async function applySingleWorldMigration({
  coreDb,
  clubsDb,
  primarySlug,
  batchSize = 500,
  backupReference,
  confirmOwnership = false,
  confirmMaintenance = false,
}) {
  if (!confirmOwnership) throw new Error("Apply requires explicit confirmation that every legacy null/missing-worldId record belongs to Original GG.");
  if (!confirmMaintenance) throw new Error("Apply requires a maintenance window with application writes paused.");
  if (!backupReference || !String(backupReference).trim()) throw new Error("Apply requires a verified pre-migration backup reference.");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) throw new Error("Batch size must be an integer between 1 and 5000.");

  const plan = await inspectSingleWorldMigration({ coreDb, clubsDb, primarySlug, batchSize });
  if (plan.blockers.length) {
    const error = new Error("Migration preflight is blocked: " + plan.blockers.join(" "));
    error.preflight = plan;
    throw error;
  }

  const worldId = new ObjectId(plan.primaryWorld.id);
  const migrationId = "legacy-null-world-backfill-v1:" + String(worldId);
  await updateLedger(coreDb, migrationId, {
    migration: "legacy-null-world-backfill-v1",
    targetWorldId: worldId,
    targetWorldSlug: primarySlug,
    backupReference: String(backupReference).trim(),
    status: "running",
    startedAt: new Date(),
    preflight: {
      eligibleLegacyCount: plan.eligibleLegacyCount,
      collections: plan.collections,
    },
    lastError: "",
  });

  const entries = databasePlanEntries(coreDb, clubsDb);
  const modified = { core: {}, clubs: {} };
  try {
    for (const entry of entries) {
      await updateLedger(coreDb, migrationId, {
        currentDatabase: entry.database,
        currentCollection: entry.name,
      });
      const result = await backfillEntry(entry, worldId, {
        batchSize,
        onBatch: progress => updateLedger(coreDb, migrationId, {
          progress: {
            database: entry.database,
            collection: entry.name,
            batches: progress.batches,
            modified: progress.modified,
            lastId: progress.lastId,
          },
        }),
      });
      modified[entry.database][entry.name] = result.modified;
      await updateLedger(coreDb, migrationId, {
        ["completed." + entry.database + "." + entry.name]: {
          modified: result.modified,
          batches: result.batches,
          completedAt: new Date(),
        },
      });
    }

    const postflight = await inspectSingleWorldMigration({ coreDb, clubsDb, primarySlug, batchSize });
    const remaining = postflight.collections.filter(item => item.eligibleLegacy > 0);
    const financialAfter = postflight.financialSnapshot;
    const financialUnchanged = stableJson(plan.financialSnapshot) === stableJson(financialAfter);
    if (remaining.length || postflight.blockers.length || !financialUnchanged) {
      throw new Error("Post-migration verification failed. Remaining legacy records, new blockers, or changed financial totals were detected.");
    }

    await updateLedger(coreDb, migrationId, {
      status: "completed",
      completedAt: new Date(),
      modified,
      postflight: {
        eligibleLegacyCount: postflight.eligibleLegacyCount,
        collections: postflight.collections,
        financialSnapshot: financialAfter,
      },
      financialTotalsUnchanged: true,
      currentDatabase: null,
      currentCollection: null,
    });

    return {
      migrationId,
      targetWorld: plan.primaryWorld,
      modified,
      preflight: plan,
      postflight,
      financialTotalsUnchanged: true,
      resumable: true,
    };
  } catch (error) {
    await updateLedger(coreDb, migrationId, {
      status: "incomplete",
      lastError: error.message,
      modified,
    });
    throw error;
  }
}

function parseArguments(args) {
  const values = new Map();
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    values.set(key, rest.length ? rest.join("=") : true);
  }
  return values;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const apply = args.get("apply") === true;
  const primarySlug = String(process.env.GG_PRIMARY_WORLD_SLUG || "").trim().toLowerCase();
  const coreUri = String(process.env.MONGODB_URI || "").trim();
  const clubsUri = String(process.env.CLUBS_MONGODB_URI || "").trim();
  const batchSize = Number(args.get("batch-size") || 500);

  if (!coreUri || !clubsUri || !primarySlug) {
    throw new Error("Both MONGODB_URI, CLUBS_MONGODB_URI and GG_PRIMARY_WORLD_SLUG are required.");
  }
  if (apply) {
    if (args.get("confirm-original-gg-ownership") !== true) {
      throw new Error("Pass --confirm-original-gg-ownership to confirm the agreed legacy ownership rule.");
    }
    if (args.get("confirm-maintenance-mode") !== true) {
      throw new Error("Pass --confirm-maintenance-mode only after Matchday and Clubs writes are paused.");
    }
    if (!args.get("backup-reference")) {
      throw new Error("Pass --backup-reference=<verified-backup-id-or-location> after both database backups have been verified.");
    }
  }

  const clients = [];
  try {
    const coreClient = new MongoClient(coreUri, { readPreference: "primary", retryWrites: true });
    const clubsClient = new MongoClient(clubsUri, { readPreference: "primary", retryWrites: true });
    clients.push(coreClient, clubsClient);
    await Promise.all([coreClient.connect(), clubsClient.connect()]);
    const coreDb = coreClient.db();
    const clubsDb = clubsClient.db(String(process.env.CLUBS_DB_NAME || "").trim() || undefined);

    if (!apply) {
      const report = await inspectSingleWorldMigration({ coreDb, clubsDb, primarySlug, batchSize });
      console.log(JSON.stringify(report, null, 2));
      if (report.blockers.length) process.exitCode = 4;
      return;
    }

    const result = await applySingleWorldMigration({
      coreDb,
      clubsDb,
      primarySlug,
      batchSize,
      backupReference: args.get("backup-reference"),
      confirmOwnership: true,
      confirmMaintenance: true,
    });
    console.log(JSON.stringify({
      mode: "APPLIED_AND_VERIFIED",
      migrationId: result.migrationId,
      targetWorld: result.targetWorld,
      modified: result.modified,
      financialTotalsUnchanged: result.financialTotalsUnchanged,
      postflight: result.postflight,
      writesPerformed: true,
    }, null, 2));
  } finally {
    await Promise.allSettled(clients.map(client => client.close()));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error("Single-World migration failed:", error.message);
    if (error.preflight) console.error(JSON.stringify(error.preflight, null, 2));
    process.exitCode = 1;
  });
}
