import test from "node:test";
import assert from "node:assert/strict";
import { buildPlayerClubAnalytics } from "../server/services/playerClubAnalytics.js";

test("player Club analytics aggregates recorded contributions across Club history", () => {
  const result = buildPlayerClubAnalytics([
    {
      clubId: { _id: "club-b", name: "Beta", status: "archived", logoUrl: "/beta.png" },
      matches: 4, wins: 2, draws: 1, losses: 1, goals: 3, assists: 2,
      motm: 1, ratingTotal: 30, ratedMatches: 4, lastPlayedAt: "2026-09-20",
    },
    {
      clubId: { _id: "club-a", name: "Alpha", status: "approved" },
      matches: 6, wins: 4, draws: 0, losses: 2, goals: 5, assists: 4,
      motm: 2, ratingTotal: 48, ratedMatches: 6, lastPlayedAt: "2026-10-01",
    },
  ]);

  assert.equal(result.clubCount, 2);
  assert.deepEqual(result.career, {
    matches: 10, wins: 6, draws: 1, losses: 3, goals: 8, assists: 6,
    motm: 3, ratedMatches: 10, winRate: 60, averageRating: 7.8,
  });
  assert.equal(result.clubs[0].clubName, "Alpha");
  assert.equal(result.clubs[1].clubStatus, "archived");
  assert.equal(result.clubs[1].logoUrl, "/beta.png");
});

test("player Club analytics keeps unrated match history unrated and excludes money data", () => {
  const result = buildPlayerClubAnalytics([{
    clubId: { _id: "club-a", name: "Alpha" },
    matches: 2, wins: 1, draws: 0, losses: 1, goals: 1, assists: 0,
    motm: 0, ratingTotal: 0, ratedMatches: 0, signingAmount: 999,
    balance: 12345, walletTransactions: [{ amount: 500 }],
  }]);

  assert.equal(result.career.averageRating, null);
  assert.equal(result.clubs[0].averageRating, null);
  assert.equal("balance" in result.clubs[0], false);
  assert.equal("signingAmount" in result.clubs[0], false);
  assert.equal("walletTransactions" in result, false);
});
