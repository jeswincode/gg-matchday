import test from "node:test";
import assert from "node:assert/strict";
import { getCareerRecords } from "../src/features/career/career-records.js";

test("career personal records select the strongest verified match performances", () => {
  const records = getCareerRecords({
    timeline: [
      { date: "2026-01-01", rating: 7.2, goals: 1, assists: 0 },
      { date: "2026-02-01", rating: 8.5, goals: 3, assists: 1 },
      { date: "2026-03-01", rating: 8.5, goals: 0, assists: 2 },
      { date: "2026-04-01", rating: null, goals: 0, assists: 0 },
    ],
    bestMonth: { year: 2026, month: 2, total: 16.4, count: 2 },
    bestTeammate: { name: "Alex", sharedMatches: 5, winRate: 0.8 },
  });
  assert.equal(records.bestRating.date, "2026-03-01");
  assert.equal(records.bestRating.rating, 8.5);
  assert.equal(records.bestGoals.goals, 3);
  assert.equal(records.bestAssists.assists, 2);
  assert.equal(records.bestMonth.averageRating, 8.2);
  assert.equal(records.bestTeammate.name, "Alex");
});

test("career personal records stay empty when there are no rated matches or contributions", () => {
  const records = getCareerRecords({ timeline: [{ rating: null, goals: 0, assists: 0 }] });
  assert.equal(records.bestRating, null);
  assert.equal(records.bestGoals, null);
  assert.equal(records.bestAssists, null);
  assert.equal(records.bestMonth, null);
  assert.equal(records.bestTeammate, null);
});
