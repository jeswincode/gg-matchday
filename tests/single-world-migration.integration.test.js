import test from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { applySingleWorldMigration } from "../scripts/migrations/backfill-original-gg-world.mjs";

test("Original GG backfill scopes legacy Core and Clubs data, preserves finance, and safely reruns", async () => {
  const mongo = await MongoMemoryServer.create({ binary: { version: "8.2.6" } });
  const client = new MongoClient(mongo.getUri());
  try {
    await client.connect();
    const coreDb = client.db("gg-core-migration-test");
    const clubsDb = client.db("gg-clubs-migration-test");

    const worldId = new ObjectId();
    const playerA = new ObjectId();
    const playerB = new ObjectId();
    const matchId = new ObjectId();
    const clubA = new ObjectId();
    const clubB = new ObjectId();
    const clubMatchId = new ObjectId();
    const auctionOfferId = new ObjectId();

    await coreDb.collection("worlds").insertOne({
      _id: worldId, name: "Original GG", slug: "original-gg", status: "active",
    });
    await coreDb.collection("players").insertMany([
      { _id: playerA, name: "Legacy Player A", worldId: null },
      { _id: playerB, name: "Legacy Player B" },
    ]);
    await coreDb.collection("matches").insertOne({
      _id: matchId,
      worldId: null,
      participants: [{ player: playerA }, { player: playerB }],
      events: [{ player: playerA, type: "goal" }],
      motmWinner: playerA,
    });
    await coreDb.collection("awards").insertOne({
      worldId: null, player: playerA, match: matchId, category: "player-of-the-month",
    });
    await coreDb.collection("ratingDisputes").insertOne({
      worldId: null, player: playerB, match: matchId, open: true,
    });
    await coreDb.collection("mediaAssets").insertMany([
      { worldId: null, scope: "world", linkedEntityId: playerA },
      { worldId: null, scope: "account", linkedEntityId: playerA },
    ]);

    await clubsDb.collection("clubs").insertMany([
      { _id: clubA, worldId: null, name: "Legacy Club A", memberIds: [playerA, playerB], captainIds: [playerA], balance: 3000, committedBalance: 250 },
      { _id: clubB, name: "Legacy Club B", memberIds: [playerB], captainIds: [playerB], balance: 2750, committedBalance: 0 },
    ]);
    await clubsDb.collection("clubMatches").insertOne({
      _id: clubMatchId,
      worldId: null,
      clubAId: clubA,
      clubBId: clubB,
      requestedByClubId: clubA,
      winnerClubId: clubA,
      captainResponses: [{ captainId: playerA, decision: "accept" }],
      mainMatchId: matchId,
    });
    await clubsDb.collection("clubContracts").insertOne({
      worldId: null, clubId: clubA, playerId: playerA,
    });
    await clubsDb.collection("clubHistory").insertOne({
      worldId: null, clubId: clubA, playerId: playerB,
      relatedClubMatchId: clubMatchId, relatedMainMatchId: matchId,
    });
    await clubsDb.collection("auctionOffers").insertOne({
      _id: auctionOfferId, worldId: null, playerId: playerB,
      clubId: clubA, captainApprovalIds: [playerA],
    });
    await clubsDb.collection("clubWalletTransactions").insertOne({
      worldId: null, clubId: clubA, amount: -250, balanceAfter: 2750,
      mainMatchId: matchId, clubMatchId, auctionOfferId,
    });
    await clubsDb.collection("playerWallets").insertOne({
      worldId: null, playerId: playerA, balance: 500,
    });
    await clubsDb.collection("playerWalletTransactions").insertOne({
      worldId: null, playerId: playerA, clubId: clubA, amount: 50,
      balanceAfter: 500, mainMatchId: matchId, clubMatchId, auctionOfferId,
    });
    await clubsDb.collection("joinRequests").insertOne({
      worldId: null, playerId: playerB, clubId: clubA, captainApprovalIds: [playerA],
    });
    await clubsDb.collection("playerReviews").insertOne({
      worldId: null, reviewerPlayerId: playerA, reviewedPlayerId: playerB, clubId: clubA,
    });
    await clubsDb.collection("clubFormationApplications").insertOne({
      worldId: null,
      founderPlayerId: playerA,
      memberIds: [playerA, playerB],
      memberApprovals: [{ playerId: playerA }],
      captainCandidates: [playerA, playerB],
      captainVotes: [{ voterPlayerId: playerA, candidatePlayerId: playerB }],
      electedCaptainIds: [playerA],
      detailsApprovedBy: [playerB],
      approvedClubId: clubA,
    });
    await clubsDb.collection("clubRenewalDecisions").insertOne({
      worldId: null, clubId: clubA, retainedPlayerIds: [playerA], captainApprovalIds: [playerB],
    });
    await clubsDb.collection("clubMatchBets").insertOne({
      worldId: null, clubMatchId, playerId: playerA, clubId: clubA,
      stake: 25, payout: 0,
    });
    await clubsDb.collection("clubAdminAuditEvents").insertOne({
      worldId: null, clubId: clubA, action: "legacy-test", entityType: "club", entityId: clubA,
    });
    await clubsDb.collection("clubPlayerStats").insertOne({
      worldId: null, clubId: clubA, playerId: playerA,
    });
    await clubsDb.collection("clubSyncJobs").insertOne({
      worldId: null, mainMatchId: matchId,
    });

    await clubsDb.collection("clubs").createIndex(
      { worldId: 1, name: 1 }, { unique: true, name: "world_name_unique_test" },
    );

    const first = await applySingleWorldMigration({
      coreDb, clubsDb, primarySlug: "original-gg", batchSize: 2,
      backupReference: "isolated-test-backup",
      confirmOwnership: true,
      confirmMaintenance: true,
    });

    assert.equal(first.financialTotalsUnchanged, true);
    assert.equal(first.postflight.eligibleLegacyCount, 0);
    assert.ok(first.modified.core.players >= 2);
    assert.ok(first.modified.clubs.clubs >= 2);

    for (const [db, names] of [
      [coreDb, ["players", "matches", "awards", "ratingDisputes"]],
      [clubsDb, ["clubs", "clubMatches", "clubContracts", "clubHistory", "auctionOffers",
        "clubWalletTransactions", "playerWallets", "playerWalletTransactions", "joinRequests",
        "playerReviews", "clubFormationApplications", "clubRenewalDecisions", "clubMatchBets",
        "clubAdminAuditEvents", "clubPlayerStats", "clubSyncJobs"]],
    ]) {
      for (const name of names) {
        const remaining = await db.collection(name).countDocuments({ worldId: null });
        assert.equal(remaining, 0, name + " still has legacy rows");
      }
    }

    const media = await coreDb.collection("mediaAssets").find({}).sort({ scope: 1 }).toArray();
    assert.equal(media.find(item => item.scope === "world").worldId.toString(), worldId.toString());
    assert.equal(media.find(item => item.scope === "account").worldId, null);

    const second = await applySingleWorldMigration({
      coreDb, clubsDb, primarySlug: "original-gg", batchSize: 2,
      backupReference: "isolated-test-backup",
      confirmOwnership: true,
      confirmMaintenance: true,
    });
    assert.equal(second.financialTotalsUnchanged, true);
    assert.equal(second.preflight.eligibleLegacyCount, 0);
    assert.equal(second.modified.core.players || 0, 0);
    assert.equal(second.modified.clubs.clubs || 0, 0);

    const ledger = await coreDb.collection("worldMigrationRuns").findOne({
      _id: "legacy-null-world-backfill-v1:" + worldId.toString(),
    });
    assert.equal(ledger.status, "completed");
  } finally {
    await client.close();
    await mongo.stop();
  }
});
