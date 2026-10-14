import test from "node:test";
import assert from "node:assert/strict";
import {
  PERFORMANCE_CODE_CATEGORIES as clientCategories,
  calculateMatchRatings as calculateClientRatings,
  normalizePerformanceCodes as normalizeClientCodes,
} from "../src/features/ratings/matchCalculator.js";
import {
  PERFORMANCE_CODE_CATEGORIES as serverCategories,
  calculateMatchRatings as calculateServerRatings,
  normalizePerformanceCodes as normalizeServerCodes,
} from "../server/services/ratings/match.js";

const codeSets = [
  [],
  ["creator", "architect", "defence", "wall", "miss", "choke"],
  ["defence", "wall", "hero", "disaster", "finisher"],
  ["off", "errant", "scatter", "carry", "dominant", "clutch", "heroic"],
  serverCategories.flatMap(category => category.codes.map(entry => entry.code)),
];

function assertParity(input, label) {
  const client = calculateClientRatings(input);
  const server = calculateServerRatings(input);
  assert.deepEqual(server, client, label);
  assert.ok(server.matchRating >= 4 && server.matchRating <= 10, label);
  assert.ok(server.defensiveRating >= 4 && server.defensiveRating <= 10, label);
  assert.equal(Math.round(server.matchRating * 10), server.matchRating * 10, label);
  assert.equal(Math.round(server.defensiveRating * 10), server.defensiveRating * 10, label);
}

test("GG-v3 client and server performance-code categories are identical", () => {
  assert.deepEqual(clientCategories, serverCategories);
});

test("client and server rating calculators agree for tabulated result contexts and scoring edge cases", () => {
  const counts = [
    { teamACount: 4, teamBCount: 4, context: "equal" },
    { teamACount: 6, teamBCount: 4, context: "favoured" },
    { teamACount: 4, teamBCount: 6, context: "underdog" },
  ];
  const scorePairs = [[0, 0], [1, 0], [0, 2], [3, 3], [5, 7]];
  const statCases = [
    { goals: 0, assists: 0, ownGoals: 0 },
    { goals: 1, assists: 1, ownGoals: 0 },
    { goals: 5, assists: 5, ownGoals: 1 },
    { goals: 6, assists: 6, ownGoals: 0 },
    { goals: 9, assists: 8, ownGoals: 2 },
  ];

  for (const countCase of counts) {
    for (const team of ["A", "B"]) {
      for (const [teamAScore, teamBScore] of scorePairs) {
        for (const stats of statCases) {
          for (const performanceCodes of codeSets) {
            const input = { ...countCase, team, teamAScore, teamBScore, ...stats, performanceCodes };
            assertParity(input, JSON.stringify(input));
            const ownTeamCount = team === "A" ? countCase.teamACount : countCase.teamBCount;
            const opponentTeamCount = team === "A" ? countCase.teamBCount : countCase.teamACount;
            const expectedContext = ownTeamCount === opponentTeamCount
              ? "equal"
              : ownTeamCount > opponentTeamCount ? "favoured" : "underdog";
            assert.equal(calculateServerRatings(input).resultContext, expectedContext);
          }
        }
      }
    }
  }
});

test("client and server remain identical for deterministic boundary-value combinations", () => {
  const teams = [
    { teamACount: 1, teamBCount: 1 },
    { teamACount: 7, teamBCount: 3 },
    { teamACount: 3, teamBCount: 7 },
  ];
  const codes = [
    "miss", "choke", "off", "scatter", "creator", "architect",
    "defence", "wall", "save", "hero", "error", "disaster",
    "carry", "dominant", "clutch", "heroic", "scorer", "finisher",
  ];
  for (let index = 0; index < 240; index += 1) {
    const teamCounts = teams[index % teams.length];
    const input = {
      ...teamCounts,
      team: index % 2 === 0 ? "A" : "B",
      teamAScore: (index * 7) % 11,
      teamBScore: (index * 5 + 3) % 11,
      goals: [0, 1, 2, 5, 6, 10][index % 6],
      assists: [0, 1, 2, 5, 6, 10][(index * 5) % 6],
      ownGoals: index % 4,
      performanceCodes: codes.filter((_, codeIndex) => (index + codeIndex * 3) % 5 === 0),
    };
    assertParity(input, `generated case ${index}: ${JSON.stringify(input)}`);
  }
});

test("valid performance-code normalization agrees across client and server", () => {
  for (const value of [
    [],
    ["creator", "architect", "defence", "wall", "miss", "choke"],
    ["off", "scatter", "carry", "dominant", "clutch", "heroic"],
    serverCategories.flatMap(category => category.codes.map(entry => entry.code)),
  ]) {
    assert.deepEqual(normalizeClientCodes(value), normalizeServerCodes(value));
  }
});

test("invalid performance-code handling intentionally differs at the UI and API boundaries", () => {
  // The UI calculator is forgiving and filters unknown selections; the server rejects
  // untrusted values. Formula parity is tested only after valid canonical input.
  assert.deepEqual(normalizeClientCodes(["wall", "not-a-real-code", "defence"]), ["wall"]);
  assert.throws(() => normalizeServerCodes(["wall", "not-a-real-code"]), /invalid/i);
  assert.deepEqual(normalizeClientCodes("wall"), []);
  assert.throws(() => normalizeServerCodes("wall"), /array/i);
});
