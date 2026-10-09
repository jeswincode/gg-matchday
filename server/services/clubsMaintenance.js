import Club from "../models/clubs/Club.js";
import ClubMatch from "../models/clubs/ClubMatch.js";
import AuctionOffer from "../models/clubs/AuctionOffer.js";
import { getClubsConnection } from "../config/clubsDatabase.js";
import { CLUB_MATCH_REQUEST_TTL_HOURS } from "../config/clubsRules.js";

export async function runClubsMaintenance(now = new Date()) {
  if (getClubsConnection().readyState !== 1) return { skipped: true };
  const requestCutoff = new Date(now.getTime() - CLUB_MATCH_REQUEST_TTL_HOURS * 60 * 60 * 1000);
  const expiredMatches = await ClubMatch.updateMany(
    { status: "requested", createdAt: { $lte: requestCutoff } },
    { $set: { status: "declined", responseDecision: "decline" } },
  );

  await AuctionOffer.updateMany(
    { status: { $in: ["active", "chosenByPlayer"] }, expiresAt: { $ne: null, $lte: now } },
    { $set: { status: "cancelled", captainApprovalIds: [] } },
  );

  const reserved = await AuctionOffer.aggregate([
    { $match: { $or: [{ status: "active", expiresAt: { $gt: now } }, { status: "chosenByPlayer" }] } },
    { $group: { _id: "$clubId", amount: { $sum: "$amount" } } },
  ]);
  const amounts = new Map(reserved.map(row => [String(row._id), Math.round(Number(row.amount || 0) * 100) / 100]));
  const cursor = Club.find({}).select("_id committedBalance balance").lean().cursor();
  let clubsReconciled = 0;
  for await (const club of cursor) {
    const expected = amounts.get(String(club._id)) || 0;
    if (Math.abs(Number(club.committedBalance || 0) - expected) > 0.001) {
      await Club.updateOne({ _id: club._id }, { $set: { committedBalance: expected } });
    }
    if (Number(club.balance || 0) < expected) console.error("Club wallet reservation invariant failed for Club", String(club._id));
    clubsReconciled++;
  }
  return { expiredClubMatches: expiredMatches.modifiedCount || 0, clubsReconciled };
}

export function startClubsMaintenanceWorker(intervalMs = 60_000) {
  const run = async () => {
    try { await runClubsMaintenance(); }
    catch (error) { console.error("Clubs maintenance failed:", error); }
  };
  void run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}
