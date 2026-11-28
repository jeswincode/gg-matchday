import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import { claimsCollection, emailKey, normalizedEmail } from "../server/services/foundingLinks.js";

const database = "gg_matchday_v42_demo";

async function migrate() {
  if (!process.argv[2] || process.argv.length !== 3) throw new Error("Provide the approved identity manifest path.");
  const uri = new URL(process.env.MONGODB_URI || "file:/");
  const atlas = uri.protocol === "mongodb+srv:" && uri.hostname.endsWith(".mongodb.net") &&
    uri.hostname === process.env.V42_PREVIEW_ATLAS_HOST;
  const local = uri.protocol === "mongodb:" && uri.hostname === "127.0.0.1";
  if ((!atlas && !local) || uri.pathname !== "/" + database) throw new Error("Use the isolated V4.2 preview database.");
  const rows = JSON.parse(await readFile(process.argv[2], "utf8"));
  if (!Array.isArray(rows) || rows.length > 500) throw new Error("The approved manifest must contain up to 500 identity links.");
  const emails = new Set();
  const players = new Set();
  const sources = new Set();
  const claims = rows.map(row => {
    const email = normalizedEmail(row?.email);
    const playerId = typeof row?.playerId === "string" ? row.playerId.toLowerCase() : "";
    const sourceUid = typeof row?.firebaseUid === "string" ? row.firebaseUid.trim() : "";
    if (row?.emailVerified !== true || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^[a-f0-9]{24}$/.test(playerId) || !sourceUid || sourceUid.length > 128 || sourceUid.startsWith("e2e-test:") ||
      emails.has(email) || players.has(playerId) || sources.has(sourceUid)) {
      throw new Error("Resolve invalid or competing identity links before importing.");
    }
    emails.add(email);
    players.add(playerId);
    sources.add(sourceUid);
    return { _id: emailKey(email), playerId, sourceSubject: createHash("sha256").update(sourceUid).digest("hex") };
  });

  const client = await new MongoClient(uri.toString()).connect();
  try {
    const db = client.db(database);
    const records = db.collection(claimsCollection);
    await records.createIndex({ playerId: 1 }, { unique: true });
    await records.createIndex({ sourceSubject: 1 }, { unique: true });
    await client.withSession(session => session.withTransaction(async () => {
      const found = await db.collection("players").countDocuments({ _id: { $in: [...players].map(id => new ObjectId(id)) } }, { session });
      if (found !== players.size) throw new Error("At least one linked player is missing from the preview roster.");
      for (const claim of claims) {
        const { _id, ...identity } = claim;
        const existing = await records.findOne({ _id }, { session });
        if (existing && (existing.playerId !== identity.playerId || existing.sourceSubject !== identity.sourceSubject)) {
          throw new Error("An imported email conflicts with a previous identity link.");
        }
        await records.updateOne({ _id }, { $setOnInsert: identity }, { upsert: true, session });
      }
    }));
    console.log(JSON.stringify({ verifiedLinks: claims.length }));
  } finally { await client.close(); }
}

try {
  await migrate();
} catch {
  console.error("Import stopped. Check the isolated preview target and reconcile approved identity links before retrying.");
  process.exitCode = 1;
}
