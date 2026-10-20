import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.E2E_TEST_AUTH_SECRET ||= "gg-matchday-e2e-only-secret";
process.env.ADMIN_EMAIL = "admin@example.invalid";
process.env.GEMINI_API_KEY = "";
process.env.CHAT_ENABLED = "false";

const database = await MongoMemoryReplSet.create({
  binary: { version: "8.2.6" },
  replSet: { count: 1 },
});

await mongoose.connect(database.getUri("gg-matchday-e2e"));
process.env.CLUBS_MONGODB_URI = database.getUri("gg-matchday-clubs-e2e");

const { connectClubsDatabase, disconnectClubsDatabase } = await import("../../server/config/clubsDatabase.js");
await connectClubsDatabase();

const { default: app } = await import("../../server/app.js");
const { default: Player } = await import("../../server/models/Player.js");
const { default: Match } = await import("../../server/models/Match.js");
const { default: User } = await import("../../server/models/User.js");
const { default: Club } = await import("../../server/models/clubs/Club.js");
const { default: ClubContract } = await import("../../server/models/clubs/ClubContract.js");
const { default: ClubFormationApplication } = await import("../../server/models/clubs/ClubFormationApplication.js");
const { default: AuctionOffer } = await import("../../server/models/clubs/AuctionOffer.js");
const { default: ClubHistory } = await import("../../server/models/clubs/ClubHistory.js");
const { default: ClubAdminAuditEvent } = await import("../../server/models/clubs/ClubAdminAuditEvent.js");
const { default: ClubWalletTransaction } = await import("../../server/models/clubs/ClubWalletTransaction.js");
const { default: PlayerWallet } = await import("../../server/models/clubs/PlayerWallet.js");
const { default: PlayerWalletTransaction } = await import("../../server/models/clubs/PlayerWalletTransaction.js");

await Promise.all([
  Player.init(),
  Match.init(),
  User.init(),
  Club.init(),
  ClubContract.init(),
  ClubFormationApplication.init(),
  AuctionOffer.init(),
  ClubHistory.init(),
  ClubAdminAuditEvent.init(),
  ClubWalletTransaction.init(),
  PlayerWallet.init(),
  PlayerWalletTransaction.init(),
]);

const basePlayers = [
  { id: "65a000000000000000000001", name: "E2E Player One", position: "CM", pace: 72, physical: 70 },
  { id: "65a000000000000000000002", name: "E2E Player Two", position: "ST", pace: 80, physical: 76 },
  { id: "65a000000000000000000003", name: "E2E Player Three", position: "CB", pace: 66, physical: 82 },
  { id: "65a000000000000000000004", name: "E2E Player Four", position: "GK", pace: 55, physical: 78 },
];

// Dedicated actors keep the two multi-role browser workflows isolated from
// the older UI regression fixtures, even when Playwright retries a failed test.
const formationPlayers = [
  { id: "65a000000000000000000011", name: "E2E Formation Founder", position: "CM", pace: 88, physical: 86 },
  { id: "65a000000000000000000012", name: "E2E Formation Invitee Two", position: "ST", pace: 84, physical: 82 },
  { id: "65a000000000000000000013", name: "E2E Formation Invitee Three", position: "CB", pace: 78, physical: 84 },
  { id: "65a000000000000000000014", name: "E2E Formation Invitee Four", position: "GK", pace: 70, physical: 76 },
];
const formationRetryPlayers = [
  { id: "65a000000000000000000015", name: "E2E Formation Retry Founder", position: "CM", pace: 87, physical: 85 },
  { id: "65a000000000000000000016", name: "E2E Formation Retry Invitee Two", position: "ST", pace: 83, physical: 81 },
  { id: "65a000000000000000000017", name: "E2E Formation Retry Invitee Three", position: "CB", pace: 77, physical: 83 },
  { id: "65a000000000000000000018", name: "E2E Formation Retry Invitee Four", position: "GK", pace: 69, physical: 75 },
];
const auctionPlayers = [
  { id: "65a000000000000000000021", name: "E2E Auction Captain One", position: "CM", pace: 90, physical: 88 },
  { id: "65a000000000000000000022", name: "E2E Auction Captain Two", position: "ST", pace: 86, physical: 85 },
  { id: "65a000000000000000000023", name: "E2E Auction Member Three", position: "CB", pace: 78, physical: 85 },
  { id: "65a000000000000000000024", name: "E2E Auction Member Four", position: "GK", pace: 68, physical: 80 },
  { id: "65a000000000000000000025", name: "E2E Auction Signing Target", position: "RW", pace: 82, physical: 77 },
];
const auctionRetryPlayers = [
  { id: "65a000000000000000000026", name: "E2E Auction Retry Captain One", position: "CM", pace: 89, physical: 87 },
  { id: "65a000000000000000000027", name: "E2E Auction Retry Captain Two", position: "ST", pace: 85, physical: 84 },
  { id: "65a000000000000000000028", name: "E2E Auction Retry Member Three", position: "CB", pace: 77, physical: 84 },
  { id: "65a000000000000000000029", name: "E2E Auction Retry Member Four", position: "GK", pace: 67, physical: 79 },
  { id: "65a000000000000000000030", name: "E2E Auction Retry Signing Target", position: "RW", pace: 81, physical: 76 },
];
const adminOperationsPlayers = [
  { id: "65a000000000000000000031", name: "E2E Operations Founder", position: "CM", pace: 81, physical: 79 },
  { id: "65a000000000000000000032", name: "E2E Operations Member Two", position: "ST", pace: 80, physical: 77 },
  { id: "65a000000000000000000033", name: "E2E Operations Member Three", position: "CB", pace: 78, physical: 83 },
  { id: "65a000000000000000000034", name: "E2E Operations Member Four", position: "GK", pace: 70, physical: 80 },
];

const workflowPlayers = [
  ...formationPlayers,
  ...formationRetryPlayers,
  ...auctionPlayers,
  ...auctionRetryPlayers,
  ...adminOperationsPlayers,
];
const allPlayers = [
  ...basePlayers.map(({ id, ...player }) => ({ _id: new mongoose.Types.ObjectId(id), ...player })),
  ...workflowPlayers.map(({ id, ...player }) => ({ _id: new mongoose.Types.ObjectId(id), ...player })),
];
await Player.insertMany(allPlayers);

// Formation requires every invitee to already have a linked GG account. These
// test identities mirror the role/player mapping used by requireAuth's
// test-only header path and remain confined to this in-memory database.
await User.insertMany(workflowPlayers.map(({ id }) => ({
  firebaseUid: `e2e-test:editor:${id}`,
  name: "Playwright editor",
  email: `playwright-editor-${id}@test.invalid`,
  profileImage: "",
  role: "editor",
  accessRequest: "none",
  playerProfile: new mongoose.Types.ObjectId(id),
})));

await Club.create({
  name: "E2E My Club Regression FC",
  description: "Isolated browser regression fixture.",
  memberIds: basePlayers.map(player => new mongoose.Types.ObjectId(player.id)),
  captainIds: [new mongoose.Types.ObjectId(basePlayers[0].id)],
  status: "approved",
  balance: 300,
  committedBalance: 50,
});

async function seedAuctionClub(name, squad) {
  return Club.create({
    name,
    description: "Isolated Playwright auction workflow fixture.",
    memberIds: squad.slice(0, 4).map(player => new mongoose.Types.ObjectId(player.id)),
    captainIds: squad.slice(0, 2).map(player => new mongoose.Types.ObjectId(player.id)),
    status: "approved",
    balance: 3000,
    committedBalance: 0,
  });
}

await Promise.all([
  seedAuctionClub("E2E Auction Workflow FC", auctionPlayers),
  seedAuctionClub("E2E Auction Retry Workflow FC", auctionRetryPlayers),
]);

const adminApplicationMembers = adminOperationsPlayers.map(player => new mongoose.Types.ObjectId(player.id));
await ClubFormationApplication.create({
  founderPlayerId: adminApplicationMembers[0],
  memberIds: adminApplicationMembers,
  memberApprovals: adminApplicationMembers.map(playerId => ({ playerId, status: "accepted", respondedAt: new Date() })),
  proposedName: "E2E Operations Review FC",
  proposedNameNormalized: "e2e operations review fc",
  details: "A dedicated isolated application for testing the administrator operations queue.",
  captainCandidates: adminApplicationMembers.slice(0, 2),
  captainVotes: adminApplicationMembers.map(voterPlayerId => ({ voterPlayerId, candidatePlayerId: adminApplicationMembers[0] })),
  electedCaptainIds: [adminApplicationMembers[0]],
  detailsApprovedBy: [adminApplicationMembers[0]],
  status: "pendingAdminApproval",
});

const server = app.listen(5000, "127.0.0.1", () => {
  console.log("GG Matchday isolated Playwright API ready on port 5000");
});

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`Stopping Playwright API server (${signal})`);
  server.close(async () => {
    await Promise.allSettled([mongoose.disconnect(), disconnectClubsDatabase()]);
    await database.stop();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
