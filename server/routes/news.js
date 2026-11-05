import { requireAuth, requireEditor, requireAdmin } from "../middleware/auth.js";
import { limitAI } from "../services/editorial.js";
import express from "express";
import mongoose from "mongoose";
import News from "../models/News.js";
import Match from "../models/Match.js";
import { generateMatchNews } from "../services/aiNews.js";
import { normalizeGoalMilestoneHeadline } from "../services/matchNews.js";

const router = express.Router();
const invalidId = value => !mongoose.isValidObjectId(value);
const populateNews = query => query
  .populate({ path: "match", populate: { path: "events.player", select: "name profileImage" } })
  .populate("featuredPlayer", "name profileImage");
const normalizeArticle = article => {
  if (article?.match) {
    article.headline = normalizeGoalMilestoneHeadline(article.headline, article.match);
  }
  return article;
};

router.get("/", async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit || 12);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 12, 1), 50);
    const news = await populateNews(News.find()).sort({ createdAt: -1 }).limit(limit);
    res.json(news.map(normalizeArticle));
  } catch (error) { console.error("News fetch error:", error); res.status(500).json({ message: "Failed to fetch news." }); }
});

router.get("/debug/gemini", requireAuth, requireAdmin, limitAI, async (req, res) => {
  try {
    const testMatch = await Match.findOne().populate("participants.player", "name profileImage").populate("events.player", "name profileImage").sort({ date: -1 });
    if (!testMatch) return res.status(404).json({ message: "Create at least one match before testing Gemini." });
    const result = await generateMatchNews(testMatch);
    res.json({ success: true, generatedBy: result.generatedBy, aiError: result.aiError || null, article: { headline: result.headline, summary: result.summary, body: result.body, icon: result.icon } });
  } catch (error) { console.error("Gemini debug error:", error); res.status(500).json({ success: false, message: error.message }); }
});
router.get("/:id", async (req, res) => {
  if (invalidId(req.params.id)) return res.status(400).json({ message: "Invalid resource id." });
  try {
    const news = await populateNews(News.findById(req.params.id));
    if (!news) return res.status(404).json({ message: "News article not found." });
    res.json(normalizeArticle(news));
  } catch (error) { console.error("Single news fetch error:", error); res.status(500).json({ message: "Failed to fetch news article." }); }
});

router.post("/generate/:matchId", requireAuth, requireEditor, limitAI, async (req, res) => {
  if (invalidId(req.params.matchId)) return res.status(400).json({ message: "Invalid match id." });
  try {
    const match = await Match.findById(req.params.matchId).populate("participants.player", "name profileImage").populate("events.player", "name profileImage");
    if (!match) return res.status(404).json({ message: "Match not found." });
    const generated = await generateMatchNews(match);
    const firstGoal = (match.events || []).find(event => event.type === "goal");
    const existing = await News.findOne({ match: match._id }).sort({ createdAt: -1 }).lean();
    const news = await News.create({
      type: "match",
      match: match._id,
      featuredPlayer: firstGoal?.player || null,
      headline: generated.headline,
      summary: generated.summary,
      body: generated.body,
      icon: generated.icon || "⚽",
      tags: ["match", "football"],
      generatedBy: generated.generatedBy || "fallback",
    });
    // Keep the previous article until its replacement has been saved successfully.
    await News.deleteMany({ match: match._id, _id: { $ne: news._id } });
    const populated = await populateNews(News.findById(news._id));
    res.status(existing || generated.aiError ? 200 : 201).json({
      article: normalizeArticle(populated),
      generatedBy: generated.generatedBy,
      aiError: generated.aiError || null,
    });
  } catch (error) { console.error("Manual news generation error:", error); res.status(500).json({ message: "Failed to generate news." }); }
});


router.delete("/:id", requireAuth, requireEditor, async (req, res) => {
  if (invalidId(req.params.id)) return res.status(400).json({ message: "Invalid resource id." });
  try {
    const deleted = await News.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "News article not found." });
    res.json({ message: "News article deleted." });
  } catch (error) { console.error("News delete error:", error); res.status(500).json({ message: "Failed to delete news article." }); }
});

export default router;
