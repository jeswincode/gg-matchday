import test from "node:test";
import assert from "node:assert/strict";
import { calculatePlayerAttributes } from "../server/services/playerAttributes.js";
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
