import test from "node:test";
import assert from "node:assert/strict";
import { creditBetOutcome, fixedOdds, resultProbabilities } from "../server/services/clubCreditMarkets.js";
import { playerClubMatchReward } from "../server/services/clubsMatchSettlement.js";

test("decimal odds increase as the modeled chance falls and results account for draws", () => {
  const result = resultProbabilities(3, 1);
  assert.ok(result.home > result.away);
  assert.ok(Math.abs(result.home + result.draw + result.away - 1) < 1e-10);
  assert.ok(fixedOdds(result.away) > fixedOdds(result.home));
  assert.equal(fixedOdds(0.001), 30);
});

test("player selections use recorded events and refund a nonparticipant", () => {
  const fixture = { status: "completed", clubAId: "a", clubBId: "b", clubAScore: 3, clubBScore: 0, winnerClubId: "a" };
  const match = {
    participants: [{ player: "scorer" }, { player: "assister" }],
    events: [{ player: "assister", type: "assist" }, ...Array.from({ length: 3 }, () => ({ player: "scorer", type: "goal" }))],
  };
  assert.equal(creditBetOutcome({ market: "hatTrick", subjectId: "scorer" }, fixture, match), "won");
  assert.equal(creditBetOutcome({ market: "assist", subjectId: "assister" }, fixture, match), "won");
  assert.equal(creditBetOutcome({ market: "goal", subjectId: "assister" }, fixture, match), "lost");
  assert.equal(creditBetOutcome({ market: "goal", subjectId: "absent" }, fixture, match), "refunded");
  assert.equal(creditBetOutcome({ market: "cleanSheet", subjectId: "a" }, fixture, match), "won");
  assert.equal(creditBetOutcome({ market: "result" }, { ...fixture, winnerClubId: null }, match), "won");
  assert.equal(creditBetOutcome({ market: "result", subjectId: "a" }, { status: "cancelled" }), "refunded");
});

test("Club player pay rewards performance and stays within its per-match cap", () => {
  const baseline = { goals: 0, assists: 0, cleanSheet: false, motm: false, rating: 6 };
  assert.equal(playerClubMatchReward(baseline), 2);
  assert.equal(playerClubMatchReward({ ...baseline, assists: 2, cleanSheet: true }), 6);
  assert.equal(playerClubMatchReward({ ...baseline, goals: 10, motm: true, rating: 10 }), 12);
});
