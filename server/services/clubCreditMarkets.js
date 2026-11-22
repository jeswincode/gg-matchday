import Club from "../models/clubs/Club.js";
import ClubContract from "../models/clubs/ClubContract.js";
import ClubMatch from "../models/clubs/ClubMatch.js";
import Match from "../models/Match.js";
import Player from "../models/Player.js";
import { effectiveMatchRating } from "./ratings/index.js";

const average = (total, count, prior, weight) => (total + prior * weight) / (count + weight);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const idOf = value => String(value?._id ?? value);

export const CREDIT_MARKETS = Object.freeze({ startingBank: 10_000, maxOdds: 30, margin: 0.06, fixtureLimit: 5 });

export function fixedOdds(probability) {
  return clamp(Math.floor(100 / (probability * (1 + CREDIT_MARKETS.margin))) / 100, 1.01, CREDIT_MARKETS.maxOdds);
}

function scoreDistribution(rate) {
  const probabilities = [Math.exp(-rate)];
  for (let score = 1; score <= 20; score++) probabilities.push(probabilities[score - 1] * rate / score);
  return probabilities;
}

export function resultProbabilities(homeRate, awayRate) {
  const home = scoreDistribution(homeRate);
  const away = scoreDistribution(awayRate);
  const probabilities = { home: 0, draw: 0, away: 0 };
  home.forEach((chance, first) => {
    away.forEach((otherChance, second) => {
      probabilities[first === second ? "draw" : first > second ? "home" : "away"] += chance * otherChance;
    });
  });
  const total = probabilities.home + probabilities.draw + probabilities.away;
  return Object.fromEntries(Object.entries(probabilities).map(([outcome, chance]) => [outcome, chance / total]));
}

export function playerEvents(match, playerId) {
  const events = (match.events || []).filter(event => idOf(event.player) === playerId);
  return {
    goals: events.filter(event => event.type === "goal").length,
    assists: events.filter(event => event.type === "assist").length,
  };
}

function summarizePlayer(playerId, career, clubMatchIds) {
  let matches = 0, weight = 0, goals = 0, assists = 0, ratingSum = 0, ratingWeight = 0;
  for (const match of career) {
    const participant = match.participants?.find(item => idOf(item.player) === playerId);
    if (!participant) continue;
    const importance = clubMatchIds.has(idOf(match)) ? 2 : 1;
    const events = playerEvents(match, playerId);
    matches++;
    weight += importance;
    goals += importance * events.goals;
    assists += importance * events.assists;
    const rating = effectiveMatchRating(participant);
    if (rating != null) {
      ratingSum += importance * rating;
      ratingWeight += importance;
    }
  }
  return {
    matches,
    goalRate: average(goals, weight, 0.35, 5),
    assistRate: average(assists, weight, 0.25, 5),
    rating: average(ratingSum, ratingWeight, 6, 5),
  };
}

function summarizeClub(club, matches) {
  const id = idOf(club);
  const recent = matches.filter(match => [idOf(match.clubAId), idOf(match.clubBId)].includes(id)).slice(0, 12);
  let goals = 0, allowed = 0;
  for (const match of recent) {
    const home = idOf(match.clubAId) === id;
    goals += Number(home ? match.clubAScore : match.clubBScore);
    allowed += Number(home ? match.clubBScore : match.clubAScore);
  }
  return { recent, attack: average(goals, recent.length, 2, 4), defence: average(allowed, recent.length, 2, 4) };
}

export function fixtureOpenForCreditBets(match, now = new Date()) {
  return match?.status === "accepted" && match.source !== "unbooked" && new Date(match.scheduledAt) > now;
}

export async function loadCreditMarkets(fixture) {
  if (!fixtureOpenForCreditBets(fixture)) throw new Error("Fixed odds are closed for this fixture.");
  const clubIds = [fixture.clubAId, fixture.clubBId];
  const [clubs, completed, contracts] = await Promise.all([
    Club.find({ _id: { $in: clubIds }, status: "approved" }).select("name").lean(),
    ClubMatch.find({
      status: "completed", mainMatchId: { $ne: null }, scheduledAt: { $lt: fixture.scheduledAt },
      $or: [{ clubAId: { $in: clubIds } }, { clubBId: { $in: clubIds } }],
    }).sort({ scheduledAt: -1, _id: -1 }).limit(40).lean(),
    ClubContract.find({ clubId: { $in: clubIds }, startAt: { $lte: fixture.scheduledAt }, endAt: { $gt: fixture.scheduledAt } })
      .select("playerId clubId").lean(),
  ]);
  const [home, away] = clubIds.map(id => clubs.find(club => idOf(club) === idOf(id)));
  if (!home || !away) throw new Error("Both Clubs must be active to offer fixed odds.");
  const players = await Player.find({ _id: { $in: contracts.map(contract => contract.playerId) } }).select("name").lean();
  const career = players.length ? await Match.find({
    "participants.player": { $in: players.map(player => player._id) },
    date: { $lt: new Date() },
  }).select("participants events").sort({ date: -1, _id: -1 }).limit(180).lean() : [];
  const playerById = new Map(players.map(player => [idOf(player), player]));
  const clubMatchIds = new Set(completed.map(match => idOf(match.mainMatchId)));
  const declared = [home, away].map(club => fixture.lineups?.find(lineup => lineup.confirmed && idOf(lineup.clubId) === idOf(club)));
  const rosters = [home, away].map((club, side) => contracts
    .filter(contract => idOf(contract.clubId) === idOf(club) && playerById.has(idOf(contract.playerId)) &&
      (!declared[side] || declared[side].playerIds.some(id => idOf(id) === idOf(contract.playerId))))
    .map(contract => {
      const player = playerById.get(idOf(contract.playerId));
      return { player, ...summarizePlayer(idOf(player), career, clubMatchIds) };
    }));
  const [a, b] = [home, away].map(club => summarizeClub(club, completed));
  const ratings = rosters.map(roster => average(roster.reduce((sum, row) => sum + row.rating, 0), roster.length, 6, 2));
  const lineupEdge = clamp((ratings[0] - ratings[1]) * 0.21, -0.6, 0.6);
  const rates = [
    clamp((a.attack + b.defence) / 2 * Math.exp(lineupEdge), 0.25, 6),
    clamp((b.attack + a.defence) / 2 * Math.exp(-lineupEdge), 0.25, 6),
  ];
  const results = resultProbabilities(...rates);
  function selection(market, subject, probability, name = subject?.name) {
    const subjectId = subject ? idOf(subject) : null;
    return { key: market + ":" + (subjectId || "draw"), market, subjectId, name, probability, odds: fixedOdds(probability) };
  }
  const selections = [
    selection("result", home, results.home), selection("result", null, results.draw, "Draw"), selection("result", away, results.away),
    selection("cleanSheet", home, Math.exp(-rates[1])), selection("cleanSheet", away, Math.exp(-rates[0])),
  ];
  const playerGroups = rosters.flatMap((roster, side) => roster.map(row => {
    const opponentAdjustment = clamp(rates[side] / 2, 0.55, 1.65);
    const goals = scoreDistribution(clamp(row.goalRate * opponentAdjustment, 0.03, 4));
    const assists = clamp(row.assistRate * opponentAdjustment, 0.03, 3);
    return {
      playerId: idOf(row.player),
      name: row.player.name,
      club: [home, away][side].name,
      confirmed: Boolean(declared[side]),
      sample: row.matches,
      selections: [
        selection("goal", row.player, 1 - goals[0]),
        selection("assist", row.player, 1 - Math.exp(-assists)),
        selection("hatTrick", row.player, 1 - goals[0] - goals[1] - goals[2]),
      ],
    };
  }));
  return { fixtureId: idOf(fixture), closesAt: fixture.scheduledAt,
    confirmedLineups: declared.filter(Boolean).length, history: [a.recent.length, b.recent.length], selections, playerGroups };
}

export function creditBetOutcome(bet, fixture, match) {
  if (fixture.status === "cancelled") return "refunded";
  const subject = idOf(bet.subjectId);
  if (bet.market === "result") {
    if (bet.subjectId) return subject === idOf(fixture.winnerClubId) ? "won" : "lost";
    return fixture.winnerClubId ? "lost" : "won";
  }
  if (bet.market === "cleanSheet") {
    const conceded = subject === idOf(fixture.clubAId) ? fixture.clubBScore : fixture.clubAScore;
    return conceded === 0 ? "won" : "lost";
  }
  if (!match.participants?.some(player => idOf(player.player) === subject)) return "refunded";
  const recorded = playerEvents(match, subject);
  const won = bet.market === "assist" ? recorded.assists > 0 : recorded.goals >= (bet.market === "hatTrick" ? 3 : 1);
  return won ? "won" : "lost";
}
