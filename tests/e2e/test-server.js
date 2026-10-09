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

await Promise.all([Player.init(), Match.init(), User.init(), Club.init()]);
const players = [
  { _id: new mongoose.Types.ObjectId("65a000000000000000000001"), name: "E2E Player One", position: "CM", pace: 72, physical: 70 },
  { _id: new mongoose.Types.ObjectId("65a000000000000000000002"), name: "E2E Player Two", position: "ST", pace: 80, physical: 76 },
  { _id: new mongoose.Types.ObjectId("65a000000000000000000003"), name: "E2E Player Three", position: "CB", pace: 66, physical: 82 },
  { _id: new mongoose.Types.ObjectId("65a000000000000000000004"), name: "E2E Player Four", position: "GK", pace: 55, physical: 78 },
];
await Player.insertMany(players);

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
