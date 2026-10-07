import { GoogleGenAI } from "@google/genai";
import Player from "../models/Player.js";
import Match from "../models/Match.js";
import {
  buildStatistics,
  getMatchScores,
  id,
  sortDefensive,
  sortGoldenBoot,
  sortPlaymaker,
} from "./statistics.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const API_KEY = process.env.GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const navigationActions = [
  ["home", "Open Home"],
  ["player", "Open Player Profile"],
  ["record", "Open Match Record"],
  ["leaderboard", "Open Leaderboard"],
  ["calendar", "Open Calendar"],
  ["players", "Open Players"],
  ["hall-of-fame", "Open Hall of Fame"],
  ["clubs", "Open Ultimate Clubs"],
  ["clubs-my-club", "Open My Club"],
  ["clubs-players", "Open Club Players"],
  ["clubs-reviews", "Open Club Reviews"],
];

const assistantUsage = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const SNAPSHOT_TTL_MS = 20_000;
let snapshotCache = null;
let snapshotPromise = null;

async function getStatisticsSnapshot() {
  const now = Date.now();
  if (snapshotCache && snapshotCache.expiresAt > now) return snapshotCache;

  if (!snapshotPromise) {
    snapshotPromise = Promise.all([
      Player.find({}).select("_id name position profileImage preferredPositions").lean(),
      Match.find({}).select("_id name date createdAt teamA teamB participants events motmWinner").sort({ date: -1 }).lean(),
    ]).then(([players, matches]) => {
      const rows = buildStatistics(players, matches, { minimumMatches: 5 });
      const snapshot = {
        players,
        matches,
        rows,
        expiresAt: Date.now() + SNAPSHOT_TTL_MS,
      };
      snapshotCache = snapshot;
      return snapshot;
    }).finally(() => {
      snapshotPromise = null;
    });
  }

  return snapshotPromise;
}

function navigationIntent(message) {
  const q = normalize(message);
  if (/\b(hall of fame|hall|legends)\b/.test(q)) return { type: "hall-of-fame", label: "OPEN HALL OF FAME →" };
  if (/\b(club reviews|club review|review section)\b/.test(q)) return { type: "clubs-reviews", label: "OPEN CLUB REVIEWS →" };
  if (/\b(my club|my squad|my club hq|club hq)\b/.test(q)) return { type: "clubs-my-club", label: "OPEN MY CLUB →" };
  if (/\b(club players|scouting|scout|signing market|player market)\b/.test(q)) return { type: "clubs-players", label: "OPEN CLUB PLAYERS →" };
  if (/\b(clubs?|club match|auction|captain|renewal|formation)\b/.test(q)) return { type: "clubs", label: "OPEN ULTIMATE CLUBS →" };
  if (/\b(calendar|schedule|fixtures|match history|matches)\b/.test(q)) return { type: "calendar", label: "OPEN CALENDAR →" };
  if (/\b(record|record match|add match|new match)\b/.test(q)) return { type: "record", label: "OPEN MATCH RECORD →" };
  if (/\b(players|player directory|squad|roster)\b/.test(q)) return { type: "players", label: "OPEN PLAYERS →" };
  if (/\b(home|dashboard|start)\b/.test(q)) return { type: "home", label: "OPEN HOME →" };
  return null;
}

function needsAi(message) {
  const q = normalize(message);
  return /\b(real[- ]?life|similar to|resembles|resemble|comparable to|real[- ]?player|why|analysis|analy[sz]e|tactical|style|strengths?|weaknesses?|improve|improvement|what should|what can|explain)\b/.test(q);
}

function fastAnswer(message, facts, intent) {
  const q = normalize(message);
  const mentioned = facts.mentionedPlayers || [];
  const viewer = facts.viewer;

  if (/\b(take me|open|go to|show me|bring me to|where is|navigate)\b/.test(q) && intent.action) {
    return {
      answer: `Got it — opening that for you.`,
      action: intent.action,
      generatedBy: "fast",
    };
  }

  if (/\b(most goals|top scorer|golden boot|scored the most|who has the most goals)\b/.test(q)) {
    const row = facts.topScorers[0];
    if (!row) return { answer: "There isn't enough goal data yet.", action: intent.action, generatedBy: "fast" };
    return {
      answer: `⚽ ${row.name} leads the GG goal charts with ${row.goals} goal${row.goals === 1 ? "" : "s"} across ${row.matches} matches.`,
      action: { type: "player", label: "VIEW " + row.name.toUpperCase() + " →", playerId: row.playerId },
      generatedBy: "fast",
    };
  }

  if (/\b(most assists|best playmaker|top assist)/.test(q)) {
    const row = facts.topPlaymakers[0];
    if (!row) return { answer: "There isn't enough assist data yet.", action: intent.action, generatedBy: "fast" };
    return {
      answer: `🎯 ${row.name} leads the assist chart with ${row.assists} assist${row.assists === 1 ? "" : "s"}.`,
      action: { type: "player", label: "VIEW " + row.name.toUpperCase() + " →", playerId: row.playerId },
      generatedBy: "fast",
    };
  }

  if (/\b(best defender|top defender|best defensive)/.test(q)) {
    const row = facts.topDefenders[0];
    if (!row) return { answer: "There isn't enough defensive-rating data yet.", action: intent.action, generatedBy: "fast" };
    return {
      answer: `🛡️ ${row.name} leads the defensive ranking at ${row.defensiveRating?.toFixed?.(2) ?? "—"}.`,
      action: { type: "player", label: "VIEW " + row.name.toUpperCase() + " →", playerId: row.playerId },
      generatedBy: "fast",
    };
  }

  if (/\b(#?1|number one|best player|top player|leaderboard|ranking|rankings)\b/.test(q)) {
    const row = facts.leaderboard[0];
    if (!row) return { answer: "There isn't enough GG Rating data for a leaderboard yet.", action: { type: "leaderboard", label: "OPEN LEADERBOARD →" }, generatedBy: "fast" };
    return {
      answer: `🏆 ${row.name} is currently #1 on the GG Rating leaderboard at ${row.ggRating?.toFixed?.(2) ?? "—"}.`,
      action: { type: "player", label: "VIEW " + row.name.toUpperCase() + " →", playerId: row.playerId },
      generatedBy: "fast",
    };
  }

  const comparison = mentioned.length >= 2 && /\b(compare|versus|vs\.?|better|difference|between)\b/.test(q);
  if (comparison) {
    const [a, b] = mentioned;
    const rating = (row) => row.ggRating ?? -1;
    const winner = rating(a) >= rating(b) ? a : b;
    const diff = Math.abs((rating(a) >= 0 && rating(b) >= 0) ? rating(a) - rating(b) : 0);
    return {
      answer: `${a.name} vs ${b.name}: ${a.name} has ${a.goals}G/${a.assists}A and ${a.ggRating ?? "—"} GG Rating; ${b.name} has ${b.goals}G/${b.assists}A and ${b.ggRating ?? "—"} GG Rating. ${winner.name} is ahead on GG Rating${diff ? ` by ${diff.toFixed(2)}` : ""}.`,
      action: { type: "player", label: "VIEW " + winner.name.toUpperCase() + " →", playerId: winner.playerId },
      generatedBy: "fast",
    };
  }

  if (viewer && /\b(my|mine|me)\b/.test(q) && /\b(form|stats?|statistics|performance|playing|record|goals|assists)\b/.test(q)) {
    const form = Array.isArray(viewer.form) ? viewer.form.join(" · ") : viewer.form;
    return {
      answer: `Your GG snapshot: ${viewer.matches} matches, ${viewer.goals} goals, ${viewer.assists} assists, GG Rating ${viewer.ggRating ?? "not yet rated"}.${form ? ` Recent form: ${form}.` : ""}`,
      action: { type: "player", label: "VIEW YOUR PROFILE →", playerId: viewer.playerId },
      generatedBy: "fast",
    };
  }

  if (mentioned.length === 1 && /\b(stats?|statistics|performance|form|how.*playing|recent|goals|assists|record|profile)\b/.test(q)) {
    const row = mentioned[0];
    return {
      answer: `${row.name}: ${row.matches} matches, ${row.goals} goals, ${row.assists} assists, GG Rating ${row.ggRating ?? "not yet rated"}.`,
      action: { type: "player", label: "VIEW " + row.name.toUpperCase() + " →", playerId: row.playerId },
      generatedBy: "fast",
    };
  }

  return null;
}



function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function enforceRateLimit(key) {
  const now = Date.now();
  const entry = assistantUsage.get(key);
  if (!entry || entry.until <= now) {
    assistantUsage.set(key, { count: 1, until: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count += 1;
  return true;
}

function normalize(value) {
  return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function findMentionedPlayers(message, players) {
  const q = normalize(message);
  if (!q) return [];
  return players
    .map(player => ({ player, name: normalize(player.name) }))
    .filter(({ name }) => name && (q.includes(name) || name.split(" ").some(part => part.length >= 3 && q.includes(part))))
    .sort((a, b) => b.name.length - a.name.length)
    .map(({ player }) => player);
}

function compactStat(row) {
  return {
    playerId: row.playerId,
    name: row.name,
    position: row.position,
    matches: row.matches,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goals: row.goals,
    assists: row.assists,
    ownGoals: row.ownGoals,
    cleanSheets: row.cleanSheets,
    averageRating: row.averageRating,
    offensiveRating: row.offensiveRating,
    defensiveRating: row.defensiveRating,
    ggRating: row.ggRating,
    form: row.form,
    defensiveRatedMatches: row.defensiveRatedMatches,
  };
}

function deterministicIntent(message, stats, players) {
  const q = normalize(message);
  const mentioned = findMentionedPlayers(message, players);
  const first = mentioned[0] || null;

  if (/\b(hall of fame|hall|legends)\b/.test(q)) {
    return { action: { type: "hall-of-fame", label: "OPEN HALL OF FAME →" } };
  }
  if (/\b(club reviews|reviews)\b/.test(q) && /club|clubs|review/.test(q)) {
    return { action: { type: "clubs-reviews", label: "OPEN CLUB REVIEWS →" } };
  }
  if (/\b(my club|my squad|my club hq|club hq)\b/.test(q)) {
    return { action: { type: "clubs-my-club", label: "OPEN MY CLUB →" } };
  }
  if (/\b(club players|scouting|scout|signing market|player market)\b/.test(q)) {
    return { action: { type: "clubs-players", label: "OPEN CLUB PLAYERS →" } };
  }
  if (/\b(clubs?|club match|auction|captain|renewal|formation)\b/.test(q)) {
    return { action: { type: "clubs", label: "OPEN ULTIMATE CLUBS →" } };
  }
  if (/\b(calendar|schedule|fixtures|match history|matches)\b/.test(q)) {
    return { action: { type: "calendar", label: "OPEN CALENDAR →" } };
  }
  if (/\b(record|record match|add match|new match)\b/.test(q)) {
    return { action: { type: "record", label: "OPEN MATCH RECORD →" } };
  }
  if (/\b(leaderboard|ranking|rankings|top players|who is #?1|best player|best overall)\b/.test(q)) {
    const row = stats.find(item => item.ggRating != null) || stats[0];
    return {
      action: row
        ? { type: "player", label: "VIEW " + row.name.toUpperCase() + " →", playerId: row.playerId }
        : { type: "leaderboard", label: "OPEN LEADERBOARD →" },
    };
  }
  if (/\b(most goals|top scorer|golden boot|scored the most|most assists|best playmaker|best defender)\b/.test(q)) {
    const row = /assist|playmaker/.test(q)
      ? [...stats].sort(sortPlaymaker)[0]
      : /defender/.test(q)
        ? [...stats].filter(item => item.defensiveEligible).sort(sortDefensive)[0]
        : [...stats].sort(sortGoldenBoot)[0];
    return row
      ? { action: { type: "player", label: "VIEW " + row.name.toUpperCase() + " →", playerId: row.playerId } }
      : { action: { type: "leaderboard", label: "OPEN LEADERBOARD →" } };
  }
  if (first && /\b(stats?|statistics|performance|form|how.*playing|recent|goals|assists|record)\b/.test(q)) {
    return { action: { type: "player", label: "VIEW " + first.name.toUpperCase() + " →", playerId: id(first) } };
  }
  if (/\b(player|players|squad|roster|find)\b/.test(q)) {
    return { action: { type: "players", label: "OPEN PLAYERS →" } };
  }
  if (/\b(home|dashboard|start)\b/.test(q)) {
    return { action: { type: "home", label: "OPEN HOME →" } };
  }
  return first ? { action: { type: "player", label: "VIEW " + first.name.toUpperCase() + " →", playerId: id(first) } } : { action: null };
}

function buildFacts(message, players, matches, rows, viewerPlayerId) {
  const mentioned = findMentionedPlayers(message, players);
  const viewer = viewerPlayerId ? rows.find(row => String(row.playerId) === String(viewerPlayerId)) : null;
  const recent = [...matches]
    .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 8)
    .map(match => {
      const scores = getMatchScores(match);
      return {
        matchId: id(match),
        date: match.date,
        name: match.name || "Football Match",
        sideA: match.teamA?.label || "Side 1",
        sideB: match.teamB?.label || "Side 2",
        scoreA: scores.teamA,
        scoreB: scores.teamB,
      };
    });

  return {
    viewer: viewer ? compactStat(viewer) : null,
    mentionedPlayers: mentioned.map(player => {
      const row = rows.find(item => item.playerId === id(player));
      return row ? compactStat(row) : { playerId: id(player), name: player.name, position: player.position };
    }),
    leaderboard: rows.filter(row => row.ggRating != null).slice(0, 10).map(compactStat),
    topScorers: [...rows].sort(sortGoldenBoot).slice(0, 5).map(compactStat),
    topPlaymakers: [...rows].sort(sortPlaymaker).slice(0, 5).map(compactStat),
    topDefenders: [...rows].filter(row => row.defensiveEligible).sort(sortDefensive).slice(0, 5).map(compactStat),
    recentMatches: recent,
  };
}

function fallbackReply(message, facts, intent) {
  const q = normalize(message);
  if (/\bmost goals|top scorer|golden boot\b/.test(q)) {
    const row = facts.topScorers[0];
    return row
      ? `${row.name} leads the goal charts with ${row.goals} goal${row.goals === 1 ? "" : "s"} across ${row.matches} match${row.matches === 1 ? "" : "es"}.`
      : "There isn't enough goal data yet.";
  }
  if (/\bmost assists|best playmaker\b/.test(q)) {
    const row = facts.topPlaymakers[0];
    return row
      ? `${row.name} leads the assists chart with ${row.assists} assist${row.assists === 1 ? "" : "s"}.`
      : "There isn't enough assist data yet.";
  }
  if (/\bbest defender\b/.test(q)) {
    const row = facts.topDefenders[0];
    return row
      ? `${row.name} leads the defensive ranking at ${row.defensiveRating?.toFixed?.(2) ?? "—"} defensive rating.`
      : "There isn't enough defensive-rating data yet.";
  }
  if (facts.mentionedPlayers.length) {
    const row = facts.mentionedPlayers[0];
    return `${row.name} has ${row.matches} match${row.matches === 1 ? "" : "es"}, ${row.goals} goal${row.goals === 1 ? "" : "s"}, ${row.assists} assist${row.assists === 1 ? "" : "s"}, and a GG Rating of ${row.ggRating ?? "not yet rated"}.`;
  }
  if (intent.action) {
    return `I can take you there. Use the action below to ${intent.action.label.toLowerCase().replace(" →", "")}.`;
  }
  return "I can help you find players, understand stats, compare performances, check the leaderboard, or navigate GG Matchday.";
}

export async function answerAssistant({ message, viewerPlayerId, rateLimitKey }) {
  const prompt = clean(message);
  if (prompt.length < 1 || prompt.length > 1000) {
    throw new Error("Ask GG something between 1 and 1000 characters.");
  }
  if (!enforceRateLimit(rateLimitKey)) {
    throw new Error("GG Assistant is receiving a lot of requests. Please wait a minute and try again.");
  }

  const navAction = navigationIntent(prompt);
  if (navAction && !needsAi(prompt)) {
    return {
      answer: "Got it — opening that for you.",
      action: navAction,
      generatedBy: "fast",
    };
  }

  const snapshot = await getStatisticsSnapshot();
  const { players, matches, rows } = snapshot;
  const intent = deterministicIntent(prompt, rows, players);
  const facts = buildFacts(prompt, players, matches, rows, viewerPlayerId);

  const fast = !needsAi(prompt) ? fastAnswer(prompt, facts, intent) : null;
  if (fast) return fast;

  const fallback = {
    answer: fallbackReply(prompt, facts, intent),
    action: intent.action,
    generatedBy: "fallback",
  };

  if (!ai) return fallback;

  try {
    const response = await ai.interactions.create({
      model: MODEL,
      store: false,
      input: `You are GG Assistant, the football concierge inside GG Matchday.

Your job:
- Answer questions about the GG Matchday football database.
- Explain player performance, leaderboard positions, goals, assists, clean sheets, ratings and recent form.
- Help users navigate the website.
- Keep answers concise, friendly and useful.
- Use ONLY the verified facts supplied below.
- Never invent statistics, matches, players, rankings, injuries, tactics or Club state.
- If the facts do not answer the question, say that clearly.
- GG Rating is an official GG Matchday metric; do not replace it with outside data.
- You may recommend one navigation action, but ONLY choose from the allowed actions below.
- When mentioning a player, use their exact name from the facts.
- Do not expose internal IDs.

Allowed navigation actions:
${navigationActions.map(([type, label]) => type + " = " + label).join("\n")}

Return ONLY JSON:
{
  "answer": "string",
  "action": {
    "type": "home|record|leaderboard|calendar|players|hall-of-fame|clubs|clubs-my-club|clubs-players|clubs-reviews|player",
    "label": "short action label"
  } | null,
  "playerId": "only when action.type is player, otherwise null"
}

Verified facts:
${JSON.stringify(facts, null, 2)}
`,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: {
            answer: { type: "string" },
            action: {
              anyOf: [
                {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    label: { type: "string" },
                  },
                  required: ["type", "label"],
                },
                { type: "null" },
              ],
            },
            playerId: { anyOf: [{ type: "string" }, { type: "null" }] },
          },
          required: ["answer", "action", "playerId"],
        },
      },
    });

    const parsed = JSON.parse(response.output_text || "{}");
    const allowed = new Set(navigationActions.map(([type]) => type));
    const actionType = parsed.action?.type;
    const safeAction =
      allowed.has(actionType)
        ? {
            type: actionType,
            label: clean(parsed.action.label) || "OPEN →",
            ...(actionType === "player" && facts.mentionedPlayers.some(player => String(player.playerId) === String(parsed.playerId))
              ? { playerId: String(parsed.playerId) }
              : {}),
          }
        : intent.action;

    return {
      answer: clean(parsed.answer) || fallback.answer,
      action: safeAction,
      generatedBy: "gemini",
    };
  } catch (error) {
    console.error("GG Assistant Gemini error:", error?.message || error);
    return {
      ...fallback,
      aiError: error?.message || "Gemini unavailable",
    };
  }
}
