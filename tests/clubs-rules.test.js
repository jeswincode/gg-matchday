import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { calculatePredictionPercentages } from "../server/services/clubsPrediction.js";
import { calculateBetPayouts } from "../server/services/clubsBetting.js";
import {
  positiveMoney,
  nonNegativeMoney,
  activeCaptainApprovalComplete,
  validateRetention,
  availableClubBalance,
} from "../server/services/clubsEconomy.js";
import {
  CLUB_BETTING_MIN_STAKE,
  CLUB_BETTING_MAX_STAKE,
  CLUB_PREDICTION_WEIGHTS,
  CLUB_REWARDS,
  CLUB_AUCTION_MIN_BID,
  CLUB_AUCTION_BID_INCREMENT,
  CLUB_AUCTION_OFFER_DURATION_HOURS,
  CLUB_MATCH_REQUEST_TTL_HOURS,
  auctionOfferExpiry,
  validateAuctionBid,
  clubMatchRequestExpiry,
  normalizeFixtureDate,
  clubDateKey,
  clubDateStartUtc,
  CLUBS_TIME_ZONE,
} from "../server/config/clubsRules.js";
import {
  CLUB_FORMATIONS,
  CLUB_MIN_MEMBERS,
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
  assert.equal(CLUB_MIN_MEMBERS, 4);
  assert.equal(CLUB_MAX_MEMBERS, 5);
});

test("Club formation sets cover both four-player and five-player squads", () => {
  assert.deepEqual([...CLUB_FORMATIONS], [
    "1-2-1", "2-1-1", "1-3", "3-1", "2-2",
    "1-2-2", "2-2-1", "2-1-2", "1-3-1", "3-1-1",
  ]);
  for (const formation of CLUB_FORMATIONS) {
    assert.doesNotThrow(() => validateFormation(formation));
  }
});

test("club names normalize for case and repeated whitespace", () => {
  assert.equal(normalizeClubName("  Golden   Gooners "), "golden gooners");
  assert.equal(normalizeClubName("GOLDEN GOONERS"), "golden gooners");
});

test("a club application accepts exactly four or five unique members", () => {
  assert.deepEqual(
    validateClubMemberCount(["a", "b", "c", "d"]),
    ["a", "b", "c", "d"],
  );
  assert.deepEqual(
    validateClubMemberCount(["a", "b", "c", "d", "e"]),
    ["a", "b", "c", "d", "e"],
  );
  assert.throws(
    () => validateClubMemberCount(["a", "b", "c"]),
    /between 4 and 5/i,
  );
  assert.throws(
    () => validateClubMemberCount(["a", "b", "c", "d", "e", "f"]),
    /between 4 and 5/i,
  );
  assert.throws(
    () => validateClubMemberCount(["a", "b", "c", "d", "d"]),
    /unique/i,
  );
});

test("contract renewal boundaries advance every two months from the first month boundary", () => {
  assert.equal(
    nextRenewalBoundary(new Date("2026-09-20T12:00:00Z")).toISOString(),
    "2026-10-31T18:30:00.000Z",
  );

  const window = contractWindow(new Date("2026-09-20T12:00:00Z"));
  assert.equal(window.start.toISOString(), "2026-10-31T18:30:00.000Z");
  assert.equal(window.end.toISOString(), "2026-12-31T18:30:00.000Z");
});

test("captain candidates are top two by OVR and a five-member vote can be completed by all five", () => {
  const candidates = selectCaptainCandidates(
    ["a", "b", "c", "d", "e"],
    new Map([["a", 80], ["b", 85], ["c", 70], ["d", 82], ["e", 91]]),
  );

  assert.deepEqual(candidates, ["e", "b"]);

  assert.deepEqual(
    resolveCaptainVote(candidates, [
      { candidatePlayerId: "e", voterPlayerId: "a" },
      { candidatePlayerId: "b", voterPlayerId: "b" },
      { candidatePlayerId: "e", voterPlayerId: "c" },
      { candidatePlayerId: "b", voterPlayerId: "d" },
      { candidatePlayerId: "e", voterPlayerId: "e" },
    ]),
    ["e"],
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

test("renewal retention supports a 4-5 player active Club and archives smaller outcomes", () => {
  const four = ["a", "b", "c", "d"];
  const five = ["a", "b", "c", "d", "e"];
  assert.deepEqual(validateRetention(four, four, ["a"]), four);
  assert.deepEqual(validateRetention(four, undefined, ["a"]), four);
  assert.deepEqual(validateRetention(five, null, ["a"]), five);
  assert.deepEqual(validateRetention(five, ["a", "b", "c", "d"], ["a"]), ["a", "b", "c", "d"]);
  assert.deepEqual(validateRetention(five, five, ["a"]), five);
  assert.deepEqual(validateRetention(five, [], ["a"]), []);
  assert.deepEqual(validateRetention(five, ["a", "b", "c"], ["a"]), ["a", "b", "c"]);
  assert.throws(() => validateRetention(five, ["b", "c", "d", "e"], []), /captain/i);
  assert.throws(() => validateRetention(five, ["a", "b", "c", "d", "e", "f"], ["a"]), /five/i);
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
  assert.equal(payouts.get("a"), 16.25);
  assert.equal(payouts.get("b"), 48.75);
  assert.equal(payouts.get("a") + payouts.get("b"), 65);
});


test("V3 auction rules use a 48-hour window, 25-credit minimum and 5-credit increment", () => {
  assert.equal(CLUB_AUCTION_OFFER_DURATION_HOURS, 48);
  assert.equal(CLUB_AUCTION_MIN_BID, 25);
  assert.equal(CLUB_AUCTION_BID_INCREMENT, 5);
  const created = new Date("2026-09-30T00:00:00Z");
  assert.equal(auctionOfferExpiry(created).toISOString(), "2026-10-02T00:00:00.000Z");
  assert.equal(validateAuctionBid(25), 25);
  assert.equal(validateAuctionBid(30, 25), 30);
  assert.throws(() => validateAuctionBid(24));
  assert.throws(() => validateAuctionBid(29, 25));
});

test("V3 Club Match requests use a 24-hour expiry and fixture dates are date-only", () => {
  const created = new Date("2026-09-30T00:00:00Z");
  assert.equal(CLUB_MATCH_REQUEST_TTL_HOURS, 24);
  assert.equal(clubMatchRequestExpiry(created).toISOString(), "2026-10-01T00:00:00.000Z");
  assert.deepEqual(
    normalizeFixtureDate("2026-10-10"),
    { key: "2026-10-10", date: new Date("2026-10-10T00:00:00.000Z") },
  );
  assert.throws(() => normalizeFixtureDate("2026-10-10T12:00"), /valid Club Match date/i);
});


test("V3 renewal preserves the 4-5 active Club minimum", () => {
  const four = ["a", "b", "c", "d"];
  const five = ["a", "b", "c", "d", "e"];
  assert.deepEqual(validateRetention(four, ["a", "b", "c", "d"], ["a"]), four);
  assert.deepEqual(validateRetention(five, ["a", "b", "c", "d"], ["a"]), ["a", "b", "c", "d"]);
  assert.deepEqual(validateRetention(five, ["a", "b", "c", "d", "e"], ["a"]), five);
  assert.deepEqual(validateRetention(five, [], ["a"]), []);
  assert.deepEqual(validateRetention(five, ["a", "b", "c"], ["a"]), ["a", "b", "c"]);
  assert.throws(() => validateRetention(five, ["b", "c", "d", "e"], []), /captain/i);
  assert.throws(() => validateRetention(five, ["a", "b", "c", "d", "e", "f"], ["a"]), /four or five/i);
});

test("Clubs meta exposes 4-5 member policy", async () => {
  const source = await fs.promises.readFile("server/routes/clubs.js", "utf8");
  assert.match(source, /clubMinMembers: CLUB_MIN_MEMBERS/);
  assert.match(source, /clubMaxMembers: CLUB_MAX_MEMBERS/);
  assert.match(source, /every active member votes/);
});



test("Club date keys use Asia/Kolkata rather than the server UTC date", () => {
  assert.equal(CLUBS_TIME_ZONE, "Asia/Kolkata");
  assert.equal(clubDateKey(new Date("2026-10-08T20:00:00.000Z")), "2026-10-09");
});


test("Club available budget excludes active commitments", () => {
  assert.equal(availableClubBalance({ balance: 300, committedBalance: 175 }), 125);
  assert.equal(availableClubBalance({ balance: 300 }), 300);
  assert.equal(availableClubBalance({ balance: 300, committedBalance: 500 }), 0);
});

test("Club date bounds start at midnight in Asia/Kolkata", () => {
  assert.equal(clubDateStartUtc("2026-10-09").toISOString(), "2026-10-08T18:30:00.000Z");
});
