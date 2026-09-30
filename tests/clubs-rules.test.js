import test from "node:test";
import assert from "node:assert/strict";
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
    /between 1 and 4/i,
  );
  assert.throws(
    () => validateClubMemberCount(["a", "b", "c", "d", "e"]),
    /between 1 and 4/i,
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