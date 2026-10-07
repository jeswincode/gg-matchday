import express from "express";
import {
  getFixtures,
  getFixtureDetail,
  getNews,
  getHighlights,
  getStandings,
  getWeather,
  getWorld,
  getProviderStatus,
  getStandingsLeagueOptions,
  searchExternalPlayer,
  getOpenFootMatchIntelligence,
} from "../services/footballWorld.js";

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({ providers: getProviderStatus() });
});

router.get("/", async (req, res) => {
  try {
    const world = await getWorld({
      date: req.query.date || undefined,
      city: req.query.city || undefined,
      league: req.query.league || undefined,
      season: req.query.season || undefined,
    });
    return res.json(world);
  } catch (error) {
    console.error("Football World error:", error);
    return res.status(502).json({ message: "Football World is temporarily unavailable." });
  }
});

router.get("/fixtures", async (req, res) => {
  try {
    return res.json({
      fixtures: await getFixtures({
        date: req.query.date || undefined,
        league: req.query.league || undefined,
      }),
    });
  } catch (error) {
    console.error("Football World fixtures error:", error);
    return res.status(502).json({ message: "External fixtures are temporarily unavailable." });
  }
});

router.get("/fixture/:id", async (req, res) => {
  try {
    const fixture = await getFixtureDetail(req.params.id);
    if (!fixture) return res.status(404).json({ message: "External fixture not found." });
    return res.json({ fixture });
  } catch (error) {
    console.error("Football World fixture detail error:", error);
    return res.status(502).json({ message: "External fixture details are temporarily unavailable." });
  }
});

router.get("/standings/leagues", async (req, res) => {
  try {
    return res.json({ leagues: await getStandingsLeagueOptions() });
  } catch (error) {
    console.error("Football World standings leagues error:", error);
    return res.status(502).json({ message: "External league coverage is temporarily unavailable." });
  }
});

router.get("/standings", async (req, res) => {
  try {
    const standings = await getStandings({
      league: req.query.league || undefined,
      season: req.query.season || undefined,
    });
    return res.json({ standings });
  } catch (error) {
    console.error("Football World standings error:", error);
    return res.status(502).json({
      message: error?.message || "External standings are temporarily unavailable.",
      code: error?.code || "standings_unavailable",
      details: error?.details || null,
    });
});

router.get("/news", async (req, res) => {
  try {
    return res.json({
      news: await getNews({
        query: req.query.q || "football",
        limit: Number(req.query.limit) || 6,
      }),
    });
  } catch (error) {
    console.error("Football World news error:", error);
    return res.status(502).json({ message: "External football news is temporarily unavailable." });
  }
});

router.get("/highlights", async (req, res) => {
  try {
    return res.json({
      highlights: await getHighlights({
        limit: Number(req.query.limit) || 5,
      }),
    });
  } catch (error) {
    console.error("Football World highlights error:", error);
    return res.status(502).json({ message: "External highlights are temporarily unavailable." });
  }
});

router.get("/weather", async (req, res) => {
  try {
    const weather = await getWeather(req.query.city || "");
    return res.json({ weather });
  } catch (error) {
    console.error("Football World weather error:", error);
    return res.status(502).json({ message: "Matchday weather is temporarily unavailable." });
  }
});

router.get("/openfoot/intelligence", async (req, res) => {
  try {
    const { date, home, away } = req.query;
    if (!home || !away) {
      return res.status(400).json({ message: "Home and away team names are required." });
    }
    return res.json(await getOpenFootMatchIntelligence({ date, home, away }));
  } catch (error) {
    console.error("OpenFoot intelligence error:", error);
    return res.status(502).json({ message: "OpenFoot match intelligence is temporarily unavailable." });
  }
});

router.get("/players/search", async (req, res) => {
  try {
    return res.json({
      players: await searchExternalPlayer(req.query.q || ""),
    });
  } catch (error) {
    console.error("Football World player search error:", error);
    return res.status(502).json({ message: "External player search is temporarily unavailable." });
  }
});

export default router;
