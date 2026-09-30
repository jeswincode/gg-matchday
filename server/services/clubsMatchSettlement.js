import mongoose from "mongoose";
import ClubMatch from "../models/clubs/ClubMatch.js";
import ClubContract from "../models/clubs/ClubContract.js";
import Match from "../models/Match.js";
import { CLUB_REWARDS } from "../config/clubsRules.js";
import { creditClubMatchReward, creditClubWallet, creditPlayerMatchReward } from "./clubsEconomy.js";

export async function settleClubMatchRewards({ clubMatchId, session }) {
  if (!mongoose.isValidObjectId(clubMatchId)) throw new Error("Invalid club match id.");

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

  const scoreA = Number(clubMatch.clubAScore || 0);
  const scoreB = Number(clubMatch.clubBScore || 0);
  const isDraw = scoreA === scoreB;
  const winningClubId = clubMatch.winnerClubId ? String(clubMatch.winnerClubId) : null;

  if (isDraw) {
    for (const clubId of [clubMatch.clubAId, clubMatch.clubBId]) {
      await creditClubMatchReward({
        clubId,
        amount: CLUB_REWARDS.matchDraw,
        description: "Club Match draw reward.",
        session,
        mainMatchId: mainMatch._id,
        clubMatchId: clubMatch._id,
        idempotencyKey: `club-match-draw:${clubMatch._id}:${clubId}`,
      });
    }
  } else if (winningClubId) {
    await creditClubMatchReward({
      clubId: winningClubId,
      amount: CLUB_REWARDS.matchWin,
      description: "Club Match win reward.",
      session,
      mainMatchId: mainMatch._id,
      clubMatchId: clubMatch._id,
      idempotencyKey: `club-match-win:${clubMatch._id}`,
    });
  }

  const playerIds = (mainMatch.participants || [])
    .map(participant => String(participant.player?._id || participant.player))
    .filter(Boolean);

  const contracts = await ClubContract.find({
    playerId: { $in: playerIds },
    startAt: { $lte: mainMatch.date },
    endAt: { $gt: mainMatch.date },
    clubId: { $in: [clubMatch.clubAId, clubMatch.clubBId] },
    status: "active",
  }).session(session).lean();

  for (const contract of contracts) {
    const participant = (mainMatch.participants || []).find(
      item => String(item.player?._id || item.player) === String(contract.playerId),
    );
    if (!participant) continue;

    await creditPlayerMatchReward({
      playerId: contract.playerId,
      amount: CLUB_REWARDS.playerAppearance,
      description: "Club Match appearance reward.",
      session,
      clubId: contract.clubId,
      mainMatchId: mainMatch._id,
      clubMatchId: clubMatch._id,
      idempotencyKey: `club-match-appearance:${clubMatch._id}:${contract.playerId}`,
    });

    const isA = String(contract.clubId) === String(clubMatch.clubAId);
    const opponentScore = isA ? scoreB : scoreA;
    if (opponentScore === 0) {
      await creditPlayerMatchReward({
        playerId: contract.playerId,
        amount: CLUB_REWARDS.cleanSheet,
        description: "Club Match clean-sheet reward.",
        session,
        clubId: contract.clubId,
        mainMatchId: mainMatch._id,
        clubMatchId: clubMatch._id,
        idempotencyKey: `club-match-clean-sheet:${clubMatch._id}:${contract.playerId}`,
      });
    }
  }

  if (mainMatch.motmWinner) {
    const motmContract = contracts.find(
      contract => String(contract.playerId) === String(mainMatch.motmWinner),
    );
    if (motmContract) {
      await creditPlayerMatchReward({
        playerId: mainMatch.motmWinner,
        amount: CLUB_REWARDS.motm,
        description: "Club Match MOTM reward.",
        session,
        clubId: motmContract.clubId,
        mainMatchId: mainMatch._id,
        clubMatchId: clubMatch._id,
        idempotencyKey: `club-match-motm:${clubMatch._id}`,
      });
    }
  }

  const clubIds = [clubMatch.clubAId, clubMatch.clubBId];
  for (const clubId of clubIds) {
    const completedCount = await ClubMatch.countDocuments({
      status: "completed",
      $or: [{ clubAId: clubId }, { clubBId: clubId }],
      scheduledAt: { $lte: clubMatch.scheduledAt },
    }).session(session);

    const wins = await ClubMatch.countDocuments({
      status: "completed",
      winnerClubId: clubId,
      scheduledAt: { $lte: clubMatch.scheduledAt },
    }).session(session);

    if (completedCount === 1) {
      await creditClubWallet({
        clubId,
        amount: CLUB_REWARDS.firstMatch,
        type: "club_achievement",
        description: "Club achievement: first Club Match.",
        session,
        refs: { clubMatchId: clubMatch._id, mainMatchId: mainMatch._id },
        idempotencyKey: `club-achievement-first-match:${clubId}`,
      });
    }
    if (completedCount === 5) {
      await creditClubWallet({
        clubId,
        amount: CLUB_REWARDS.fiveAppearances,
        type: "club_achievement",
        description: "Club achievement: five Club Matches.",
        session,
        refs: { clubMatchId: clubMatch._id, mainMatchId: mainMatch._id },
        idempotencyKey: `club-achievement-five-matches:${clubId}`,
      });
    }
    if (completedCount === 10) {
      await creditClubWallet({
        clubId,
        amount: CLUB_REWARDS.tenAppearances,
        type: "club_achievement",
        description: "Club achievement: ten Club Matches.",
        session,
        refs: { clubMatchId: clubMatch._id, mainMatchId: mainMatch._id },
        idempotencyKey: `club-achievement-ten-matches:${clubId}`,
      });
    }
    if (wins === 1 && winningClubId === String(clubId)) {
      await creditClubWallet({
        clubId,
        amount: CLUB_REWARDS.firstWin,
        type: "club_achievement",
        description: "Club achievement: first Club Match win.",
        session,
        refs: { clubMatchId: clubMatch._id, mainMatchId: mainMatch._id },
        idempotencyKey: `club-achievement-first-win:${clubId}`,
      });
    }
  }

  clubMatch.settlementStatus = "settled";
  clubMatch.settlementAt = new Date();
  await clubMatch.save({ session });

  return { alreadySettled: false, clubMatch };
}
