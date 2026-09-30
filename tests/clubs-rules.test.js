import test from "node:test";
import assert from "node:assert/strict";
import { calculatePredictionPercentages } from "../server/services/clubsPrediction.js";
import { calculateBetPayouts } from "../server/services/clubsBetting.js";
import {
  positiveMoney,
  nonNegativeMoney,
  activeCaptainApprovalComplete,
  validateRetention,
} from "../server/services/clubsEconomy.js";
import {
  CLUB_BETTING_MIN_STAKE,
  CLUB_BETTING_MAX_STAKE,
  CLUB_PREDICTION_WEIGHTS,
  CLUB_REWARDS,
} from "../server/config/clubsRules.js";
import {
  CLUB_FORMATIONS,
  CLUB_MAX_MEMBERS,
  CLUB_STARTING_BALANCE,
  normalizeClubName,
  nextRenewalBoundary,
  contractWindow,
  selectCaptainCandidates,
  resolveCaptainVote,
  validateClubMemberCount,
  validateFormation,
} from "../server/config/clubsRules.js";

test("Clubs economy starts every new club at 3000", () => {
  assert.equal(CLUB_STARTING_BALANCE, 3000);
  assert.equal(CLUB_MAX_MEMBERS, 4);
});

test("configured four-player formations are exactly the locked set", () => {
  assert.deepEqual([...CLUB_FORMATIONS], ["1-2-1", "2-1-1", "1-3", "3-1", "2-2"]);
  for (const formation of CLUB_FORMATIONS) {
    assert.doesNotThrow(() => validateFormation(formation));
  }
});

test("club names normalize for case and repeated whitespace", () => {
  assert.equal(normalizeClubName("  Golden   Gooners "), "golden gooners");
  assert.equal(normalizeClubName("GOLDEN GOONERS"), "golden gooners");
});

test("a club application requires exactly four unique members", () => {
  assert.deepEqual(
    validateClubMemberCount(["a", "b", "c", "d"]),
    ["a", "b", "c", "d"],
  );
  assert.throws(
    () => validateClubMemberCount(["a", "b", "c"]),
    /exactly 4/i,
  );
  assert.throws(
    () => validateClubMemberCount(["a", "b", "c", "d", "e"]),
    /exactly 4/i,
  );
});

test("contract renewal boundaries advance every two months from the first month boundary", () => {
  assert.equal(
    nextRenewalBoundary(new Date("2026-09-20T12:00:00Z")).toISOString(),
    "2026-11-01T00:00:00.000Z",
  );

  const window = contractWindow(new Date("2026-09-20T12:00:00Z"));
  assert.equal(window.start.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(window.end.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("captain candidates are the top two by OVR and a vote tie creates two captains", () => {
  const candidates = selectCaptainCandidates(
    ["a", "b", "c", "d"],
    new Map([["a", 80], ["b", 85], ["c", 70], ["d", 82]]),
  );

  assert.deepEqual(candidates, ["b", "d"]);

  assert.deepEqual(
    resolveCaptainVote(
      candidates,
      [
        { candidatePlayerId: "b", voterPlayerId: "a" },
        { candidatePlayerId: "d", voterPlayerId: "b" },
        { candidatePlayerId: "b", voterPlayerId: "c" },
        { candidatePlayerId: "d", voterPlayerId: "d" },
      ],
    ),
    ["b", "d"],
  );
});

test("wallet amount validation normalizes money and rejects invalid values", () => {
  assert.equal(positiveMoney("12.345"), 12.35);
  assert.equal(nonNegativeMoney(0), 0);
  assert.throws(() => positiveMoney(0), /greater than zero/i);
  assert.throws(() => nonNegativeMoney(-1), /zero or greater/i);
});

test("captain approval helper requires every active captain", () => {
  assert.equal(activeCaptainApprovalComplete(["a"], ["a"]), true);
  assert.equal(activeCaptainApprovalComplete(["a", "b"], ["a"]), false);
  assert.equal(activeCaptainApprovalComplete(["a", "b"], ["b", "a", "b"]), true);
});

test("renewal retention validation requires exactly two members and at least one captain", () => {
  assert.deepEqual(validateRetention(["a", "b", "c", "d"], ["a", "c"], ["a", "b"]), ["a", "c"]);
  assert.throws(
    () => validateRetention(["a", "b", "c", "d"], ["c", "d"], ["a", "b"]),
    /captain/i,
  );
  assert.throws(
    () => validateRetention(["a", "b", "c", "d"], ["a", "b", "c"], ["a"]),
    /exactly two/i,
  );
});


test("V3 Clubs economy rules expose the locked betting and reward values", () => {
  assert.equal(CLUB_BETTING_MIN_STAKE, 10);
  assert.equal(CLUB_BETTING_MAX_STAKE, 100);
  assert.equal(CLUB_PREDICTION_WEIGHTS.averagePlayerOvr, 0.30);
  assert.equal(CLUB_PREDICTION_WEIGHTS.recentForm, 0.25);
  assert.equal(CLUB_PREDICTION_WEIGHTS.averageMatchRating, 0.20);
  assert.equal(CLUB_PREDICTION_WEIGHTS.record, 0.15);
  assert.equal(CLUB_PREDICTION_WEIGHTS.headToHead, 0.10);
  assert.equal(Object.values(CLUB_PREDICTION_WEIGHTS).reduce((sum, value) => sum + value, 0), 1);
  assert.deepEqual(CLUB_REWARDS, {
    matchWin: 100,
    matchDraw: 50,
    playerAppearance: 10,
    motm: 25,
    cleanSheet: 10,
    firstMatch: 25,
    fiveAppearances: 50,
    tenAppearances: 100,
    firstWin: 50,
  });
});


test("V3 prediction percentages use locked weights and total 100%", () => {
  const result = calculatePredictionPercentages(
    { averagePlayerOvr: 90, recentForm: 1, averageMatchRating: 0.9, record: 1, headToHead: 1 },
    { averagePlayerOvr: 70, recentForm: 0, averageMatchRating: 0.5, record: 0, headToHead: 1 },
  );
  assert.equal(result.clubAPercent + result.clubBPercent, 100);
  assert.ok(result.clubAPercent > result.clubBPercent);
});

test("V3 pooled betting payouts distribute the entire stake pot exactly", () => {
  const payouts = calculateBetPayouts(
    [
      { _id: "a", clubId: "clubA", stake: 10 },
      { _id: "b", clubId: "clubA", stake: 30 },
      { _id: "c", clubId: "clubB", stake: 25 },
    ],
    "clubA",
  );
  assert.equal(payouts.get("a"), 18.75);
  assert.equal(payouts.get("b"), 56.25);
  assert.equal(payouts.get("a") + payouts.get("b"), 75);
});
