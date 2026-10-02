import test from "node:test";
import assert from "node:assert/strict";
import { calculateBetPayouts } from "../server/services/clubsBetting.js";
import { CLUB_BETTING_MIN_STAKE, CLUB_BETTING_MAX_STAKE } from "../server/config/clubsRules.js";

test("Club betting uses the locked 10-100 Player Wallet stake range", () => {
  assert.equal(CLUB_BETTING_MIN_STAKE, 10);
  assert.equal(CLUB_BETTING_MAX_STAKE, 100);
});

test("winning bets split the full pool proportionally", () => {
  const bets = [
    { _id: "a", clubId: "A", stake: 20 },
    { _id: "b", clubId: "A", stake: 30 },
    { _id: "c", clubId: "B", stake: 50 },
  ];
  const payouts = calculateBetPayouts(bets, "A");
  assert.equal(payouts.get("a"), 40);
  assert.equal(payouts.get("b"), 60);
  assert.equal((payouts.get("a") || 0) + (payouts.get("b") || 0), 100);
});

test("no winning stake produces no payout map", () => {
  const payouts = calculateBetPayouts(
    [{ _id: "a", clubId: "B", stake: 50 }],
    "A",
  );
  assert.equal(payouts.size, 0);
});
