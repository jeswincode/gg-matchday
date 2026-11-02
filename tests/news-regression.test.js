import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFallbackMatchNews, normalizeGoalMilestoneHeadline } from "../server/services/matchNews.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function matchWithGoals(count) {
  const scorer = { _id: "player-martin", name: "Martin" };
  return {
    _id: "match-regression",
    name: "Test match",
    teamA: { label: "Team A", score: count },
    teamB: { label: "Team B", score: 0 },
    events: Array.from({ length: count }, () => ({ type: "goal", player: scorer })),
  };
}

test("fallback match news calls four-or-more goals a goal haul, not a hat-trick", () => {
  for (const goals of [4, 5, 6]) {
    const news = buildFallbackMatchNews(matchWithGoals(goals));
    assert.equal(news.headline, `Martin dominates with a ${goals}-goal haul`);
    assert.match(news.summary, new RegExp(`scored ${goals} times`));
    assert.doesNotMatch(news.headline, /hat[ -]?trick/i);
  }
});

test("fallback match news reserves hat-trick for exactly three goals", () => {
  const news = buildFallbackMatchNews(matchWithGoals(3));
  assert.equal(news.headline, "Martin hits a hat-trick");
  assert.match(news.summary, /scored three times/);
});

test("news API display normalization corrects stale stored four-goal headlines wit¶»§q«^