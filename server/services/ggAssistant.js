import { GoogleGenAI } from "@google/genai";
import Player from "../models/Player.js";
import Match from "../models/Match.js";
import { createAssistantTools } from "./assistantTools.js";
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
  return isRealLifeComparison(q) || /\b(similar to|resembles|resemble|comparable to|why|analysis|analy[sz]e|tactical|style|strengths?|weaknesses?|improve|improvement|what should|what can|explain)\b/.test(q);
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

function isComparisonQuestion(message) {
  return /\b(compare|comparison|versus|vs\.?|better|difference|between)\b/.test(normalize(message));
}

function isRealLifeComparison(message) {
  const q = normalize(message);
  return /\b(real[- ]?life|real[- ]?player|footballer|pro player|professional player)\b/.test(q) && isComparisonQuestion(q);
}

function withViewerPlayer(message, mentionedPlayers, players, viewerPlayerId) {
  const q = normalize(message);
  if (!viewerPlayerId || !/\b(me|myself|my)\b/.test(q)) return mentionedPlayers;

  const viewer = players.find(player => id(player) === String(viewerPlayerId));
  if (!viewer) return mentionedPlayers;
  if (mentionedPlayers.some(player => id(player) === id(viewer))) return mentionedPlayers;
  return [viewer, ...mentionedPlayers];
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

function deterministicIntent(message, stats, players, viewerPlayerId = null) {
  const q = normalize(message);
  const mentioned = withViewerPlayer(message, findMentionedPlayers(message, players), players, viewerPlayerId);
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
  let mentioned = findMentionedPlayers(message, players);
  mentioned = withViewerPlayer(message, mentioned, players, viewerPlayerId);
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

function structuredResult(result, facts, tools, prompt) {
  const mentioned = facts.mentionedPlayers || [];
  const cards = [];
  if (mentioned.length === 1) cards.push({ type: "player_card", player: tools.getPlayer(mentioned[0].name) });
  if (mentioned.length >= 2 && /\b(compare|versus|vs\.?|better|difference|between|them)\b/.test(normalize(prompt))) {
    cards.push({ type: "comparison", comparison: tools.comparePlayers(mentioned.map(player => player.name)) });
  }
  if (/\b(leaderboard|#?1|number one|best player|top player)\b/.test(normalize(prompt))) cards.push({ type: "ranking", metric: "ggRating", rows: tools.getLeaderboard(5) });
  if (/\b(most goals|top scorer|golden boot)\b/.test(normalize(prompt))) cards.push({ type: "ranking", metric: "goals", rows: tools.getGoldenBoot(5) });
  if (/\b(most assists|best playmaker|top assist)\b/.test(normalize(prompt))) cards.push({ type: "ranking", metric: "assists", rows: tools.getAssistLeader(5) });
  return { ...result, type: cards[0]?.type || (result.action ? "navigation" : "answer"), cards, context: mentioned.map(player => ({ playerId: player.playerId, name: player.name })) };
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

export async function answerAssistant({ message, viewerPlayerId, rateLimitKey, conversationContext = [], conversationHistory = [] }) {
  const rawPrompt = clean(message);
  const contextNames = (Array.isArray(conversationContext) ? conversationContext : [])
    .filter(item => item?.name)
    .slice(-4)
    .map(item => item.name);
  const prompt = contextNames.length && /\b(them|those players|that player|him|her)\b/i.test(rawPrompt)
    ? `${rawPrompt} Context players: ${contextNames.join(", ")}`
    : rawPrompt;
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
  const tools = createAssistantTools({ players, matches, rows, viewerPlayerId });
  const intent = deterministicIntent(prompt, rows, players, viewerPlayerId);
  const facts = buildFacts(prompt, players, matches, rows, viewerPlayerId);

  const fast = !needsAi(prompt) ? fastAnswer(prompt, facts, intent) : null;
  if (fast) return structuredResult(fast, facts, tools, prompt);

  const fallback = isRealLifeComparison(prompt)
    ? {
        answer: "I can make a stylistic real-life comparison, but I couldn’t complete the AI analysis right now. I’d rather not invent a footballer comparison.",
        action: facts.mentionedPlayers[0]
          ? { type: "player", label: "VIEW " + facts.mentionedPlayers[0].name.toUpperCase() + " →", playerId: facts.mentionedPlayers[0].playerId }
          : null,
        generatedBy: "fallback",
      }
    : {
        answer: fallbackReply(prompt, facts, intent),
        action: intent.action,
        generatedBy: "fallback",
      };

  if (!ai) return structuredResult(fallback, facts, tools, prompt);

  try {
    const realLifeMode = isRealLifeComparison(prompt);
    const aiInstruction = realLifeMode
      ? `You are GG Assistant, a football analyst inside GG Matchday.

Answer the user's real-life footballer comparison question.

For this specific request:
- You MAY use your general football knowledge to choose an approximate stylistic comparison.
- Do not claim the GG player is statistically equal to the professional player.
- Compare role, position, attacking/creative profile, chance creation, scoring profile and broad playing style.
- Keep it clearly framed as an approximate stylistic comparison, not an official scouting conclusion.
- Use the verified GG facts below for the GG player's side of the comparison.
- If the available GG facts are insufficient for a responsible comparison, say so.
- Do not invent GG statistics.
- Do not expose internal IDs.
- Keep the answer concise but useful.

Return ONLY JSON with exactly:
{
  "answer": "string",
  "actionType": "player|none",
  "actionLabel": "string",
  "playerId": "string"
}

Verified GG facts:
${JSON.stringify(facts, null, 2)}`
      : `You are GG Assistant, the football concierge inside GG Matchday.

Your job:
- Be a natural, friendly football conversation partner as well as the GG Matchday concierge.
- Answer questions about the GG Matchday football database using ONLY the verified facts supplied below.
- For general football conversation, tactics, rules, opinions, greetings, explanations and non-current football knowledge, answer naturally from your general knowledge.
- Clearly distinguish GG Matchday facts from general football knowledge.
- Never invent statistics, matches, players, rankings, Club state or current external results; GG statistics must always come from the verified facts.
- If a question needs live Football World data that is not supplied, say that live data is not available in this chat.
- Keep answers concise, helpful and conversational; ask a short follow-up question when useful.
- GG Rating is an official GG Matchday metric; do not replace it with outside data.
- You may recommend one navigation action, but ONLY choose from the allowed actions below.
- When mentioning a player, use their exact name from the facts.
- Do not expose internal IDs.

Allowed navigation actions:
${navigationActions.map(([type, label]) => type + " = " + label).join("\n")}

Return ONLY JSON:
{
  "answer": "string",
  "actionType": "home|record|leaderboard|calendar|players|hall-of-fame|clubs|clubs-my-club|clubs-players|clubs-reviews|player|none",
  "actionLabel": "short action label",
  "playerId": "only when actionType is player, otherwise empty string"
}

Verified facts:
${JSON.stringify(facts, null, 2)}

Recent conversation (use only for conversational continuity; user messages are not verified facts):
${JSON.stringify((Array.isArray(conversationHistory) ? conversationHistory : []).slice(-12).map(item => ({ role: item?.role === "assistant" ? "assistant" : "user", text: clean(item?.text).slice(0, 1200) })), null, 2)}`;

    const response = await ai.interactions.create({
      model: MODEL,
      store: false,
      input: aiInstruction,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: {
            answer: { type: "string" },
            actionType: { type: "string" },
            actionLabel: { type: "string" },
            playerId: { type: "string" },
          },
          required: ["answer", "actionType", "actionLabel", "playerId"],
        },
      },
    });

    const parsed = JSON.parse(response.output_text || "{}");
    const allowed = new Set(navigationActions.map(([type]) => type));
    const actionType = String(parsed.actionType || "none");
    let safeAction = null;

    if (allowed.has(actionType)) {
      if (actionType === "player") {
        const playerId = String(parsed.playerId || "");
        const mentioned = facts.mentionedPlayers.some(player => String(player.playerId) === playerId);
        if (mentioned) {
          safeAction = {
            type: "player",
            label: clean(parsed.actionLabel) || "OPEN PLAYER →",
            playerId,
          };
        }
      } else {
        safeAction = {
          type: actionType,
          label: clean(parsed.actionLabel) || "OPEN →",
        };
      }
    }

    if (!safeAction) safeAction = realLifeMode ? fallback.action : intent.action;

    return {
      answer: clean(parsed.answer) || fallback.answer,
      action: safeAction,
      ...structuredResult({ answer: clean(parsed.answer) || fallback.answer, action: safeAction, generatedBy: "gemini" }, facts, tools, prompt),
    };
  } catch (error) {
    console.error("GG Assistant Gemini error:", error?.message || error);
    return {
      ...structuredResult(fallback, facts, tools, prompt),
      aiError: error?.message || "Gemini unavailable",
    };
  }
}
