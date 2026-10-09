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

let database;
let server;
let origin;
let players = [];

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
  ]);

  players = await Player.create(Array.from({ length: 6 }, (_, index) => ({
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

function clubIdPlaceholder() {
  // Deliberately points at the real test Club so the fixture has valid references.
  return players[0]?._id || new mongoose.Types.ObjectId();
}
