import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeClubName,
  validateClubMemberCount,
  validateFormation,
  selectCaptainCandidates,
  resolveCaptainVote,
} from "../server/config/clubsRules.js";

test("club formation requires exactly four unique players", () => {
  assert.deepEqual(validateClubMemberCount(["a", "b", "c", "d"]), ["a", "b", "c", "d"]);
  assert.throws(() => validateClubMemberCount(["a", "b", "c"]), /exactly 4/i);
  assert.throws(() => validateClubMemberCount(["a", "b", "c", "d", "d"]), /exactly 4/i);
});

test("club names normalize whitespace and case", () => {
  assert.equal(normalizeClubName("  GG   United  "), "gg united");
  assert.equal(normalizeClubName("GG UNITED"), "gg united");
});

test("only the locked four-player formations are accepted", () => {
  for (const formation of ["1-2-1", "2-1-1", "1-3", "3-1", "2-2"]) {
    assert.equal(validateFormation(formation), formation);
  }
  assert.throws(() => validateFormation("4-0"), /valid 4-player club formation/i);
});

test("captain candidates are the top two OVR players", () => {
  const candidates = selectCaptainCandidates(
    ["p1", "p2", "p3", "p4"],
    new Map([["p1", 81], ["p2", 88], ["p3", 76], ["p4", 84]]),
  );
  assert.deepEqual(candidates, ["p2", "p4"]);
});

test("a captain vote tie returns both captains", () => {
  assert.deepEqual(
    resolveCaptainVote(
      ["p1", "p2"],
      [
        { candidatePlayerId: "p1" },
        { candidatePlayerId: "p2" },
        { candidatePlayerId: "p1" },
        { candidatePlayerId: "p2" },
      ],
    ),
    ["p1", "p2"],
  );
});
