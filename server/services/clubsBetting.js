import mongoose from "mongoose";
import Club from "../models/clubs/Club.js";
import ClubContract from "../models/clubs/ClubContract.js";
import ClubMatch from "../models/clubs/ClubMatch.js";
import ClubMatchBet from "../models/clubs/ClubMatchBet.js";
import { CLUB_BETTING_MAX_STAKE, CLUB_BETTING_MIN_STAKE } from "../config/clubsRules.js";
import { debitPlayerWallet, creditPlayerWallet, positiveMoney } from "./clubsEconomy.js";

export function calculateBetPayouts(bets, winningClubId) {
  const pool = bets.reduce((sum, bet) => sum + Number(bet.stake), 0);
  const winners = bets.filter(bet => String(bet.clubId) === String(winningClubId));
  const winningStake = winners.reduce((sum, bet) => sum + Number(bet.stake), 0);
  if (!winningStake) return new Map();
  const payouts = new Map();
  let allocated = 0;
  winners.forEach((bet, index) => {
    const payout = index === winners.length - 1
      ? Math.round((pool - allocated) * 100) / 100
      : Math.floor((pool * Number(bet.stake) / winningStake) * 100) / 100;
    allocated += payout;
    payouts.set(String(bet._id), payout);
  });
  return payouts;
}

export async function placeClubMatchBet({ clubMatchId, playerId, clubId, stake, session }) {
  if (!mongoose.isValidObjectId(clubMatchId) || !mongoose.isValidObjectId(playerId) || !mongoose.isValidObjectId(clubId)) throw new Error("Invalid betting details.");
  const value = positiveMoney(stake);
  if (value < CLUB_BETTING_MIN_STAKE || value > CLUB_BETTING_MAX_STAKE) throw new Error(`Stake must be between ${CLUB_BETTING_MIN_STAKE} and ${CLUB_BETTING_MAX_STAKE} credits.`);
  const match = await ClubMatch.findById(clubMatchId).session(session);
  if (!match || match.status !== "accepted") throw new Error("Betting is available only for accepted Club Matches.");
  if (new Date(match.scheduledAt) <= new Date()) throw new Error("Betting is closed because the match has started.");
  if (![String(match.clubAId), String(match.clubBId)].includes(String(clubId))) throw new Error("Choose one of the two clubs in this fixture.");
  const playerContract = await ClubContract.findOne({ playerId, status: "active" }).session(session).lean();
  if (playerContract && [String(match.clubAId), String(match.clubBId)].includes(String(playerContract.clubId))) {
    throw new Error("You cannot bet on your own Club Match fixture.");
  }
  const club = await Club.findOne({ _id: clubId, status: "approved" }).session(session).lean();
  if (!club) throw new Error("The selected Club is not available for betting.");
  const existing = await ClubMatchBet.findOne({ clubMatchId, playerId }).session(session).lean();
  if (existing) throw new Error("You already have a bet on this Club Match.");
  const debitedPlayer = await debitPlayerWallet({ playerId, amount: value, type: "betting_stake", description: "Club Match betting stake.", session, refs: { clubId, clubMatchId }, idempotencyKey: `player-bet-stake:${clubMatchId}:${playerId}` });
  const bet = await ClubMatchBet.create([{ clubMatchId, playerId, clubId, stake: value }], { session }).then(rows => rows[0]);
  return { bet, playerWallet: debitedPlayer };
}
export async function settleClubMatchBets({ clubMatchId, session }) {
  const match = await ClubMatch.findById(clubMatchId).session(session);
  if (!match) throw new Error("Club Match not found.");
  if (!["completed", "cancelled"].includes(match.status)) {
    throw new Error("Only completed or cancelled Club Matches can settle bets.");
  }

  const bets = await ClubMatchBet.find({ clubMatchId, status: "placed" }).session(session);
  if (!bets.length) return { settled: 0, pool: 0 };

  const pool = bets.reduce((sum, bet) => sum + Number(bet.stake), 0);
  const winningClubId = match.status === "completed" ? match.winnerClubId : null;

  if (!winningClubId) {
    for (const bet of bets) {
      await creditPlayerWallet({
        playerId: bet.playerId,
        amount: bet.stake,
        type: "betting_refund",
        description: "Club Match betting refund.",
        session,
        refs: { clubMatchId },
        idempotencyKey: `club-bet-refund:${bet._id}`,
      });
      bet.status = "refunded";
      bet.payout = bet.stake;
      bet.settledAt = new Date();
      await bet.save({ session });
    }
    return { settled: bets.length, pool, refunded: pool };
  }

  const winners = bets.filter(bet => String(bet.clubId) === String(winningClubId));
  const winningStake = winners.reduce((sum, bet) => sum + Number(bet.stake), 0);

  if (!winningStake) {
    for (const bet of bets) {
      await creditPlayerWallet({
        playerId: bet.playerId,
        amount: bet.stake,
        type: "betting_refund",
        description: "Club Match betting refund because no winning bets were placed.",
        session,
        refs: { clubMatchId },
        idempotencyKey: `club-bet-no-winner-refund:${bet._id}`,
      });
      bet.status = "refunded";
      bet.payout = bet.stake;
      bet.settledAt = new Date();
      await bet.save({ session });
    }
    return { settled: bets.length, pool, refunded: pool };
  }

  const payouts = calculateBetPayouts(bets, winningClubId);

  for (const bet of bets) {
    if (String(bet.clubId) === String(winningClubId)) {
      const payout = payouts.get(String(bet._id));
      await creditPlayerWallet({
        playerId: bet.playerId,
        amount: payout,
        type: "betting_win",
        description: "Club Match betting payout.",
        session,
        refs: { clubMatchId },
        idempotencyKey: `club-bet-win:${bet._id}`,
      });
      bet.status = "won";
      bet.payout = payout;
    } else {
      bet.status = "lost";
      bet.payout = 0;
    }
    bet.settledAt = new Date();
    await bet.save({ session });
  }

  return { settled: bets.length, pool, paidToWinners: pool };
}
