import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";

export const claimsCollection = "platform_registry_legacyClaims";
export const normalizedEmail = email => typeof email === "string" ? email.trim().toLowerCase() : "";
export const emailKey = email => createHash("sha256").update(normalizedEmail(email)).digest("hex");

export async function claimImportedFoundingLink(connection, { userId, firebaseUid, email }) {
  const verifiedEmail = normalizedEmail(email);
  if (!verifiedEmail) return null;
  const db = connection.db;
  const claims = db.collection(claimsCollection);
  const claimId = emailKey(verifiedEmail);
  if (!await claims.findOne({ _id: claimId }, { projection: { _id: 1 } })) return null;
  return connection.getClient().withSession(session => session.withTransaction(async () => {
    const claim = await claims.findOne({ _id: claimId }, { session });
    if (!claim || (claim.claimedBy && claim.claimedBy !== firebaseUid)) return null;
    const playerId = new ObjectId(claim.playerId);
    const user = { _id: userId, firebaseUid, playerProfile: null };
    const users = db.collection("users");
    const player = await db.collection("players").findOne({ _id: playerId }, { session, projection: { _id: 1 } });
    if (!player || await users.findOne({ playerProfile: playerId, _id: { $ne: userId } }, { session })) return null;
    const linked = await users.updateOne(user, { $set: { playerProfile: playerId } }, { session });
    if (!linked.matchedCount) return null;
    await claims.updateOne({ _id: claimId }, { $set: { claimedBy: firebaseUid, claimedAt: new Date() } }, { session });
    return playerId;
  }));
}
