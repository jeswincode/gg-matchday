import test from "node:test";
import assert from "node:assert/strict";
import { buildPlayerClubHistory, mergeContractTenures, classifyPlayerEarnings } from "../server/services/playerClubHistory.js";

test("Player History merges consecutive renewal contracts into one tenure", () => {
  const tenures = mergeContractTenures([
    { _id: "c1", clubId: "clubA", startAt: "2026-09-20", endAt: "2026-11-01", status: "expired", source: "formation" },
    { _id: "c2", clubId: "clubA", startAt: "2026-11-01", endAt: "2027-01-01", status: "active", source: "renewal" },
    { _id: "c3", clubId: "clubB", startAt: "2027-01-01", endAt: "2027-03-01", status: "released", source: "auction" },
  ], new Map([
    ["clubA", { name: "Alpha", status: "approved" }],
    ["clubB", { name: "Beta", status: "archived" }],
  ]));
  assert.equal(tenures.length, 2);
  assert.equal(tenures[0].contracts.length, 2);
  assert.equal(tenures[0].clubName, "Alpha");
  assert.equal(tenures[1].clubName, "Beta");
});

test("Player History classifies only Club-linked player earnings and excludes betting", () => {
  const result = classifyPlayerEarnings([
    { type: "signing_payment", amount: 100, clubId: "clubA" },
    { type: "individual_match_reward", amount: 20, clubId: "clubA", description: "Club Match appearance reward." },
    { type: "motm_reward", amount: 25, clubId: "clubA", description: "Club Match MOTM reward." },
    { type: "betting_win", amount: 80, clubId: "clubA" },
    { type: "individual_match_reward", amount: 10, clubId: null },
  ]);
  const row = result.get("clubA");
  assert.equal(row.signingPayment, 100);
  assert.equal(row.matchRewards, 20);
  assert.equal(row.motmRewards, 25);
  assert.equal(row.total, 145);
});

test("Player History derives Club Match performance from the authoritative Match Record", () => {
  const result = buildPlayerClubHistory({
    playerId: "player1",
    now: new Date("2026-10-01T00:00:00Z"),
    contracts: [
      { _id: "contract1", clubId: "clubA", playerId: "player1", startAt: "2026-09-01", endAt: "2027-01-01", status: "active", source: "formation" },
    ],
    clubs: [{ _id: "clubA", name: "Alpha", status: "approved" }],
    clubMatches: [{
      _id: "cm1", clubAId: "clubA", clubBId: "clubB", status: "completed",
      mainMatchId: "match1", clubAScore: 3, clubBScore: 0,
    }],
    mainMatches: [{
      _id: "match1", date: "2026-09-25",
      participants: [{ player: "player1", team: "A", rating: 8.2, defensivePerformance: 7.5 }],
      events: [
        { player: "player1", type: "goal" },
        { player: "player1", type: "assist" },
      ],
      motmWinner: "player1",
    }],
    playerHistories: [],
    walletTransactions: [],
  });
  const club = result.tenures[0];
  assert.equal(club.contribution.matches, 1);
  assert.equal(club.contribution.wins, 1);
  assert.equal(club.contribution.goals, 1);
  assert.equal(club.contribution.assists, 1);
  assert.equal(club.contribution.motm, 1);
  assert.equal(club.contribution.cleanSheets, 1);
  assert.equal(club.contribution.averageRating, 8.2);
  assert.equal(club.contribution.averageDefensiveRating, 7.5);
  assert.equal(result.careerSummary.matches, 1);
});
