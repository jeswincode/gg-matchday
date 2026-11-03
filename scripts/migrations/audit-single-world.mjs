import "dotenv/config";
import { MongoClient } from "mongodb";

const primarySlug = String(process.env.GG_PRIMARY_WORLD_SLUG || "").trim().toLowerCase();
const coreUri = String(process.env.MONGODB_URI || "").trim();
const clubsUri = String(process.env.CLUBS_MONGODB_URI || "").trim();
const coreCollections = [
  "players", "matches", "playerStats", "seasonStats", "news", "awards",
  "achievements", "notifications", "chatmessages", "votes",
  "profilechangerequests", "ratingDisputes",
];
const coreConditionalCollections = [{ name: "mediaAssets", filter: { scope: "world" } }];
const clubsCollections = [
  "clubs", "clubMatches", "clubContracts", "clubHistory",
  "clubWalletTransactions", "playerWallets", "playerWalletTransactions",
  "auctionOffers", "joinRequests", "playerReviews",
  "clubFormationApplications", "clubRenewalDecisions", "clubMatchBets",
  "clubAdminAuditEvents", "clubPlayerStats", "clubSyncJobs",
];

if (!coreUri || !clubsUri || !primarySlug) {
  console.error("Read-only audit requires MONGODB_URI, CLUBS_MONGODB_URI and GG_PRIMARY_WORLD_SLUG (the existing Original GG World slug).");
  process.exitCode = 2;
} else {
  const clients = [];
  try {
    const coreClient = new MongoClient(coreUri, { readPreference: "primary" });
    clients.push(coreClient);
    await coreClient.connect();
    const coreDb = coreClient.db();
    const worlds = await coreDb.collection("worlds").find({}).project({
      _id: 1, name: 1, slug: 1, status: 1, ownerUserId: 1,
    }).sort({ createdAt: 1, _id: 1 }).toArray();
    const selected = worlds.find(world => String(world.slug || "").trim().toLowerCase() === primarySlug);
    const existingCore = new Set((await coreDb.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));

    async function inventory(db, collectionNames, existingNames, selectedWorld, filters = {}) {
      const output = [];
      for (const name of collectionNames.filter(value => existingNames.has(value))) {
        const collection = db.collection(name);
        const scopeFilter = filters[name] || {};
        const [selectedCount, legacyCount, otherWorldCount] = await Promise.all([
          selectedWorld ? collection.countDocuments({ $and: [{ worldId: selectedWorld._id }, scopeFilter] }) : 0,
          collection.countDocuments({ $and: [{ $or: [{ worldId: null }, { worldId: { $exists: false } }] }, scopeFilter] }),
          selectedWorld
            ? collection.countDocuments({ $and: [{ worldId: { $exists: true, $nin: [selectedWorld._id, null] } }, scopeFilter] })
            : collection.countDocuments({ $and: [{ worldId: { $exists: true, $ne: null } }, scopeFilter] }),
        ]);
        output.push({
          collection: name,
          selectedWorld: selectedCount,
          legacyUnscoped: legacyCount,
          otherWorld: otherWorldCount,
        });
      }
      return output;
    }

    const coreInventory = await inventory(coreDb, [...coreCollections, ...coreConditionalCollections.map(item => item.name)], existingCore, selected,
      Object.fromEntries(coreConditionalCollections.map(item => [item.name, item.filter])));
    const clubsClient = new MongoClient(clubsUri, { readPreference: "primary" });
    clients.push(clubsClient);
    await clubsClient.connect();
    const clubsDb = clubsClient.db(String(process.env.CLUBS_DB_NAME || "").trim() || undefined);
    const existingClubs = new Set((await clubsDb.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
    const clubsInventory = {
      configured: true,
      database: clubsDb.databaseName,
      collections: await inventory(clubsDb, clubsCollections, existingClubs, selected),
    };

    const report = {
      mode: "READ_ONLY_DRY_RUN",
      ownershipRule: "All existing legacy documents with null or missing worldId in the listed Matchday and Clubs business collections belong to Original GG; only world-scoped media assets are included.",
      generatedAt: new Date().toISOString(),
      primarySlug,
      coreDatabase: coreDb.databaseName,
      selectedWorldFound: Boolean(selected),
      selectedWorld: selected ? {
        id: String(selected._id), name: selected.name, slug: selected.slug,
        status: selected.status, ownerUserId: selected.ownerUserId ? String(selected.ownerUserId) : null,
      } : null,
      worlds: worlds.map(world => ({
        id: String(world._id), name: world.name, slug: world.slug,
        status: world.status, ownerUserId: world.ownerUserId ? String(world.ownerUserId) : null,
      })),
      coreCollections: coreInventory,
      clubs: clubsInventory,
      writesPerformed: false,
      deletionsPerformed: false,
      migrationPerformed: false,
      warning: "Review World ownership, memberships, Player/Match references, facility layout and Clubs financial relationships before planning any production migration.",
    };
    console.log(JSON.stringify(report, null, 2));
    if (!selected) process.exitCode = 3;
  } catch (error) {
    console.error("Single-World inventory failed:", error.message);
    process.exitCode = 1;
  } finally {
    await Promise.allSettled(clients.map(client => client.close()));
  }
}
