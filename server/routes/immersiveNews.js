import { requireAuth } from "../middleware/auth.js";
import { limitAI } from "../services/editorial.js";
import dotenv from "dotenv";
import express from "express";
import { GoogleGenAI } from "@google/genai";

import Match from "../models/Match.js";
import { normalizeMatchScores } from "../services/statistics.js";

dotenv.config();

const router = express.Router();

const MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.8-flash";

const API_KEY = process.env.GEMINI_API_KEY;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function factsFor(match) {
  const goalEvents = (match.events || []).filter(
    (event) => event.type === "goal"
  );

  const scorers = { A: {}, B: {} };

  for (const event of goalEvents) {
    const team = (match.participants || []).find(
      (participant) =>
        String(participant.player?._id || participant.player) ===
        String(event.player?._id || event.player)
    )?.team;

    if (!team) continue;

    const name = event.player?.name || "Unknown player";
    scorers[team][name] = (scorers[team][name] || 0) + 1;
  }

  return {
    name: match.name || "Football Match",
    date: match.date,
    side1: {
      label: match.teamA?.label || "Team A",
      score: Number(match.teamA?.score || 0),
      scorers: scorers.A,
    },
    side2: {
      label: match.teamB?.label || "Team B",
      score: Number(match.teamB?.score || 0),
      scorers: scorers.B,
    },
  };
}

router.get("/:matchId", requireAuth, limitAI, async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        message: "Gemini is not configured.",
      });
    }

    const match = await Match.findById(req.params.matchId)
      .populate("participants.player", "name")
      .populate("events.player", "name");

    if (!match) {
      return res.status(404).json({
        message: "Match not found.",
      });
    }

    normalizeMatchScores(match);
    const facts = factsFor(match);
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const prompt = `
You are GG Matchday's football commentator and editorial writer.

Create TWO DIFFERENT pieces from the verified match facts below.

PIECE 1 — MATCHDAY MOMENT
Write a short, vivid football commentary line for the homepage.
It should feel like a memorable matchday moment, not a database summary.
Use strong but believable football language and make it enjoyable to read.
Do not repeat the article headline.

PIECE 2 — LATEST NEWS
Write a compact football-news item that gives the reader a sense of what happened.
It should read like a confident match report, with natural flow and some personality.
Do not simply restate the Matchday Moment.

STRICT FACT RULES:
- Use ONLY the verified facts supplied below.
- Never invent players, goals, assists, minutes, tactics, comebacks, injuries or emotions as facts.
- You may use expressive language, but every factual statement must be supported by the data.
- Mention a scorer only if that player appears in the verified scorer data.
- Keep the two pieces clearly different in wording and purpose.

Return ONLY valid JSON in this exact shape:
{
  "momentTitle": "string",
  "momentText": "string",
  "headline": "string",
  "summary": "string",
  "body": "string",
  "icon": "string"
}

STYLE:
- momentTitle: 5-11 words, punchy and memorable.
- momentText: 1-2 sentences, vivid and concise.
- headline: 5-10 words, clearly different from momentTitle.
- summary: exactly one sentence.
- body: 2-4 sentences, natural match-report style.
- icon: one football-appropriate emoji.

VERIFIED MATCH FACTS:
${JSON.stringify(facts, null, 2)}
`;

    const interaction = await ai.interactions.create({
      model: MODEL, store: false,
      input: prompt,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: {
            momentTitle: { type: "string" },
            momentText: { type: "string" },
            headline: { type: "string" },
            summary: { type: "string" },
            body: { type: "string" },
            icon: { type: "string" },
          },
          required: [
            "momentTitle",
            "momentText",
            "headline",
            "summary",
            "body",
            "icon",
          ],
        },
      },
    });

    const raw = interaction.output_text || "";

    if (!raw.trim()) {
      throw new Error("Gemini returned an empty response.");
    }

    const parsed = JSON.parse(raw);

    return res.json({
      generatedBy: "gemini",
      ...Object.fromEntries(
        [
          "momentTitle",
          "momentText",
          "headline",
          "summary",
          "body",
          "icon",
        ].map((key) => [key, clean(parsed[key])])
      ),
    });
  } catch (error) {
    console.error("Immersive Gemini error:", error);

    return res.status(500).json({
      message: "Failed to generate immersive commentary.",
    });
  }
});

export default router;
