import mongoose from "mongoose";
import ClubMatch from "../models/clubs/ClubMatch.js";
import ClubContract from "../models/clubs/ClubContract.js";
import Match from "../models/Match.js";
import { CLUB_REWARDS } from "../config/clubsRules.js";
import { creditClubMatchReward, creditClubWallet, creditPlayerMatchReward } from "./clubsEconomy.js";
import { playerEvents } from "./clubCreditMarkets.js";
import { effectiveMatchRating } from "./ratings/index.js";

export function playerClubMatchReward({ goals, assists, cleanSheet, motm, rating }) {
  const ratingBonus = rating == null ? 0 : Math.min(3, Math.max(0, Math.floor(rating - 6)));
  return Math.min(CLUB_REWARDS.playerMatchCap,
    CLUB_REWARDS.playerAppearance + goals * CLUB_REWARDS.goal + assists * CLUB_REWARDS.assist +
    Number(cleanSheet) * CLUB_REWARDS.cleanSheet + Number(motm) * CLUB_REWARDS.motm + ratingBonus);
}

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

  // Match lives in the core database connection; only Clubs documents participate in this transaction.
  const mainMatch = await Match.findById(clubMatch.mainMatchId).lean();
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
  }).session(session).lean();

  for (const contract of contracts) {
    const participant = (mainMatch.participants || []).find(
      item => String(item.player?._id || item.player) === String(contract.playerId),
    );
    if (!participant) continue;

    const isA = String(contract.clubId) === String(clubMatch.clubAId);
    const events = playerEvents(mainMatch, String(contract.playerId));
    const amount = playerClubMatchReward({
      ...events,
      cleanSheet: (isA ? scoreB : scoreA) === 0,
      motm: String(mainMatch.motmWinner) === String(contract.playerId),
      rating: effectiveMatchRating(participant),
    });
    await creditPlayerMatchReward({
      playerId: contract.playerId,
      amount,
      description: "Club Match performance reward.",
      session,
      clubId: contract.clubId,
      mainMatchId: mainMatch._id,
      clubMatchId: clubMatch._id,
      idempotencyKey: `club-match-performance:${clubMatch._id}:${contract.playerId}`,
    });
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
