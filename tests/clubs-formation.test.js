import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeClubName,
  validateClubMemberCount,
  validateFormation,
  selectCaptainCandidates,
  resolveCaptainVote,
} from "../server/config/clubsRules.js";

test("club formation accepts four or five unique players", () => {
  assert.deepEqual(validateClubMemberCount(["a", "b", "c", "d"]), ["a", "b", "c", "d"]);
  assert.deepEqual(validateClubMemberCount(["a", "b", "c", "d", "e"]), ["a", "b", "c", "d", "e"]);
  assert.throws(() => validateClubMemberCount(["a", "b", "c"]), /between 4 and 5/i);
  assert.throws(() => validateClubMemberCount(["a", "b", "c", "d", "e", "f"]), /between 4 and 5/i);
  assert.throws(() => validateClubMemberCount(["a", "b", "c", "d", "d"]), /unique/i);
}

test("club names normalize whitespace and case", () => {
  assert.equal(normalizeClubName("  GG   United  "), "gg united");
  assert.equal(normalizeClubName("GG UNITED"), "gg united");
});

test("both four-player and five-player viewer formations are accepted", () => {
  for (const formation of ["1-2-1", "2-1-1", "1-3", "3-1", "2-2", "1-2-2", "2-2-1", "2-1-2", "1-3-1", "3-1-1"]) {
    assert.equal(validateFormation(formation), formation);
  }
  assert.doesNotThrow(() => validateFormation("1-2-2"));
  assert.doesNotThrow(() => validateFormation("1-3-1"));
  assert.throws(() => validateFormation("4-0"), /valid Club formation/i);
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
