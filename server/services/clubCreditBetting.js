import ClubMatch from "../models/clubs/ClubMatch.js";
import { ClubCreditBank, ClubCreditBet } from "../models/clubs/ClubCreditBet.js";
import Match from "../models/Match.js";
import { CLUB_BETTING_MAX_STAKE, CLUB_BETTING_MIN_STAKE } from "../config/clubsRules.js";
import { creditPlayerWallet, debitPlayerWallet, positiveMoney } from "./clubsEconomy.js";
import { CREDIT_MARKETS, creditBetOutcome, loadCreditMarkets } from "./clubCreditMarkets.js";
import { lockBettableFixture } from "./clubsBetting.js";

const bankId = "fixed-odds";
const cents = value => Math.round(value * 100);

export async function ensureCreditBank() {
  await ClubCreditBet.init();
  await ClubCreditBank.updateOne(
    { _id: bankId },
    { $setOnInsert: { balanceCents: cents(CREDIT_MARKETS.startingBank), reservedCents: 0 } },
    { upsert: true, timestamps: false },
  );
}

export async function quoteCreditBet({ clubMatchId, selectionKey, odds, stake }) {
  const value = positiveMoney(stake);
  if (value < CLUB_BETTING_MIN_STAKE || value > CLUB_BETTING_MAX_STAKE) {
    throw new Error(`Stake must be between ${CLUB_BETTING_MIN_STAKE} and ${CLUB_BETTING_MAX_STAKE} credits.`);
  }
  const fixture = await ClubMatch.findById(clubMatchId).lean();
  const markets = await loadCreditMarkets(fixture);
  const selection = [...markets.selections, ...markets.playerGroups.flatMap(group => group.selections)]
    .find(item => item.key === selectionKey);
  if (!selection) throw new Error("That selection is no longer available. Refresh the odds.");
  if (selection.odds !== odds) throw new Error("The odds have changed. Review the new price before placing the bet.");
  return { selection, lineupVersion: fixture.lineupVersion || 0, stake: value, grossReturn: cents(value * selection.odds) / 100 };
}

export async function placeCreditBet({ clubMatchId, playerId, quote, session }) {
  const { selection, stake, grossReturn } = quote;
  // Serialize new tickets, cancellations and result writes on the same fixture.
  const fixture = await lockBettableFixture(clubMatchId, session, quote.lineupVersion);
  if (!fixture) throw new Error("The fixture or lineup changed. Refresh the odds.");
  const existing = await ClubCreditBet.find({ clubMatchId, playerId }).select("selectionKey").session(session).lean();
  if (existing.some(bet => bet.selectionKey === selection.key)) throw new Error("You already placed this selection.");
  if (existing.length >= CREDIT_MARKETS.fixtureLimit) throw new Error("You have reached the fixed-odds ticket limit for this fixture.");

  const [ticket] = await ClubCreditBet.create([{
    clubMatchId, playerId, selectionKey: selection.key, market: selection.market,
    subjectId: selection.subjectId ?? undefined, subjectName: selection.name, odds: selection.odds,
    probability: selection.probability, stake, grossReturn,
  }], { session });
  const bank = await ClubCreditBank.findOneAndUpdate({
    _id: bankId,
    $expr: { $gte: [{ $subtract: ["$balanceCents", "$reservedCents"] }, cents(grossReturn) - cents(stake)] },
  }, { $inc: { balanceCents: cents(stake), reservedCents: cents(grossReturn) } }, { session });
  if (!bank) throw new Error("The bank cannot cover that return. Try a smaller stake or a different selection.");
  const wallet = await debitPlayerWallet({
    playerId, amount: stake, session, description: "Fixed-odds Club bet stake.",
    refs: { clubMatchId }, idempotencyKey: `fixed-odds-stake:${ticket._id}`,
  });
  return { ticket, playerWallet: wallet };
}

export async function settleCreditBets({ clubMatchId, session }) {
  const tickets = await ClubCreditBet.find({ clubMatchId, status: "open" }).session(session);
  if (!tickets.length) return;
  const fixture = await ClubMatch.findById(clubMatchId).session(session).lean();
  if (!["completed", "cancelled"].includes(fixture?.status)) throw new Error("The fixture has no final outcome.");
  const match = fixture.status === "completed"
    ? await Match.findById(fixture.mainMatchId).select("participants events").lean()
    : null;
  if (fixture.status === "completed" && !match) throw new Error("The official Match Record is unavailable.");

  let reservedCents = 0, payoutCents = 0;
  for (const ticket of tickets) {
    ticket.status = creditBetOutcome(ticket, fixture, match);
    ticket.payout = ticket.status === "won" ? ticket.grossReturn : ticket.status === "refunded" ? ticket.stake : 0;
    ticket.settledAt = new Date();
    reservedCents += cents(ticket.grossReturn);
    payoutCents += cents(ticket.payout);
    if (ticket.payout) {
      await creditPlayerWallet({
        playerId: ticket.playerId, amount: ticket.payout, session,
        type: ticket.status === "won" ? "betting_win" : "betting_refund",
        description: ticket.status === "won" ? "Fixed-odds Club bet payout." : "Fixed-odds Club bet refund.",
        refs: { clubMatchId }, idempotencyKey: `fixed-odds-settlement:${ticket._id}`,
      });
    }
    await ticket.save({ session });
  }
  const bank = await ClubCreditBank.updateOne({
    _id: bankId, balanceCents: { $gte: payoutCents }, reservedCents: { $gte: reservedCents },
  }, { $inc: { balanceCents: -payoutCents, reservedCents: -reservedCents } }, { session });
  if (!bank.matchedCount) throw new Error("The fixed-odds bank could not reconcile fixture liabilities.");
}
