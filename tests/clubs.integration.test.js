import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const TEST_SECRET = "clubs-integration-secret-never-for-production";
process.env.NODE_ENV = "test";
process.env.E2E_TEST_AUTH_SECRET = TEST_SECRET;
process.env.ADMIN_EMAIL = "admin@example.invalid";
process.env.GEMINI_API_KEY = "";
process.env.CHAT_ENABLED = "true";

const { default: app } = await import("../server/app.js");
const { connectClubsDatabase, disconnectClubsDatabase } = await import("../server/config/clubsDatabase.js");
const { default: Player } = await import("../server/models/Player.js");
const { default: User } = await import("../server/models/User.js");
const { default: Club } = await import("../server/models/clubs/Club.js");
const { default: ClubContract } = await import("../server/models/clubs/ClubContract.js");
const { default: AuctionOffer } = await import("../server/models/clubs/AuctionOffer.js");
const { default: ClubWalletTransaction } = await import("../server/models/clubs/ClubWalletTransaction.js");
const { default: PlayerWallet } = await import("../server/models/clubs/PlayerWallet.js");
const { default: PlayerWalletTransaction } = await import("../server/models/clubs/PlayerWalletTransaction.js");
const { default: ClubMatch } = await import("../server/models/clubs/ClubMatch.js");
const { default: ClubFormationApplication } = await import("../server/models/clubs/ClubFormationApplication.js");
const { default: ClubHistory } = await import("../server/models/clubs/ClubHistory.js");
const { default: ClubAdminAuditEvent } = await import("../server/models/clubs/ClubAdminAuditEvent.js");
const { default: ClubPlayerStats } = await import("../server/models/clubs/ClubPlayerStats.js");
const { rebuildClubPlayerStats } = await import("../server/services/clubsMatchSync.js");
const { default: Match } = await import("../server/models/Match.js");
const { default: PlayerStats } = await import("../server/models/PlayerStats.js");
const { default: SeasonStats } = await import("../server/models/SeasonStats.js");
const { clubDateKey, nextRenewalBoundary, CLUB_REWARDS } = await import("../server/config/clubsRules.js");
const { isClubPredictionFresh, CLUB_PREDICTION_CACHE_TTL_MS } = await import("../server/services/clubsPrediction.js");
const { runClubsMaintenance } = await import("../server/services/clubsMaintenance.js");
const { settleClubMatchRewards } = await import("../server/services/clubsMatchSettlement.js");

let database;
let server;
let origin;
let players = [];
let auctionClub = null;
let formedClub = null;
let formationApplicationId = null;

async function request(path, { role = "viewer", playerId = null, token = TEST_SECRET, method = "GET", body = undefined } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token !== null) headers["X-E2E-Test-Token"] = token;
  if (role) headers["X-E2E-Test-Role"] = role;
  if (playerId) headers["X-E2E-Test-Player-Id"] = String(playerId);
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

before(async () => {
  database = await MongoMemoryReplSet.create({ binary: { version: "8.2.6" }, replSet: { count: 1 } });
  await mongoose.connect(database.getUri("matchday"));
  process.env.CLUBS_MONGODB_URI = database.getUri("clubs");
  await connectClubsDatabase();

  await Promise.all([
    Player.init(), User.init(), Club.init(), ClubContract.init(), AuctionOffer.init(),
    ClubWalletTransaction.init(), PlayerWallet.init(), PlayerWalletTransaction.init(), ClubMatch.init(),
    ClubFormationApplication.init(), ClubHistory.init(), ClubAdminAuditEvent.init(), Match.init(), PlayerStats.init(), SeasonStats.init(),
  ]);

  players = await Player.create(Array.from({ length: 10 }, (_, index) => ({
    name: `Club Integration Player ${index + 1}`,
    position: "CM",
  })));

  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 120_000 });

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  await Promise.allSettled([mongoose.disconnect(), disconnectClubsDatabase()]);
  await database?.stop();
});

test("test authentication is secret-gated and unavailable in production mode", async () => {
  assert.equal((await request("/auth/me", { token: "wrong-secret" })).status, 401);
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.equal((await request("/auth/me")).status, 401);
  } finally {
    process.env.NODE_ENV = previous;
  }
  const accepted = await request("/auth/me", { playerId: players[0]._id });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
  assert.equal(String(accepted.data.user.playerProfile), String(players[0]._id));
});

test("optional wallet ledger keys are omitted so sparse unique indexes allow multiple entries", async () => {
  const clubEntries = await ClubWalletTransaction.create([
    {
      clubId: new mongoose.Types.ObjectId(),
      type: "adjustment",
      amount: 1,
      balanceAfter: 1,
      description: "Test credit without retry key A",
    },
    {
      clubId: new mongoose.Types.ObjectId(),
      type: "adjustment",
      amount: 2,
      balanceAfter: 2,
      description: "Test credit without retry key B",
    },
  ]);
  assert.equal(clubEntries.length, 2);
  assert.ok(clubEntries.every(entry => entry.idempotencyKey === undefined));
  assert.ok(clubEntries.every(entry => !Object.hasOwn(entry.toObject(), "idempotencyKey")));

  const playerEntries = await PlayerWalletTransaction.create([
    {
      playerId: players[0]._id,
      type: "adjustment",
      amount: 1,
      balanceAfter: 1,
      description: "Test player credit without retry key A",
    },
    {
      playerId: players[1]._id,
      type: "adjustment",
      amount: 2,
      balanceAfter: 2,
      description: "Test player credit without retry key B",
    },
  ]);
  assert.equal(playerEntries.length, 2);
  assert.ok(playerEntries.every(entry => entry.idempotencyKey === undefined));
  assert.ok(playerEntries.every(entry => !Object.hasOwn(entry.toObject(), "idempotencyKey")));
});

test("Club HTTP auction flow reserves, releases, and consumes wallet commitments transactionally", async () => {
  const club = await Club.create({
    name: "Integration Budget FC",
    description: "Clubs HTTP integration test",
    memberIds: players.slice(0, 4).map(player => player._id),
    captainIds: players.slice(0, 2).map(player => player._id),
    status: "approved",
    balance: 300,
  });
  auctionClub = club;

  const ownState = await request("/clubs/auction/me", { playerId: players[0]._id });
  assert.equal(ownState.status, 200, JSON.stringify(ownState.data));
  assert.deepEqual(ownState.data.ownOffers, []);

  const offerResponse = await request("/clubs/auction/offers", {
    method: "POST",
    playerId: players[0]._id,
    body: { clubId: String(club._id), playerId: String(players[4]._id), amount: 200 },
  });
  assert.equal(offerResponse.status, 201, JSON.stringify(offerResponse.data));

  let wallet = await Club.findById(club._id).lean();
  assert.equal(wallet.balance, 300);
  assert.equal(wallet.committedBalance, 200);

  const overspend = await request("/clubs/auction/offers", {
    method: "POST",
    playerId: players[0]._id,
    body: { clubId: String(club._id), playerId: String(players[5]._id), amount: 150 },
  });
  assert.equal(overspend.status, 409, JSON.stringify(overspend.data));
  wallet = await Club.findById(club._id).lean();
  assert.equal(wallet.committedBalance, 200);

  const chosen = await request(`/clubs/auction/offers/${offerResponse.data._id}/choose`, {
    method: "POST",
    playerId: players[4]._id,
  });
  assert.equal(chosen.status, 200, JSON.stringify(chosen.data));
  assert.equal(chosen.data.status, "chosenByPlayer");

  const firstApproval = await request(`/clubs/auction/offers/${offerResponse.data._id}/approve`, {
    method: "POST",
    playerId: players[0]._id,
  });
  assert.equal(firstApproval.status, 200, JSON.stringify(firstApproval.data));
  assert.equal(firstApproval.data.pendingCaptainApproval, true);

  const finalApproval = await request(`/clubs/auction/offers/${offerResponse.data._id}/approve`, {
    method: "POST",
    playerId: players[1]._id,
  });
  assert.equal(finalApproval.status, 200, JSON.stringify(finalApproval.data));
  assert.equal(finalApproval.data.offer.status, "approved");

  wallet = await Club.findById(club._id).lean();
  assert.equal(wallet.balance, 100);
  assert.equal(wallet.committedBalance, 0);
  assert.equal(wallet.memberIds.length, 5);
  assert.ok(wallet.memberIds.some(playerId => String(playerId) === String(players[4]._id)));
  assert.ok(await ClubContract.exists({ clubId: club._id, playerId: players[4]._id, status: "active" }));
  assert.equal((await PlayerWallet.findOne({ playerId: players[4]._id }).lean()).balance, 200);
});

test("HTTP signing approval rejects an expired chosen offer before maintenance runs", async () => {
  const club = await Club.create({
    name: "Expired Offer Integration FC",
    description: "Expired signing offer regression test",
    memberIds: players.slice(0, 4).map(player => player._id),
    captainIds: players.slice(0, 2).map(player => player._id),
    status: "approved",
    balance: 300,
    committedBalance: 50,
  });
  const offer = await AuctionOffer.create({
    playerId: players[8]._id,
    clubId: club._id,
    amount: 50,
    status: "chosenByPlayer",
    expiresAt: new Date(Date.now() - 60_000),
    captainApprovalIds: [],
  });

  const response = await request(`/clubs/auction/offers/${offer._id}/approve`, {
    method: "POST",
    playerId: players[0]._id,
  });
  assert.equal(response.status, 400, JSON.stringify(response.data));
  assert.match(response.data.message, /expired/i);
  assert.equal(await ClubContract.exists({ clubId: club._id, playerId: players[8]._id, status: "active" }), null);
  const unchangedClub = await Club.findById(club._id).lean();
  assert.equal(unchangedClub.memberIds.length, 4);
  assert.equal(unchangedClub.balance, 300);
});

test("HTTP formation flow covers member approval, captain voting, and admin approval", async () => {
  const invitedPlayers = players.slice(6, 10);
  for (const player of invitedPlayers) {
    const linked = await request("/auth/me", { playerId: player._id });
    assert.equal(linked.status, 200, JSON.stringify(linked.data));
  }

  const formation = await request("/clubs/formation", {
    method: "POST",
    playerId: invitedPlayers[0]._id,
    body: { playerIds: invitedPlayers.slice(1).map(player => String(player._id)) },
  });
  assert.equal(formation.status, 201, JSON.stringify(formation.data));
  formationApplicationId = String(formation.data._id);

  for (const player of invitedPlayers.slice(1)) {
    const response = await request(`/clubs/formation/${formationApplicationId}/respond`, {
      method: "POST",
      playerId: player._id,
      body: { accept: true },
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
  }

  const named = await request(`/clubs/formation/${formationApplicationId}/name`, {
    method: "POST",
    playerId: invitedPlayers[0]._id,
    body: { name: "Integration Academy FC" },
  });
  assert.equal(named.status, 200, JSON.stringify(named.data));
  assert.equal(named.data.status, "pendingCaptainVoteSetup");

  const captainSetup = await request(`/clubs/formation/${formationApplicationId}/captain/setup`, {
    method: "POST",
    playerId: invitedPlayers[0]._id,
  });
  assert.equal(captainSetup.status, 200, JSON.stringify(captainSetup.data));
  assert.equal(captainSetup.data.captainCandidates.length, 2);
  const chosenCandidate = String(captainSetup.data.captainCandidates[0]);

  let voteResult;
  for (const player of invitedPlayers) {
    voteResult = await request(`/clubs/formation/${formationApplicationId}/captain/vote`, {
      method: "POST",
      playerId: player._id,
      body: { candidatePlayerId: chosenCandidate },
    });
    assert.equal(voteResult.status, 200, JSON.stringify(voteResult.data));
  }
  assert.equal(voteResult.data.status, "pendingCaptainDetailsApproval");
  assert.deepEqual(voteResult.data.electedCaptainIds.map(String), [chosenCandidate]);

  const earlyAdminApproval = await request(`/clubs/admin/applications/${formationApplicationId}/approve`, {
    method: "POST",
    role: "admin",
    body: {},
  });
  assert.equal(earlyAdminApproval.status, 400, JSON.stringify(earlyAdminApproval.data));
  assert.equal(await Club.exists({ name: "Integration Academy FC" }), null);

  const nonCaptain = invitedPlayers.find(player => String(player._id) !== chosenCandidate);
  const forbiddenDetails = await request(`/clubs/formation/${formationApplicationId}/details`, {
    method: "POST",
    playerId: nonCaptain._id,
    body: { details: "HTTP integration Club formation." },
  });
  assert.equal(forbiddenDetails.status, 403, JSON.stringify(forbiddenDetails.data));

  const emptyDetails = await request(`/clubs/formation/${formationApplicationId}/details`, {
    method: "POST",
    playerId: chosenCandidate,
    body: { details: "  " },
  });
  assert.equal(emptyDetails.status, 400, JSON.stringify(emptyDetails.data));

  const details = await request(`/clubs/formation/${formationApplicationId}/details`, {
    method: "POST",
    playerId: chosenCandidate,
    body: { details: "HTTP integration Club formation." },
  });
  assert.equal(details.status, 200, JSON.stringify(details.data));
  assert.equal(details.data.status, "pendingAdminApproval");
  assert.deepEqual(details.data.detailsApprovedBy.map(String), [chosenCandidate]);

  const adminApplications = await request("/clubs/admin/applications", { role: "admin" });
  assert.equal(adminApplications.status, 200, JSON.stringify(adminApplications.data));
  assert.ok(adminApplications.data.some(application => String(application._id) === formationApplicationId));

  const approved = await request(`/clubs/admin/applications/${formationApplicationId}/approve`, {
    method: "POST",
    role: "admin",
    body: {},
  });
  assert.equal(approved.status, 201, JSON.stringify(approved.data));
  formedClub = await Club.findById(approved.data._id).lean();
  assert.equal(formedClub.status, "approved");
  assert.equal(formedClub.memberIds.length, 4);
  assert.equal(formedClub.captainIds.length, 1);
  assert.ok(formedClub.captainIds.every(id => formedClub.memberIds.some(memberId => String(memberId) === String(id))));
  assert.equal(await ClubContract.countDocuments({ clubId: formedClub._id, status: "active" }), 4);
  const startingBalance = await ClubWalletTransaction.findOne({
    clubId: formedClub._id,
    type: "starting_balance",
  }).lean();
  assert.equal(startingBalance.idempotencyKey, `club-starting-balance:${formedClub._id}`);
});


test("co-captains must approve the same saved Club details before admin review", async () => {
  const roster = await Player.create(Array.from({ length: 4 }, (_, index) => ({
    name: `Co-Captain Detail Player ${index + 1}`,
    position: "CM",
  })));
  for (const player of roster) {
    const linked = await request("/auth/me", { playerId: player._id });
    assert.equal(linked.status, 200, JSON.stringify(linked.data));
  }

  const electedCaptainIds = roster.slice(0, 2).map(player => player._id);
  const application = await ClubFormationApplication.create({
    founderPlayerId: roster[0]._id,
    memberIds: roster.map(player => player._id),
    memberApprovals: roster.map(player => ({ playerId: player._id, status: "accepted", respondedAt: new Date() })),
    proposedName: "Co-Captain Details FC",
    proposedNameNormalized: "co-captain details fc",
    details: "",
    electedCaptainIds,
    detailsApprovedBy: [],
    status: "pendingCaptainDetailsApproval",
  });

  const forbidden = await request(`/clubs/formation/${application._id}/details`, {
    method: "POST",
    playerId: roster[2]._id,
    body: { details: "Club identity" },
  });
  assert.equal(forbidden.status, 403);

  const firstApproval = await request(`/clubs/formation/${application._id}/details`, {
    method: "POST",
    playerId: electedCaptainIds[0],
    body: { details: "An identity agreed by both elected captains." },
  });
  assert.equal(firstApproval.status, 200, JSON.stringify(firstApproval.data));
  assert.equal(firstApproval.data.status, "pendingCaptainDetailsApproval");
  assert.deepEqual(firstApproval.data.detailsApprovedBy.map(String), [String(electedCaptainIds[0])]);

  const blockedAdminApproval = await request(`/clubs/admin/applications/${application._id}/approve`, {
    method: "POST",
    role: "admin",
    body: {},
  });
  assert.equal(blockedAdminApproval.status, 400);
  assert.equal(await Club.exists({ name: "Co-Captain Details FC" }), null);

  // The second captain's saved text is prefilled in the UI. If that captain edits it,
  // the first captain's earlier approval is invalidated and must be recorded again.
  const secondChangesDetails = await request(`/clubs/formation/${application._id}/details`, {
    method: "POST",
    playerId: electedCaptainIds[1],
    body: { details: "An updated identity agreed by both elected captains." },
  });
  assert.equal(secondChangesDetails.status, 200, JSON.stringify(secondChangesDetails.data));
  assert.equal(secondChangesDetails.data.status, "pendingCaptainDetailsApproval");
  assert.deepEqual(secondChangesDetails.data.detailsApprovedBy.map(String), [String(electedCaptainIds[1])]);

  const firstReapproval = await request(`/clubs/formation/${application._id}/details`, {
    method: "POST",
    playerId: electedCaptainIds[0],
    body: { details: "An updated identity agreed by both elected captains." },
  });
  assert.equal(firstReapproval.status, 200, JSON.stringify(firstReapproval.data));
  assert.equal(firstReapproval.data.status, "pendingAdminApproval");
  assert.equal(firstReapproval.data.details, "An updated identity agreed by both elected captains.");
  assert.deepEqual(
    firstReapproval.data.detailsApprovedBy.map(String).sort(),
    electedCaptainIds.map(String).sort(),
  );
});

test("legacy applications cannot bypass details approval and are migrated back to the correct stage", async () => {
  const roster = await Player.create(Array.from({ length: 4 }, (_, index) => ({
    name: `Legacy Details Player ${index + 1}`,
    position: "CM",
  })));
  const captainId = roster[0]._id;
  const application = await ClubFormationApplication.create({
    founderPlayerId: captainId,
    memberIds: roster.map(player => player._id),
    memberApprovals: roster.map(player => ({ playerId: player._id, status: "accepted", respondedAt: new Date() })),
    proposedName: "Legacy Details FC",
    proposedNameNormalized: "legacy details fc",
    electedCaptainIds: [captainId],
    details: "",
    detailsApprovedBy: [],
    status: "pendingAdminApproval",
  });

  const directApproval = await request(`/clubs/admin/applications/${application._id}/approve`, {
    method: "POST",
    role: "admin",
    body: {},
  });
  assert.equal(directApproval.status, 400);
  assert.equal(await Club.exists({ name: "Legacy Details FC" }), null);

  const linked = await request("/auth/me", { playerId: captainId });
  assert.equal(linked.status, 200, JSON.stringify(linked.data));
  const ownApplications = await request("/clubs/formation/me", { playerId: captainId });
  assert.equal(ownApplications.status, 200, JSON.stringify(ownApplications.data));
  const migrated = ownApplications.data.find(row => String(row._id) === String(application._id));
  assert.equal(migrated.status, "pendingCaptainDetailsApproval");
});

test("Club prediction cache freshness enforces a bounded TTL and valid percentages", () => {
  const now = Date.parse("2026-10-14T08:00:00.000Z");
  const fresh = { clubAPercent: 65, clubBPercent: 35, generatedAt: new Date(now - 1000) };
  assert.equal(isClubPredictionFresh(fresh, now), true);
  assert.equal(isClubPredictionFresh({ ...fresh, generatedAt: new Date(now - CLUB_PREDICTION_CACHE_TTL_MS) }, now), false);
  assert.equal(isClubPredictionFresh({ ...fresh, clubBPercent: 34 }, now), false);
  assert.equal(isClubPredictionFresh({ ...fresh, clubAPercent: 101, clubBPercent: -1 }, now), false);
  assert.equal(isClubPredictionFresh({ ...fresh, generatedAt: new Date(now + 1) }, now), false);
  assert.equal(isClubPredictionFresh({ ...fresh, generatedAt: null }, now), false);
  assert.equal(isClubPredictionFresh(null, now), false);
});

test("Club fixture sync and settlement work through the HTTP routes", async () => {
  assert.ok(auctionClub, "auction Club should have been created in the prior integration test");
  assert.ok(formedClub, "formed Club should have been approved in the formation integration test");

  const futureDate = clubDateKey(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
  const currentContractEnd = nextRenewalBoundary(new Date());
  for (const player of players.slice(0, 4)) {
    const existing = await ClubContract.findOne({ playerId: player._id, status: "active" }).lean();
    if (!existing) {
      await ClubContract.create({
        clubId: auctionClub._id,
        playerId: player._id,
        startAt: new Date("2026-01-01T00:00:00.000Z"),
        endAt: currentContractEnd,
        signingAmount: 0,
        source: "formation",
        renewalNumber: 0,
      });
    }
  }

  const booking = await request("/clubs/matches", {
    method: "POST",
    playerId: players[0]._id,
    body: { clubAId: String(auctionClub._id), clubBId: String(formedClub._id), fixtureDate: futureDate },
  });
  assert.equal(booking.status, 201, JSON.stringify(booking.data));
  assert.equal(booking.data.status, "requested");

  const respondingCaptain = String(formedClub.captainIds[0]);
  const response = await request(`/clubs/matches/${booking.data._id}/respond`, {
    method: "POST",
    playerId: respondingCaptain,
    body: { accept: true },
  });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.equal(response.data.status, "accepted");

  const matchPayload = {
    date: futureDate,
    name: "Clubs Integration Fixture",
    teamA: { label: auctionClub.name, score: 1 },
    teamB: { label: formedClub.name, score: 0 },
    participants: [
      { player: String(players[0]._id), team: "A", ownGoals: 0, performanceCodes: [] },
      { player: String(players[1]._id), team: "A", ownGoals: 0, performanceCodes: [] },
      { player: String(players[6]._id), team: "B", ownGoals: 0, performanceCodes: [] },
      { player: String(players[7]._id), team: "B", ownGoals: 0, performanceCodes: [] },
    ],
    events: [{ player: String(players[0]._id), type: "goal" }],
  };
  const mainMatchResponse = await request("/matches", { method: "POST", role: "admin", body: matchPayload });
  assert.equal(mainMatchResponse.status, 201, JSON.stringify(mainMatchResponse.data));
  const refreshed = await ClubMatch.findById(booking.data._id).lean();
  assert.equal(String(refreshed.mainMatchId), String(mainMatchResponse.data.match._id));
  assert.equal(refreshed.status, "completed");
  assert.equal(refreshed.clubAScore, 1);
  assert.equal(refreshed.clubBScore, 0);

  const settle = await request(`/clubs/matches/${booking.data._id}/settle`, { method: "POST", role: "admin", body: {} });
  assert.equal(settle.status, 200, JSON.stringify(settle.data));
  const settled = await ClubMatch.findById(booking.data._id).lean();
  assert.equal(settled.settlementStatus, "settled");
  const balanceAfter = (await Club.findById(auctionClub._id).lean()).balance;
  assert.ok(balanceAfter > 100);
  const repeat = await request(`/clubs/matches/${booking.data._id}/settle`, { method: "POST", role: "admin", body: {} });
  assert.equal(repeat.status, 200, JSON.stringify(repeat.data));
  assert.equal((await Club.findById(auctionClub._id).lean()).balance, balanceAfter);
});

test("historical match rewards include an expired contract that covered the match date", async () => {
  const mainMatchDate = new Date("2026-09-10T12:00:00.000Z");
  const priorClubIds = [auctionClub?._id, formedClub?._id].filter(Boolean);
  let historicalPlayer = null;
  for (const candidate of players) {
    const hasActiveContract = await ClubContract.exists({ playerId: candidate._id, status: "active" });
    const hasExistingContractForFixtureClubs = priorClubIds.length
      ? await ClubContract.exists({
          playerId: candidate._id,
          clubId: { $in: priorClubIds },
          startAt: { $lte: mainMatchDate },
          endAt: { $gt: mainMatchDate },
        })
      : false;
    if (!hasActiveContract && !hasExistingContractForFixtureClubs) {
      historicalPlayer = candidate;
      break;
    }
  }
  assert.ok(historicalPlayer, "a test player without an active contract should be available");

  const otherMembers = players.filter(p => String(p._id) !== String(historicalPlayer._id));
  assert.ok(otherMembers.length >= 7, "enough distinct players should be available for isolated test Clubs");

  // Use new, isolated Club records: settlement also grants once-per-Club achievements,
  // so reusing Clubs from earlier integration tests would intentionally collide with
  // their already-issued first-match idempotency keys.
  const suffix = new mongoose.Types.ObjectId().toString();
  const clubAMembers = [historicalPlayer._id, ...otherMembers.slice(0, 3).map(p => p._id)];
  const clubBMembers = otherMembers.slice(3, 7).map(p => p._id);
  const historicalClubA = await Club.create({
    name: `Historical Settlement A ${suffix}`,
    memberIds: clubAMembers,
    captainIds: [historicalPlayer._id],
    balance: 3000,
    committedBalance: 0,
    status: "approved",
  });
  const historicalClubB = await Club.create({
    name: `Historical Settlement B ${suffix}`,
    memberIds: clubBMembers,
    captainIds: [clubBMembers[0]],
    balance: 3000,
    committedBalance: 0,
    status: "approved",
  });
  const otherPlayer = otherMembers[7] || otherMembers[0];

  const beforeWallet = await PlayerWallet.findOne({ playerId: historicalPlayer._id }).lean();
  const beforeBalance = Number(beforeWallet?.balance || 0);

  await ClubContract.create({
    clubId: historicalClubA._id,
    playerId: historicalPlayer._id,
    startAt: new Date("2026-08-01T00:00:00.000Z"),
    endAt: new Date("2026-10-01T00:00:00.000Z"),
    status: "expired",
    signingAmount: 0,
    source: "formation",
    renewalNumber: 0,
  });

  const mainMatch = await Match.create({
    date: mainMatchDate,
    name: "Historical Contract Settlement Regression",
    teamA: { label: historicalClubA.name, score: 1 },
    teamB: { label: historicalClubB.name, score: 0 },
    participants: [
      { player: historicalPlayer._id, team: "A", rating: 8, defensivePerformance: 8, ownGoals: 0, performanceCodes: [] },
      { player: otherPlayer._id, team: "B", rating: 7, defensivePerformance: 7, ownGoals: 0, performanceCodes: [] },
    ],
    events: [{ player: historicalPlayer._id, type: "goal" }],
  });

  const clubMatch = await ClubMatch.create({
    clubAId: historicalClubA._id,
    clubBId: historicalClubB._id,
    scheduledAt: new Date("2026-09-10T00:00:00.000Z"),
    fixtureDate: "2026-09-10",
    source: "unbooked",
    status: "completed",
    mainMatchId: mainMatch._id,
    winnerClubId: historicalClubA._id,
    clubAScore: 1,
    clubBScore: 0,
    settlementStatus: "pending",
  });

  const session = await Club.db.startSession();
  try {
    await session.withTransaction(async () => {
      await settleClubMatchRewards({ clubMatchId: clubMatch._id, session });
    });
  } finally {
    await session.endSession();
  }

  const afterWallet = await PlayerWallet.findOne({ playerId: historicalPlayer._id }).lean();
  const expectedReward = CLUB_REWARDS.playerAppearance + CLUB_REWARDS.cleanSheet;
  assert.equal(Number(afterWallet?.balance || 0) - beforeBalance, expectedReward);

  const ledgerEntries = await PlayerWalletTransaction.find({
    playerId: historicalPlayer._id,
    clubMatchId: clubMatch._id,
  }).lean();
  assert.deepEqual(
    ledgerEntries.map(entry => entry.amount).sort((a, b) => a - b),
    [CLUB_REWARDS.playerAppearance, CLUB_REWARDS.cleanSheet].sort((a, b) => a - b),
  );
});

test("Club player-history ratings use effectiveMatchRating for legacy own-goal records", async () => {
  const linkedClubMatch = await ClubMatch.findOne({
    status: "completed",
    mainMatchId: { $ne: null },
    $or: [{ clubAId: auctionClub._id }, { clubBId: auctionClub._id }],
  }).lean();
  assert.ok(linkedClubMatch, "the prior fixture-sync test should have linked a Club Match");

  const mainMatch = await Match.findById(linkedClubMatch.mainMatchId);
  const participant = mainMatch.participants.find(item => String(item.player) === String(players[0]._id));
  assert.ok(participant, "the auction Club player should be part of the linked Match");
  participant.rating = 8;
  participant.ratingSystem = "legacy";
  participant.ownGoals = 1;
  await mainMatch.save();

  await rebuildClubPlayerStats(auctionClub._id);
  const stats = await ClubPlayerStats.findOne({
    clubId: auctionClub._id,
    playerId: players[0]._id,
  }).lean();
  assert.ok(stats);
  assert.equal(stats.ratedMatches, 1);
  assert.equal(stats.ratingTotal, 7, "the legacy own-goal penalty must be applied once in Club history");
});

test("GET player attributes is read-only when there is no current snapshot", async () => {
  const player = players[9];
  const before = await Player.findById(player._id).select("ovrSnapshot").lean();
  const response = await request(`/players/${player._id}/attributes`);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  const after = await Player.findById(player._id).select("ovrSnapshot").lean();
  assert.deepEqual(after?.ovrSnapshot, before?.ovrSnapshot);
});

test("GET Player Wallet is read-only when the wallet has not been created yet", async () => {
  const [player] = await Player.create([{ name: "Wallet Readonly Regression Player", position: "CM" }]);
  assert.equal(await PlayerWallet.exists({ playerId: player._id }), null);
  const response = await request("/clubs/wallet/me", { playerId: player._id });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.equal(Number(response.data.wallet.balance), 0);
  assert.equal(await PlayerWallet.exists({ playerId: player._id }), null);
});

test("GET Club wallet uses the route called by the My Club dashboard and restricts access to members", async () => {
  const club = await Club.create({
    name: "Club Wallet Route Regression FC",
    description: "Regression test for the My Club wallet endpoint path.",
    memberIds: players.slice(0, 4).map(player => player._id),
    captainIds: players.slice(0, 2).map(player => player._id),
    status: "approved",
    balance: 300,
    committedBalance: 75,
  });

  const response = await request(`/clubs/${club._id}/wallet`, { playerId: players[0]._id });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.equal(String(response.data.club._id), String(club._id));
  assert.equal(Number(response.data.club.balance), 300);
  assert.equal(Number(response.data.club.committedBalance), 75);
  assert.equal(Number(response.data.club.availableBalance), 225);
  assert.ok(Array.isArray(response.data.transactions));

  const nonMemberResponse = await request(`/clubs/${club._id}/wallet`, { playerId: players[8]._id });
  assert.equal(nonMemberResponse.status, 403, JSON.stringify(nonMemberResponse.data));
});

test("GET Club Matches is read-only and does not expire stale requests", async () => {
  const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const matchId = new mongoose.Types.ObjectId();
  await ClubMatch.collection.insertOne({
    _id: matchId,
    clubAId: new mongoose.Types.ObjectId(),
    clubBId: new mongoose.Types.ObjectId(),
    requestedByClubId: null,
    fixtureDate: "2026-10-01",
    scheduledAt: oldDate,
    source: "booked",
    status: "requested",
    createdAt: oldDate,
    updatedAt: oldDate,
  });

  const response = await request("/clubs/matches");
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.ok(response.data.some(match => String(match._id) === String(matchId)));
  const stored = await ClubMatch.collection.findOne({ _id: matchId });
  assert.equal(stored.status, "requested");
});

test("Club model refuses duplicate members and non-member captains", async () => {
  await assert.rejects(
    Club.create({
      name: "Invalid Duplicate Roster",
      status: "approved",
      memberIds: [players[0]._id, players[0]._id, players[2]._id, players[3]._id],
      captainIds: [players[0]._id],
      balance: 300,
    }),
    /validation|duplicate/i,
  );
  await assert.rejects(
    Club.create({
      name: "Invalid Captain Roster",
      status: "approved",
      memberIds: players.slice(0, 4).map(player => player._id),
      captainIds: [players[5]._id],
      balance: 300,
    }),
    /validation|captain|member/i,
  );
});


test("player deletion preserves profiles referenced by Ultimate Clubs history", async () => {
  const [historicalPlayer] = await Player.create([{
    name: "Club History Protected Player",
    position: "CM",
  }]);
  await ClubHistory.create({
    clubId: auctionClub._id,
    eventType: "memberJoined",
    playerId: historicalPlayer._id,
    description: "Historical reference that must survive player-management operations.",
  });

  const response = await request(`/players/${historicalPlayer._id}`, {
    method: "DELETE",
    role: "editor",
  });
  assert.equal(response.status, 409, JSON.stringify(response.data));
  assert.match(response.data.message, /Ultimate Clubs history/i);
  assert.ok(await Player.exists({ _id: historicalPlayer._id }));
});


test("maintenance reconciliation cannot overwrite a wallet reservation committed after its snapshot", async () => {
  const raceMembers = await Player.create(Array.from({ length: 5 }, (_, index) => ({
    name: `Maintenance Race Member ${index + 1}`,
    position: "CM",
  })));
  const targetPlayer = await Player.create({ name: "Maintenance Race Target", position: "ST" });
  const club = await Club.create({
    name: "Reservation Reconciliation Race FC",
    description: "Deterministic maintenance concurrency regression",
    memberIds: raceMembers.slice(0, 4).map(player => player._id),
    captainIds: [raceMembers[0]._id],
    status: "approved",
    balance: 300,
    committedBalance: 100,
  });
  await AuctionOffer.create({
    playerId: targetPlayer._id,
    clubId: club._id,
    amount: 100,
    status: "chosenByPlayer",
    expiresAt: new Date(Date.now() - 60_000),
  });

  const originalAggregate = AuctionOffer.aggregate;
  let intercepted = false;
  let signalAggregateReady;
  let releaseAggregate;
  const aggregateReady = new Promise(resolve => { signalAggregateReady = resolve; });
  const aggregateGate = new Promise(resolve => { releaseAggregate = resolve; });

  AuctionOffer.aggregate = function (pipeline, ...args) {
    const aggregate = originalAggregate.call(this, pipeline, ...args);
    const targetMatch = String(pipeline?.[0]?.$match?.clubId || "") === String(club._id);
    if (targetMatch && !intercepted) {
      intercepted = true;
      const originalExec = aggregate.exec.bind(aggregate);
      aggregate.exec = async (...execArgs) => {
        const rows = await originalExec(...execArgs);
        signalAggregateReady();
        await aggregateGate;
        return rows;
      };
    }
    return aggregate;
  };

  const maintenancePromise = runClubsMaintenance();
  let offerResponse;
  let timeoutHandle;
  try {
    await Promise.race([
      aggregateReady,
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("Maintenance did not reach the reservation snapshot.")), 15_000);
      }),
    ]);
    clearTimeout(timeoutHandle);

    offerResponse = await request("/clubs/auction/offers", {
      method: "POST",
      playerId: raceMembers[0]._id,
      body: { clubId: String(club._id), playerId: String(targetPlayer._id), amount: 50 },
    });
    assert.equal(offerResponse.status, 201, JSON.stringify(offerResponse.data));
  } finally {
    clearTimeout(timeoutHandle);
    releaseAggregate();
    AuctionOffer.aggregate = originalAggregate;
  }

  await maintenancePromise;
  const activeOffers = await AuctionOffer.find({
    clubId: club._id,
    $or: [
      { status: "active", expiresAt: { $gt: new Date() } },
      { status: "chosenByPlayer" },
    ],
  }).lean();
  const expectedReserved = Math.round(activeOffers.reduce((sum, offer) => sum + Number(offer.amount || 0), 0) * 100) / 100;
  const reconciled = await Club.findById(club._id).lean();
  assert.equal(expectedReserved, 50);
  assert.equal(Number(reconciled.committedBalance), expectedReserved);
  assert.equal(Number(reconciled.balance), 300);
});


test("maintenance cancels legacy chosen offers without expiry and releases their reservation", async () => {
  const [targetPlayer] = await Player.create([{
    name: "Legacy Reservation Reconciliation Target",
    position: "ST",
  }]);
  const club = await Club.create({
    name: "Legacy Reservation Reconciliation FC",
    description: "Release unapprovable legacy offer reservation",
    memberIds: players.slice(0, 4).map(player => player._id),
    captainIds: [players[0]._id],
    status: "approved",
    balance: 300,
    committedBalance: 75,
  });
  const offer = await AuctionOffer.create({
    playerId: targetPlayer._id,
    clubId: club._id,
    amount: 75,
    status: "chosenByPlayer",
    expiresAt: null,
    captainApprovalIds: [],
  });

  const result = await runClubsMaintenance();
  const reconciledOffer = await AuctionOffer.findById(offer._id).lean();
  const reconciledClub = await Club.findById(club._id).lean();

  assert.equal(reconciledOffer.status, "cancelled");
  assert.ok(result.expiredAuctionOffers >= 1);
  assert.equal(Number(reconciledClub.balance), 300);
  assert.equal(Number(reconciledClub.committedBalance), 0);
});



test("Clubs operations endpoints require an administrator and return bounded persisted-state summaries", async () => {
  const unauthenticated = await request("/clubs/admin/operations/summary", { token: null, role: null });
  assert.equal(unauthenticated.status, 401);
  const viewer = await request("/clubs/admin/operations/summary", { role: "viewer", playerId: players[9]._id });
  assert.equal(viewer.status, 403);
  const summary = await request("/clubs/admin/operations/summary", { role: "admin" });
  assert.equal(summary.status, 200, JSON.stringify(summary.data));
  assert.equal(summary.data.success, true);
  assert.ok(summary.data.generatedAt);
  assert.ok(Number.isFinite(summary.data.queueCount));
  assert.ok(Number.isFinite(summary.data.counts.pendingApplications));
  assert.equal(summary.data.telemetry.providerHealth, "not-instrumented-in-this-subsystem");

  const queue = await request("/clubs/admin/operations/queue?limit=5&page=1&sort=priority", { role: "admin" });
  assert.equal(queue.status, 200, JSON.stringify(queue.data));
  assert.ok(Array.isArray(queue.data.items));
  assert.ok(queue.data.items.length <= 5);
  assert.equal(queue.data.pagination.limit, 5);
  assert.deepEqual(queue.data.filters, { type: "", severity: "", status: "", age: "", club: "", search: "", sort: "priority" });

  const invalidFilter = await request("/clubs/admin/operations/queue?severity=explode", { role: "admin" });
  assert.equal(invalidFilter.status, 200);
  assert.equal(invalidFilter.data.filters.severity, "");

  const tooLarge = await request("/clubs/admin/operations/queue?limit=500000", { role: "admin" });
  assert.equal(tooLarge.status, 200);
  assert.equal(tooLarge.data.pagination.limit, 100);

  const invalidActivityDate = await request("/clubs/admin/operations/activity?before=not-a-date", { role: "admin" });
  assert.equal(invalidActivityDate.status, 400);

  const activity = await request("/clubs/admin/operations/activity?limit=5&page=1", { role: "admin" });
  assert.equal(activity.status, 200, JSON.stringify(activity.data));
  assert.ok(Array.isArray(activity.data.items));
});

test("Club admin audit events record actual administrator actions and can be filtered by outcome", async () => {
  const club = await Club.create({
    name: "Operations Audit Formation FC",
    description: "Formation approval audit fixture.",
    memberIds: players.slice(0, 4).map(player => player._id),
    captainIds: [players[0]._id],
    status: "approved",
    balance: 300,
  });
  const event = await ClubAdminAuditEvent.create({
    actorName: "Integration Admin",
    actorEmail: "admin@example.invalid",
    actorRole: "admin",
    action: "test-audit",
    entityType: "club",
    entityId: club._id,
    clubId: club._id,
    previousStatus: "pending",
    nextStatus: "approved",
    outcome: "success",
    reason: "Persisted test event.",
    requestId: "request-test-ops",
  });
  const response = await request("/clubs/admin/operations/activity?outcome=success&limit=10", { role: "admin" });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.ok(response.data.items.some(item => item.id === String(event._id) && item.action === "test-audit"));
  const filtered = await request("/clubs/admin/operations/activity?outcome=failed&limit=10", { role: "admin" });
  assert.equal(filtered.status, 200);
  assert.ok(filtered.data.items.every(item => item.outcome === "failed"));
});

test("maintenance cancels legacy active offers without expiry and releases their reservation", async () => {
  const [targetPlayer] = await Player.create([{
    name: "Legacy Active Reservation Target",
    position: "ST",
  }]);
  const club = await Club.create({
    name: "Legacy Active Reservation FC",
    description: "Release an unselectable active offer without expiry",
    memberIds: players.slice(0, 4).map(player => player._id),
    captainIds: [players[0]._id],
    status: "approved",
    balance: 300,
    committedBalance: 40,
  });
  const offer = await AuctionOffer.create({
    playerId: targetPlayer._id,
    clubId: club._id,
    amount: 40,
    status: "active",
    expiresAt: null,
    captainApprovalIds: [],
  });

  const result = await runClubsMaintenance();
  const reconciledOffer = await AuctionOffer.findById(offer._id).lean();
  const reconciledClub = await Club.findById(club._id).lean();

  assert.equal(reconciledOffer.status, "cancelled");
  assert.ok(result.expiredAuctionOffers >= 1);
  assert.equal(Number(reconciledClub.balance), 300);
  assert.equal(Number(reconciledClub.committedBalance), 0);
});
