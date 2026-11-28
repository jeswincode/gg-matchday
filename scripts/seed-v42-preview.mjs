import "dotenv/config";
import mongoose from "mongoose";
import Match from "../server/models/Match.js";
import Player from "../server/models/Player.js";
import Club from "../server/models/clubs/Club.js";
import ClubContract from "../server/models/clubs/ClubContract.js";
import ClubMatch from "../server/models/clubs/ClubMatch.js";
import { connectClubsDatabase, disconnectClubsDatabase } from "../server/config/clubsDatabase.js";

const coreDatabase = "gg_matchday_v42_demo";
const clubsDatabase = "gg_matchday_v42_demo_clubs";

function verifyTarget(raw, database) {
  let uri;
  try {
    uri = new URL(raw);
  } catch {
    throw new Error("Both preview MongoDB connection strings are required.");
  }
  const loopback = uri.protocol === "mongodb:" && uri.hostname === "127.0.0.1";
  const atlas = uri.protocol === "mongodb+srv:" && uri.hostname.endsWith(".mongodb.net") &&
    uri.hostname === process.env.V42_PREVIEW_ATLAS_HOST;
  if ((!loopback && !atlas) || uri.pathname !== "/" + database) {
    throw new Error(`Expected an isolated preview MongoDB host and the database ${database}.`);
  }
}

const ids = (prefix, count) => Array.from({ length: count }, (_, index) =>
  new mongoose.Types.ObjectId((prefix + (index + 1).toString(16)).padStart(24, "0")));
const playerIds = ids("d4201", 8);
const clubIds = ids("d4202", 2);
const contractIds = ids("d4203", 8);
const [matchId] = ids("d4204", 1);
const [resultId, fixtureId] = ids("d4205", 2);
const clubNames = ["Harbour Athletic", "Floodlight Rovers"];

async function insertMissing(Model, document) {
  // Run the same model validation and normalization as a normal insert.
  const record = new Model(document);
  await record.validate();
  await Model.updateOne({ _id: record._id }, { $setOnInsert: record.toObject() },
    { upsert: true, timestamps: false });
}

async function seed() {
  const names = ["Alex Rivera", "Sam Okafor", "Jamie Park", "Taylor Das",
    "Morgan Silva", "Casey Mensah", "Riley Cruz", "Jordan Tan"];
  const positions = ["ST", "CM", "CB", "GK"];
  await Promise.all(playerIds.map((_id, index) => insertMissing(Player, {
    _id, name: names[index], position: positions[index % 4],
  })));

  const squads = clubIds.map((_, index) => playerIds.slice(index * 4, index * 4 + 4));
  const start = new Date();
  const day = 86_400_000;
  const end = new Date(start.getTime() + 30 * day);
  for (const [index, clubId] of clubIds.entries()) {
    await insertMissing(Club, {
      _id: clubId, name: clubNames[index], description: "A fictional club on the V4.2 demo grounds.",
      memberIds: squads[index], captainIds: [squads[index][0]],
      status: "approved", approvedAt: start,
    });
    await Promise.all(squads[index].map((playerId, member) => insertMissing(ClubContract, {
      _id: contractIds[index * 4 + member], clubId, playerId, startAt: start, endAt: end, source: "formation",
    })));
  }

  const date = new Date(start.getTime() - day);
  await insertMissing(Match, {
    _id: matchId, date, name: "Clubs · Opening Night",
    teamA: { label: clubNames[0], score: 2 },
    teamB: { label: clubNames[1], score: 1 },
    participants: playerIds.map((player, index) => ({
      player, team: index < 4 ? "A" : "B", rating: index % 4 === 0 ? 7.8 : 6.7,
    })),
    events: [playerIds[0], playerIds[1], playerIds[4]].map(player => ({ player, type: "goal" })),
  });

  const [clubAId, clubBId] = clubIds;
  await insertMissing(ClubMatch, {
    _id: resultId, clubAId, clubBId, scheduledAt: date, source: "unbooked",
    status: "completed", mainMatchId: matchId,
    clubAScore: 2, clubBScore: 1, winnerClubId: clubAId, settlementStatus: "settled", settlementAt: date,
  });

  const nextDate = new Date(start.getTime() + 3 * day + 5.5 * 3_600_000).toISOString().slice(0, 10);
  await insertMissing(ClubMatch, {
    _id: fixtureId, clubAId, clubBId, requestedByClubId: clubAId,
    fixtureDate: nextDate, scheduledAt: new Date(nextDate + "T00:00:00+05:30"), status: "accepted",
    responseDecision: "accept", lineupVersion: 1,
    lineups: squads.map((playerIds, index) => ({
      clubId: clubIds[index], playerIds, approvals: [playerIds[0]], confirmed: true,
    })),
  });

  console.log("V4.2 preview seed ready: eight players, two clubs, one linked result and one upcoming fixture.");
}

try {
  verifyTarget(process.env.MONGODB_URI, coreDatabase);
  verifyTarget(process.env.CLUBS_MONGODB_URI, clubsDatabase);
  if (process.env.CLUBS_DB_NAME && process.env.CLUBS_DB_NAME !== clubsDatabase) {
    throw new Error("CLUBS_DB_NAME must match the V4.2 demo Clubs database.");
  }
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

try {
  const [core, clubs] = await Promise.all([
    mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 }),
    connectClubsDatabase(),
  ]);
  if (core.connection.name !== coreDatabase || clubs?.name !== clubsDatabase) {
    throw new Error("Unexpected database target");
  }
  await seed();
} catch (error) {
  console.error("V4.2 preview seed failed.", error.name, error.code ?? "");
  process.exitCode = 1;
} finally {
  await Promise.allSettled([mongoose.disconnect(), disconnectClubsDatabase()]);
}
