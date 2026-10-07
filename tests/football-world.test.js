import test from "node:test";
import assert from "node:assert/strict";
import { getProviderStatus, normalizeFixture, normalizeHighlight, normalizeNewsItem } from "../server/services/footballWorld.js";
import fs from "node:fs";

test("Football World normalizes external fixture data", () => {
  const fixture = normalizeFixture({
    fixture: {
      id: 123,
      date: "2026-10-07T18:00:00+05:30",
      timezone: "Asia/Kolkata",
      status: { short: "NS", long: "Not Started", elapsed: null },
      venue: { id: 9, name: "Emirates Stadium", city: "London" },
    },
    teams: {
      home: { id: 10, name: "Arsenal", logo: "home.png" },
      away: { id: 20, name: "Chelsea", logo: "away.png" },
    },
    goals: { home: null, away: null },
    league: { id: 39, name: "Premier League", country: "England", logo: "league.png" },
  });

  assert.equal(fixture.id, 123);
  assert.equal(fixture.home.name, "Arsenal");
  assert.equal(fixture.away.name, "Chelsea");
  assert.equal(fixture.live, false);
  assert.equal(fixture.league.id, 39);
});

test("Football World normalizes news and highlight records", () => {
  const news = normalizeNewsItem({
    article_id: "n1",
    title: "Football Story",
    description: "Summary",
    link: "https://example.com/news",
    image_url: "https://example.com/image.jpg",
    pubDate: "2026-10-07 08:00:00",
    source_id: "example",
  });
  const highlight = normalizeHighlight({
    id: "h1",
    title: "Match highlights",
    competition: "Premier League",
    match: "Arsenal vs Chelsea",
    date: "2026-10-07",
    thumbnail: "thumb.jpg",
    matchviewUrl: "https://example.com/video",
    embed: '<iframe src="https://player.example.com/embed/1"></iframe>',
  });

  assert.equal(news.id, "n1");
  assert.equal(news.title, "Football Story");
  assert.equal(highlight.embedSrc, "https://player.example.com/embed/1");
  assert.equal(highlight.sourceUrl, "https://example.com/video");
});

test("Football World provider status is safe when optional keys are absent", () => {
  const status = getProviderStatus();
  assert.ok(status.apiFootball);
  assert.ok(status.newsData);
  assert.ok(status.scoreBat);
  assert.ok(status.sportsDb);
  assert.equal(status.weather.status, "ready");
});

test("Football World is wired to the public API route and Home UI", () => {
  const route = fs.readFileSync("server/routes/world.js", "utf8");
  const app = fs.readFileSync("server/app.js", "utf8");
  const home = fs.readFileSync("src/features/home/HomePage.jsx", "utf8");
  const dashboard = fs.readFileSync("src/components/FootballWorld.jsx", "utf8");
  const env = fs.readFileSync(".env.example", "utf8");

  assert.match(app, /app\.use\("\/api\/world", worldRoutes\)/);
  assert.match(route, /router\.get\("\/",/);
  assert.match(route, /router\.get\("\/standings"/);
  assert.match(route, /router\.get\("\/players\/search"/);
  assert.match(home, /footballWorld/);
  assert.match(dashboard, /FOOTBALL WORLD/);
  assert.match(dashboard, /Live & Fixtures/);
  assert.match(dashboard, /World Players/);
  assert.match(dashboard, /MATCHDAY CONDITIONS/);
  assert.match(env, /API_FOOTBALL_KEY/);
  assert.match(env, /NEWSDATA_API_KEY/);
  assert.match(env, /SCOREBAT_API_TOKEN/);
  assert.match(env, /THE_SPORTS_DB_KEY/);
});


test("OpenFoot is optional and fails closed when no server key is configured", async () => {
  const world = await import("../server/services/footballWorld.js");
  assert.ok(world.getProviderStatus().openFoot);
  const result = await world.getOpenFootMatchIntelligence({
    date: "2026-10-07T18:00:00.000Z",
    home: "Arsenal",
    away: "Chelsea",
  });
  assert.equal(result.provider, "OpenFoot");
  assert.equal(result.available, false);
  assert.equal(result.reason, "not-configured");
  assert.equal(result.capabilities.context, false);
});

test("OpenFoot integration is on-demand and UI exposes match intelligence without mixing GG ratings", () => {
  const service = fs.readFileSync("server/services/footballWorld.js", "utf8");
  const route = fs.readFileSync("server/routes/world.js", "utf8");
  const ui = fs.readFileSync("src/components/FootballWorld.jsx", "utf8");
  const css = fs.readFileSync("src/components/football-world.css", "utf8");
  const env = fs.readFileSync(".env.example", "utf8");

  assert.match(service, /OPENFOOT_API_KEY/);
  assert.match(service, /getOpenFootMatchIntelligence/);
  assert.match(service, /\/matches\/.*\/context/);
  assert.match(service, /\/matches\/.*\/xg/);
  assert.match(service, /Authorization: "Bearer "/);
  assert.match(route, /router\.get\("\/openfoot\/intelligence"/);
  assert.match(ui, /MATCH INTELLIGENCE →/);
  assert.match(ui, /OpenFoot/);
  assert.match(ui, /Nothing here changes GG Matchday ratings/);
  assert.match(css, /\.world-intelligence-panel/);
  assert.match(env, /OPENFOOT_API_KEY/);
});


test("Football World uses safe defaults when optional runtime settings are absent", () => {
  const source = fs.readFileSync("server/services/footballWorld.js", "utf8");
  const ui = fs.readFileSync("src/components/FootballWorld.jsx", "utf8");
  assert.match(source, /FOOTBALL_DEFAULT_LEAGUE \|\| "39"/);
  assert.match(source, /FOOTBALL_DEFAULT_SEASON \|\| String\(new Date\(\)\.getFullYear\(\)\)/);
  assert.match(source, /FOOTBALL_DEFAULT_WEATHER_CITY \|\| "Bengaluru"/);
  assert.match(ui, /No external fixtures were returned for today/);
  assert.match(ui, /API-Football is not connected yet/);
  assert.match(ui, /No standings were returned for this competition yet/);
});
