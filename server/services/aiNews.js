import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { buildFallbackMatchNews, normalizeGoalMilestoneHeadline } from "./matchNews.js";

dotenv.config();

const MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.8-flash";

const API_KEY =
  process.env.GEMINI_API_KEY;

const ai = API_KEY
  ? new GoogleGenAI({
      apiKey: API_KEY,
    })
  : null;

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getVerifiedFacts(match) {
  const participants =
    (
      match.participants || []
    ).map(
      (participant) => ({
        player:
          participant.player?.name ||
          "Unknown",
        side:
          participant.team,
      })
    );

  const events =
    (
      match.events || []
    ).map(
      (event) => ({
        player:
          event.player?.name ||
          "Unknown",
        type:
          event.type,
        minute:
          event.minute ??
          null,
      })
    );

  return {
    match: {
      name:
        match.name ||
        "Football Match",

      date:
        match.date,

      side1: {
        label:
          match.teamA?.label ||
          "Side 1",

        score:
          Number(
            match.teamA?.score ||
              0
          ),
      },

      side2: {
        label:
          match.teamB?.label ||
          "Side 2",

        score:
          Number(
            match.teamB?.score ||
              0
          ),
      },
    },

    participants,
    events,
  };
}

export async function generateMatchNews(
  match
) {
  const fallback =
    buildFallbackMatchNews(
      match
    );

  if (!API_KEY) {
    console.error(
      "❌ Gemini is not configured: GEMINI_API_KEY is missing."
    );

    return {
      ...fallback,
      aiError:
        "GEMINI_API_KEY is missing",
    };
  }

  try {
    const facts =
      getVerifiedFacts(
        match
      );

    const prompt = `
You are the football editor for a private football
tracking application.

Write a short, exciting match-news article.

IMPORTANT:
- Use ONLY the verified facts below.
- Never invent a player.
- Never invent goals.
- Never invent assists.
- Never invent a comeback.
- Never invent a winner.
- Never invent tactics or player attributes.
- Do not mention facts that are absent.
- This is casual football journalism.
- Keep the tone energetic but believable.

Return ONLY valid JSON in exactly this shape:

{
  "headline": "string",
  "summary": "string",
  "body": "string",
  "icon": "string"
}

Rules:
- headline: 5-10 words
- summary: exactly one sentence
- body: 2-3 sentences
- icon: one emoji

Verified facts:

${JSON.stringify(
  facts,
  null,
  2
)}
`;

    console.log(
      `🤖 Sending match ${match._id} to Gemini using ${MODEL}...`
    );

    const interaction =
      await ai.interactions.create(
        {
          model:
            MODEL,
          store: false,

          input:
            prompt,

          response_format: {
            type:
              "text",

            mime_type:
              "application/json",

            schema: {
              type:
                "object",

              properties: {
                headline: {
                  type:
                    "string",
                },

                summary: {
                  type:
                    "string",
                },

                body: {
                  type:
                    "string",
                },

                icon: {
                  type:
                    "string",
                },
              },

              required: [
                "headline",
                "summary",
                "body",
                "icon",
              ],
            },
          },
        }
      );

    const raw =
      interaction.output_text ||
      "";

    console.log(
      "🤖 Gemini response received."
    );

    if (!raw.trim()) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    const parsed =
      JSON.parse(
        raw
      );

    if (
      !parsed.headline ||
      !parsed.summary ||
      !parsed.body
    ) {
      throw new Error(
        "Gemini response is missing required fields."
      );
    }

    return {
      headline:
        normalizeGoalMilestoneHeadline(
          cleanText(parsed.headline),
          match,
        ),

      summary:
        cleanText(
          parsed.summary
        ),

      body:
        cleanText(
          parsed.body
        ),

      icon:
        cleanText(
          parsed.icon
        ) || "⚽",

      generatedBy:
        "gemini",

      aiError:
        null,
    };
  } catch (error) {
    console.error(
      "❌ Gemini generation failed."
    );

    console.error(
      "Model:",
      MODEL
    );

    console.error(
      "Error:",
      error
    );

    return {
      ...fallback,
      aiError:
        error?.message ||
        "Unknown Gemini error",
    };
  }
}