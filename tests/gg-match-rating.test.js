import test from "node:test";
import assert from "node:assert/strict";
import { assistPoints, calculateMatchRatings, goalPoints, normalizePerformanceCodes } from "../server/services/ratings/match.js";
import { effectiveMatchRating } from "../server/services/ratings/core.js";

test("goal and assist tables match the GG rules", () => {
  assert.deepEqual([0,1,2,3,4,5,6,7].map(goalPoints), [0,.9,1.7,2.4,3,3.5,4.1,4.7]);
  assert.deepEqual([0,1,2,3,4,5,6,7].map(assistPoints), [0,.7,1.25,1.7,2.1,2.45,2.9,3.35]);
});
test("only the highest code in each category is retained", () => {
  assert.deepEqual(normalizePerformanceCodes(["creator","architect","defence","wall","miss","choke"]), ["choke","architect","wall"]);
});
test("equal teams use equal result modifiers and independent defensive rating", () => {
  const result=calculateMatchRatings({team:"A",teamACount:5,teamBCount:5,teamAScore:3,teamBScore:2,goals:1,assists:1,performanceCodes:["finisher","architect","wall"]});
  assert.equal(result.resultContext,"equal"); assert.equal(result.matchRating,8.9); assert.equal(result.defensiveRating,8.3);
});
test("the larger side is favoured and receives the favoured result modifier", () => {
  const win=calculateMatchRatings({team:"A",teamACount:6,teamBCount:4,teamAScore:2,teamBScore:1});
  const loss=calculateMatchRatings({team:"A",teamACount:6,teamBCount:4,teamAScore:0,teamBScore:1});
  assert.equal(win.resultContext,"favoured"); assert.equal(win.matchRating,6.3); assert.equal(loss.matchRating,5.5);
});
test("underdog win receives the underdog result bonus", () => {
  const result=calculateMatchRatings({team:"B",teamACount:6,teamBCount:4,teamAScore:1,teamBScore:2});
  assert.equal(result.resultContext,"underdog"); assert.equal(result.matchRating,6.5);
});
test("defensive rating starts at six and uses defensive-only contributions", () => {
  const result=calculateMatchRatings({team:"A",teamACount:5,teamBCount:5,teamAScore:1,teamBScore:0,goals:2,assists:3,ownGoals:1,performanceCodes:["wall","hero","blunder","finisher"]});
  assert.equal(result.defensiveRating,8.8); assert.equal(result.matchRating,9.9);
});
test("defensive baseline is exactly six and is independent of match-rating contributions", () => {
  const result=calculateMatchRatings({
    team:"A",teamACount:5,teamBCount:5,teamAScore:1,teamBScore:0,
    goals:0,assists:0,ownGoals:0,performanceCodes:[],
  });
  assert.equal(result.defensiveRating,6.5);
  assert.equal(result.matchRating,6.4);
  assert.notEqual(result.defensiveRating,result.matchRating);
});
test("defensive rating never enters the match-rating calculation", () => {
  const plain=calculateMatchRatings({
    team:"A",teamACount:5,teamBCount:5,teamAScore:1,teamBScore:0,
    performanceCodes:["wall"],
  });
  const offensive=calculateMatchRatings({
    team:"A",teamACount:5,teamBCount:5,teamAScore:1,teamBScore:0,
    goals:1,assists:2,performanceCodes:["wall"],
  });
  assert.equal(plain.defensiveRating,8.9);
  assert.equal(offensive.defensiveRating,8.9);
  assert.equal(plain.matchRating,6.4);
  assert.equal(offensive.matchRating,8.8);
});
test("ratings clamp to four through ten and round to one decimal", () => {
  const low=calculateMatchRatings({team:"B",teamACount:5,teamBCount:5,teamAScore:0,teamBScore:9,ownGoals:4,performanceCodes:["choke","scatter","disaster"]});
  const high=calculateMatchRatings({team:"A",teamACount:5,teamBCount:5,teamAScore:9,teamBScore:0,goals:8,assists:8,performanceCodes:["architect","wall","hero","dominant","heroic","finisher"]});
  assert.equal(low.matchRating,4); assert.equal(low.defensiveRating,4); assert.equal(high.matchRating,10); assert.equal(high.defensiveRating,10);
});
test("GG-v3 effective rating already includes its own-goal penalty", () => {
  assert.equal(effectiveMatchRating({rating:7.5,ownGoals:1,ratingSystem:"gg-v3"}),7.5);
  assert.equal(effectiveMatchRating({rating:7.5,ownGoals:1,ratingSystem:"legacy"}),6.5);
});
