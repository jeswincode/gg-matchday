import mongoose from "mongoose";
import ClubMatch from "../models/clubs/ClubMatch.js";
import Match from "../models/Match.js";
import Club from "../models/clubs/Club.js";
import { creditClubMatchReward, creditPlayerMatchReward } from "./clubsEconomy.js";

export async function settleClubMatchRewards({
  clubMatchId,
  clubReward = 0,
  motmReward = 0,
  playerReward = 0,
  session,
}) {
  if (!mongoose.isValidObjectId(clubMatchId)) throw new Error("Invalid club match id.");
  const clubAmount = Number(clubReward);
  const motmAmount = Number(motmReward);
  const playerAmount = Number(playerReward);
  for (const value of [clubAmount, motmAmount, playerAmount]) {
    if (!Number.isFinite(value) || value < 0) throw new Error("Reward amounts must be zero or greater.");
  }

  const clubMatch = await ClubMatch.findById(clubMatchId).session(session);
  if (!clubMatch) throw new Error("Club match not found.");
  if (clubMatch.status !== "completed" || !clubMatch.mainMatchId) {
    throw new Error("Only a completed Club Match linked to the main Match Record can be settled.");
  }
  if (clubMatch.settlementStatus === "settled") {
    return { alreadySettled: true, clubMatch };
  }

  const mainMatch = await Match.findById(clubMatch.mainMatchId).lean().session(session);
  if (!mainMatch) throw new Error("Linked main Match Record not found.");

  const winnerClubId = clubMatch.winnerClubId ? String(clubMatch.winnerClubId) : null;
  if (clubAmount > 0 && winnerClubId) {
    await creditClubMatchReward({
      clubId: winnerClubId,
      amount: clubAmount,
      description: "Club Match reward.",
      session,
      mainMatchId: mainMatch._id,
      clubMatchId: clubMatch._id,
      idempotencyKey: "club-match-win:" + clubMatch._id,
    });
  }

  if (motmAmount > 0 && mainMatch.motmWinner) {
    const contract = await (await import("../models/clubs/ClubContract.js")).default.findOne({
      playerId: mainMatch.motmWinner,
      startAt: { $lte: mainMatch.date },
      endAt: { $gt: mainMatch.date },
      clubId: { $in: [clubMatch.clubAId, clubMatch.clubBId] },
      status: "active",
    }).session(session).lean();
    if (contract) {
      await creditPlayerMatchReward({
        playerId: mainMatch.motmWinner,
        amount: motmAmount,
        description: "Club Match MOTM reward.",
        session,
        clubId: contract.clubId,
        mainMatchId: mainMatch._id,
        clubMatchId: clubMatch._id,
        idempotencyKey: "club-match-motm:" + clubMatch._id,
      });
    }
  }

  if (playerAmount > 0) {
    const playerIds = (mainMatch.participants || [])
      .map(participant => String(participant.player?._id || participant.player))
      .filter(Boolean);
    const Contract = (await import("../models/clubs/ClubContract.js")).default;
    const contracts = await Contract.find({
      playerId: { $in: playerIds },
      startAt: { $lte: mainMatch.date },
      endAt: { $gt: mainMatch.date },
      clubId: { $in: [clubMatch.clubAId, clubMatch.clubBId] },
      status: "active",
    }).session(session).lean();
    for (const contract of contracts) {
      await creditPlayerMatchReward({
        playerId: contract.playerId,
        amount: playerAmount,
        description: "Club Match player reward.",
        session,
        clubId: contract.clubId,
        mainMatchId: mainMatch._id,
        clubMatchId: clubMatch._id,
        idempotencyKey: "club-match-player:" + clubMatch._id + ":" + contract.playerId,
      });
    }
  }

  clubMatch.settlementStatus = "settled";
  clubMatch.settlementAt = new Date();
  await clubMatch.save({ session });
  return { alreadySettled: false, clubMatch };
}
