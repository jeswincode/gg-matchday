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

test("news API display normalization corrects stale stored four-goal headlines without changing stored data", () => {
  const match = matchWithGoals(4);
  const storedHeadline = "Martin hits a hat-trick";
  const displayedHeadline = normalizeGoalMilestoneHeadline(storedHeadline, match);
  assert.equal(displayedHeadline, "Martin dominates with a 4-goal haul");
  assert.equal(storedHeadline, "Martin hits a hat-trick");
});

test("news normalization preserves an accurate three-goal hat-trick and unrelated headlines", () => {
  assert.equal(
    normalizeGoalMilestoneHeadline("Martin hits a hat-trick", matchWithGoals(3)),
    "Martin hits a hat-trick",
  );
  assert.equal(
    normalizeGoalMilestoneHeadline("Team A takes the win", matchWithGoals(4)),
    "Team A takes the win",
  );
});

test("match reports are saved before old articles are cleaned up on edit or regeneration", () => {
  const matchesRoute = read("server/routes/matches.js");
  const newsRoute = read("server/routes/news.js");
  const matchNewsStart = matchesRoute.indexOf("async function createNewsForMatch(");
  const createPosition = matchesRoute.indexOf("await News.create(", matchNewsStart);
  const cleanupPosition = matchesRoute.indexOf("await News.deleteMany({ match: populatedMatch._id", matchNewsStart);
  assert.ok(matchNewsStart >= 0 && createPosition > matchNewsStart && cleanupPosition > createPosition);

  const generateRoute = newsRoute.indexOf('router.post("/generate/:matchId"');
  const newsCreate = newsRoute.indexOf("await News.create(", generateRoute);
  const cleanup = newsRoute.indexOf("await News.deleteMany({ match: match._id", generateRoute);
  assert.ok(generateRoute >= 0 && newsCreate > generateRoute && cleanup > newsCreate);
  assert.doesNotMatch(newsRoute, /await News\.deleteMany\(\{ match: match\._id \}\);/);
});

test("news read routes correct stale headlines against populated match events", () => {
  const route = read("server/routes/news.js");
  assert.match(route, /normalizeGoalMilestoneHeadline\(article\.headline, article\.match\)/);
  assert.match(route, /path: "events\.player", select: "name profileImage"/);
  assert.match(route, /res\.json\(news\.map\(normalizeArticle\)\)/);
});

test("headline normalization does not misattribute a different player's legitimate hat-trick", () => {
  const martin = { _id: "martin", name: "Martin" };
  const kevin = { _id: "kevin", name: "Kevin" };
  const match = {
    ...matchWithGoals(0),
    events: [
      ...Array.from({ length: 4 }, () => ({ type: "goal", player: martin })),
      ...Array.from({ length: 3 }, () => ({ type: "goal", player: kevin })),
    ],
  };
  assert.equal(
    normalizeGoalMilestoneHeadline("Kevin hits a hat-trick", match),
    "Kevin hits a hat-trick",
  );
});
