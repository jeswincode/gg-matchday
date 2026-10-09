import test from "node:test";
import assert from "node:assert/strict";
import { calculatePlayerAttributes, resolvePlayerAttributesReadOnly } from "../server/services/playerAttributes.js";
import { performanceEntries } from "../server/services/ratings/match.js";

test("pace and physical are manual values while OVR uses available attributes", () => {
  const player = { _id: "p1", position: "CAM", pace: 88, physical: 84 };
  const matches = Array.from({ length: 3 }, (_, i) => ({
    participants: [{
      player: "p1",
      team: "A",
      rating: 7 + i * 0.2,
      defensivePerformance: 6,
      performanceCodes: [],
    }],
    events: [
      { player: "p1", type: "goal" },
      { player: "p1", type: "assist" },
    ],
    teamA: { score: 2 },
    teamB: { score: 1 },
  }));

  const result = calculatePlayerAttributes(player, matches);

  assert.equal(result.attributes.pace, 88);
  assert.equal(result.attributes.physical, 84);
  assert.equal(result.currentAttributes.pace, 88);
  assert.equal(result.currentAttributes.physical, 84);
  assert.equal(typeof result.currentAttributes.shooting, "number");
  assert.equal(typeof result.currentOvr, "number");
  assert.equal(result.ovr, result.currentOvr);
  assert.equal(typeof result.careerOvr, "number");
  assert.equal(result.sampleStage, "developing");
});

test("OVR remains unavailable before three matches", () => {
  const result = calculatePlayerAttributes(
    { _id: "p1", position: "CAM", pace: 80, physical: 80 },
    [],
  );

  assert.equal(result.currentOvr, null);
  assert.equal(result.careerOvr, null);
  assert.equal(result.ovr, null);
  assert.equal(result.sampleStage, "unrated");
  assert.equal(result.confidence, 0);
});

test("current OVR uses the recent ten-match window while Career OVR uses full history", () => {
  const matches = Array.from({ length: 14 }, (_, index) => ({
    participants: [{
      player: "p1",
      team: "A",
      rating: index < 8 ? 5.2 : 9.0,
      defensivePerformance: index < 8 ? 4.5 : 8.5,
      performanceCodes: index < 8 ? [] : ["finisher", "playmaker", "dominant"],
    }],
    events: index < 8
      ? []
      : [
          { player: "p1", type: "goal" },
          { player: "p1", type: "assist" },
        ],
    teamA: { score: index < 8 ? 0 : 2 },
    teamB: { score: index < 8 ? 1 : 1 },
  }));

  const result = calculatePlayerAttributes(
    { _id: "p1", position: "CAM", pace: 80, physical: 80 },
    matches,
  );

  assert.equal(result.matchesPlayed, 14);
  assert.equal(result.currentWindowMatches, 10);
  assert.equal(result.sampleStage, "established");
  assert.ok(result.currentOvr > result.careerOvr);
  assert.ok(result.confidence > 0);
});

test("performance codes from the same category do not stack", () => {
  assert.deepEqual(
    performanceEntries(["defence", "stopper", "wall"]),
    [{ code: "wall", label: "Wall", level: 3, match: 0.3, defensive: 2.4, category: "defence" }],
  );

  assert.deepEqual(
    performanceEntries(["creator", "architect"]),
    [{ code: "architect", label: "Architect", level: 3, match: 0.3, category: "playmaking" }],
  );
});


test("current OVR is stable when callers provide matches out of chronological order", () => {
  const makeMatch = (day, rating, code = null) => ({
    _id: `2026-01-${String(day).padStart(2, "0")}`,
    date: new Date(`2026-01-${String(day).padStart(2, "0")}T12:00:00.000Z`),
    createdAt: new Date(`2026-01-${String(day).padStart(2, "0")}T12:00:00.000Z`),
    participants: [{
      player: "p1",
      team: "A",
      rating,
      defensivePerformance: rating,
      performanceCodes: code ? [code] : [],
    }],
    events: [],
  });

  const chronological = Array.from({ length: 14 }, (_, i) =>
    makeMatch(i + 1, i < 8 ? 4.5 : 9.2, i < 8 ? null : "dominant"),
  );
  const reversed = [...chronological].reverse();

  const ordered = calculatePlayerAttributes(
    { _id: "p1", position: "CAM", pace: 80, physical: 80 },
    chronological,
  );
  const shuffled = calculatePlayerAttributes(
    { _id: "p1", position: "CAM", pace: 80, physical: 80 },
    reversed,
  );

  assert.equal(shuffled.currentOvr, ordered.currentOvr);
  assert.equal(shuffled.careerOvr, ordered.careerOvr);
});


test("profile attribute resolution returns an unchanged cached snapshot without writing", () => {
  const player = {
    _id: "p1", position: "CAM", preferredPositions: ["CM"], pace: 80, physical: 75,
    ovrSnapshot: {
      currentOvr: 78, careerOvr: 76, confidence: 50, matchesPlayed: 1, ratedMatches: 1,
      currentWindowMatches: 1, currentAttributes: { pace: 80, physical: 75, shooting: 78, passing: 79, dribbling: 77, defending: 60 },
      careerAttributes: {}, positionRatings: {}, calculatedAt: new Date("2026-10-01T00:00:00Z"),
      sourceUpdatedAt: new Date("2026-09-30T00:00:00Z"), sourcePosition: "CAM", sourcePreferredPositions: ["CM"],
    },
  };
  const matches = [{
    _id: "m1", date: new Date("2026-09-29T00:00:00Z"), updatedAt: new Date("2026-09-30T00:00:00Z"),
    participants: [{ player: "p1", team: "A", rating: 8, ownGoals: 0 }], events: [],
  }];
  const result = resolvePlayerAttributesReadOnly(player, matches);
  assert.equal(result.cached, true);
  assert.equal(result.currentOvr, 78);
  assert.equal(result.currentAttributes.pace, 80);
  assert.equal(result.currentAttributes.physical, 75);
});

test("legacy own goals use effective match rating consistently in OVR derivation", () => {
  const matches = [{
    _id: "m1", date: new Date("2026-01-01T00:00:00Z"),
    participants: [{ player: "p1", team: "A", rating: 8, ownGoals: 1, ratingSystem: "legacy" }],
    events: [],
  }];
  const result = calculatePlayerAttributes({ _id: "p1", position: "CAM", pace: 80, physical: 80 }, matches);
  assert.equal(result.ratedMatches, 1);
  assert.ok(result.currentAttributes.shooting < 99);
});
