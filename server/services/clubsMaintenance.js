import Club from "../models/clubs/Club.js";
import ClubMatch from "../models/clubs/ClubMatch.js";
import AuctionOffer from "../models/clubs/AuctionOffer.js";
import { getClubsConnection } from "../config/clubsDatabase.js";
import { CLUB_MATCH_REQUEST_TTL_HOURS } from "../config/clubsRules.js";

export async function runClubsMaintenance(now = new Date()) {
  const connection = getClubsConnection();
  if (connection.readyState !== 1) return { skipped: true };

  const requestCutoff = new Date(now.getTime() - CLUB_MATCH_REQUEST_TTL_HOURS * 60 * 60 * 1000);
  const expiredMatches = await ClubMatch.updateMany(
    { status: "requested", createdAt: { $lte: requestCutoff } },
    { $set: { status: "declined", responseDecision: "decline" } },
  );

  // Expired offers stop reserving funds before reconciliation runs. The subsequent
  // balance reconciliation is per-club and transactional with wallet writes, so a
  // concurrent reservation cannot be overwritten by a stale aggregate snapshot.
  await AuctionOffer.updateMany(
    { status: { $in: ["active", "chosenByPlayer"] }, expiresAt: { $ne: null, $lte: now } },
    { $set: { status: "cancelled", captainApprovalIds: [] } },
  );

  const cursor = Club.find({}).select("_id").lean().cursor();
  let clubsReconciled = 0;
  for await (const clubRef of cursor) {
    const session = await connection.startSession();
    let foundClub = false;
    let reservationInvariant = null;
    try {
      await session.withTransaction(async () => {
        // Read the club in the same snapshot as the offer aggregation. If a wallet
        // transaction changes this club after the snapshot, MongoDB raises a
        // write conflict and withTransaction retries with the new reservation set.
        const club = await Club.findById(clubRef._id)
          .select("_id committedBalance balance")
          .session(session)
          .lean();

        if (!club) {
          foundClub = false;
          reservationInvariant = null;
          return;
        }
        foundClub = true;

        const [reservedRow] = await AuctionOffer.aggregate([
          {
            $match: {
              clubId: club._id,
              $or: [
                { status: "active", expiresAt: { $gt: now } },
                { status: "chosenByPlayer" },
              ],
            },
          },
          { $group: { _id: "$clubId", amount: { $sum: "$amount" } } },
        ]).session(session);

        const expected = Math.round(Number(reservedRow?.amount || 0) * 100) / 100;
        reservationInvariant = Number(club.balance || 0) < expected
          ? { clubId: String(club._id), balance: Number(club.balance || 0), expected }
          : null;

        if (Math.abs(Number(club.committedBalance || 0) - expected) > 0.001) {
          await Club.updateOne(
            { _id: club._id },
            { $set: { committedBalance: expected } },
            { session },
          );
        }
      });

      if (foundClub) clubsReconciled++;
      if (reservationInvariant) {
        console.error("Club wallet reservation invariant failed for Club", reservationInvariant.clubId);
      }
    } finally {
      await session.endSession();
    }
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
