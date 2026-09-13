import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMatchScores } from "../server/services/statistics.js";

test("legacy matches without event history preserve their stored score", () => {
  const match={teamA:{score:5},teamB:{score:3},participants:[],events:[]};
  normalizeMatchScores(match);
  assert.equal(match.teamA.score,5);
  assert.equal(match.teamB.score,3);
});

test("event-backed matches still normalize their score", () => {
  const match={teamA:{score:0},teamB:{score:0},participants:[{player:"a",team:"A",ownGoals:0},{player:"b",team:"B",ownGoals:0}],events:[{player:"a",type:"goal"},{player:"a",type:"goal"},{player:"b",type:"goal"}]};
  normalizeMatchScores(match);
  assert.equal(match.teamA.score,2);
  assert.equal(match.teamB.score,1);
});
