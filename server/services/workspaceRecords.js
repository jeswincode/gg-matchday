import { createHash } from "node:crypto";
import mongoose from "mongoose";

const recent = new Map();
export const communityPlayerId = id => new mongoose.Types.ObjectId(createHash("sha256").update(id).digest("hex").slice(0, 24));

export function invalidateWorkspaceRecords(id) {
  recent.delete(id);
}

function asMatch(row) {
  const participants = [];
  const events = [];
  for (const p of row.performances || []) {
    const player = communityPlayerId(p.playerId);
    participants.push({ player, team: p.side === "home" ? "A" : "B", ownGoals: p.ownGoals || 0,
      rating: null, ratingSystem: "legacy" });
    for (let index = 0; index < p.goals; index++) events.push({ player, type: "goal" });
    for (let index = 0; index < p.assists; index++) events.push({ player, type: "assist" });
  }
  return {
    name: `${row.home} vs ${row.away}`.slice(0, 160), date: new Date(row.date), participants, events,
    teamA: { label: row.home, score: row.homeScore }, teamB: { label: row.away, score: row.awayScore },
    createdAt: row.createdAt, updatedAt: row.reviewedAt || row.createdAt,
  };
}

async function importRecords(id, connection) {
  const db = mongoose.connection.db;
  const players = connection.collection("players");
  const sourcePlayers = db.collection("platform_football_communityPlayers");
  const sourceProfiles = db.collection("platform_registry_globalPlayers");
  const sourceMatches = db.collection("platform_football_matches");
  const matches = connection.collection("matches");
  // A receipt and its destination match commit together. Edits and deletions
  // made in Matchday are therefore respected by later imports.
  const imports = connection.collection("preview_match_imports");
  const playerImports = connection.collection("preview_player_imports");
  for await (const entry of sourcePlayers.find({ communityId: id })) {
    await connection.getClient().withSession(session => session.withTransaction(async () => {
      const receipt = await playerImports.updateOne({ _id: entry._id }, { $setOnInsert: { importedAt: new Date() } }, { upsert: true, session });
      if (!receipt.upsertedCount) return;
      const profile = entry.globalPlayerId ? await sourceProfiles.findOne({ _id: entry.globalPlayerId }, { session }) : null;
      await players.updateOne({ _id: communityPlayerId(entry._id) }, { $setOnInsert: {
        name: entry.localName || profile?.displayName || profile?.username || "Player",
        createdAt: new Date(), updatedAt: new Date(),
      } }, { upsert: true, session });
    }));
  }
  for await (const row of sourceMatches.find({ communityId: id, status: "official" })) {
    await connection.getClient().withSession(session => session.withTransaction(async () => {
      const receipt = await imports.updateOne({ _id: row._id }, { $setOnInsert: { importedAt: new Date() } }, { upsert: true, session });
      if (!receipt.upsertedCount) return;
      await matches.insertOne({ _id: communityPlayerId(row._id), ...asMatch(row) }, { session });
    }));
  }
  await db.collection("platform_registry_workspaceActivity").updateOne({ _id: id },
    { $set: { updatedAt: new Date() } }, { upsert: true });
}

export async function importWorkspaceRecords(id, connection) {
  const active = recent.get(id);
  if (active && active.until > Date.now()) return active.task;
  const task = importRecords(id, connection).catch(error => {
    if (recent.get(id)?.task === task) recent.delete(id);
    throw error;
  });
  for (const [key, entry] of recent) if (entry.until < Date.now()) recent.delete(key);
  recent.set(id, { task, until: Date.now() + 60_000 });
  return task;
}
