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
const { default: ClubPlayerStats } = await import("../server/models/clubs/ClubPlayerStats.js");
const { rebuildClubPlayerStats } = await import("../server/services/clubsMatchSync.js");
const { default: Match } = await import("../server/models/Match.js");
const { default: PlayerStats } = await import("../server/models/PlayerStats.js");
const { default: SeasonStats } = await import("../server/models/SeasonStats.js");
const { clubDateKey, nextRenewalBoundary } = await import("../server/config/clubsRules.js");

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
    ClubFormationApplication.init(), ClubHistory.init(), Match.init(), PlayerStats.init(), SeasonStats.init(),
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
  assert.equal(voteResult.data.status, "pendingAdminApproval");
  assert.deepEqual(voteResult.data.electedCaptainIds.map(String), [chosenCandidate]);

  const details = await request(`/clubs/formation/${formationApplicationId}/details`, {
    method: "POST",
    playerId: chosenCandidate,
    body: { details: "HTTP integration Club formation." },
  });
  assert.equal(details.status, 200, JSON.stringify(details.data));

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
