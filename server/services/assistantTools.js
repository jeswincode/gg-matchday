import {
  buildHeadToHead,
  buildPlayerPerformanceAnalytics,
  getMatchScores,
  id,
  sortDefensive,
  sortGoldenBoot,
  sortOffensive,
  sortPlaymaker,
} from "./statistics.js";
import { classifyPlayerStyles } from "./playerStyles.js";

const normalize = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const compact = row => row ? {
  playerId: row.playerId,
  name: row.name,
  position: row.position,
  profileImage: row.profileImage || "",
  matches: row.matches,
  wins: row.wins,
  draws: row.draws,
  losses: row.losses,
  goals: row.goals,
  assists: row.assists,
  ownGoals: row.ownGoals,
  cleanSheets: row.cleanSheets,
  averageRating: row.averageRating,
  performanceRating: row.performanceRating,
  offensiveRating: row.offensiveRating,
  defensiveRating: row.defensiveRating,
  ggRating: row.ggRating,
  form: row.form,
  recent: row.recent || [],
  defensiveRatedMatches: row.defensiveRatedMatches,
  defensiveEligible: row.defensiveEligible,
  ggEligible: row.ggEligible,
} : null;

function resolvePlayers(query, players) {
  const needle = normalize(query);
  if (!needle) return [];
  return players
    .map(player => ({ player, name: normalize(player.name) }))
    .filter(({ name }) => name === needle || name.includes(needle) || needle.includes(name) || name.split(" ").some(part => part.length >= 3 && needle.includes(part)))
    .sort((a, b) => b.name.length - a.name.length)
    .map(({ player }) => player);
}

function safePlayer(player, row, cohort) {
  if (!player) return null;
  return {
    ...compact(row),
    playerId: id(player),
    name: player.name,
    position: player.position || row?.position || "",
    styles: row ? classifyPlayerStyles(row, cohort).styles : [],
  };
}

export function createAssistantTools({ players = [], matches = [], rows = [], viewerPlayerId = null }) {
  const rowFor = playerId => rows.find(row => String(row.playerId) === String(playerId));
  const playerFor = playerId => players.find(player => id(player) === String(playerId));
  const searchPlayers = query => resolvePlayers(query, players).slice(0, 8).map(player => safePlayer(player, rowFor(id(player)), rows.filter(row => row.eligible)));
  const getPlayer = query => {
    const player = resolvePlayers(query, players)[0];
    return player ? safePlayer(player, rowFor(id(player)), rows.filter(row => row.eligible)) : null;
  };
  const getPlayerStats = query => {
    const player = typeof query === "object" ? playerFor(query.playerId) : resolvePlayers(query, players)[0];
    return player ? safePlayer(player, rowFor(id(player)), rows.filter(row => row.eligible)) : null;
  };
  const getPlayerForm = query => {
    const player = typeof query === "object" ? playerFor(query.playerId) : resolvePlayers(query, players)[0];
    if (!player) return null;
    const analytics = buildPlayerPerformanceAnalytics(players, matches, id(player));
    return { player: safePlayer(player, rowFor(id(player)), rows.filter(row => row.eligible)), recentRatings: analytics.last10Ratings, timeline: analytics.timeline.slice(-5), totals: analytics.totals };
  };
  const getPlayerPerformance = query => getPlayerForm(query);
  const getPlayerStyles = query => {
    const stats = getPlayerStats(query);
    return stats ? { player: stats, styles: stats.styles } : null;
  };
  const comparePlayers = queries => {
    const values = Array.isArray(queries) ? queries : [queries];
    const resolved = values.map(value => typeof value === "object" ? playerFor(value.playerId) : resolvePlayers(value, players)[0]).filter(Boolean);
    return resolved.length >= 2 ? { players: resolved.map(player => safePlayer(player, rowFor(id(player)), rows.filter(row => row.eligible))), headToHead: resolved.length === 2 ? buildHeadToHead(players, matches, id(resolved[0]), id(resolved[1])) : null } : null;
  };
  const getHeadToHead = (a, b) => {
    const first = typeof a === "object" ? playerFor(a.playerId) : resolvePlayers(a, players)[0];
    const second = typeof b === "object" ? playerFor(b.playerId) : resolvePlayers(b, players)[0];
    return first && second && id(first) !== id(second) ? buildHeadToHead(players, matches, id(first), id(second)) : null;
  };
  const ranking = (sort, predicate = () => true, limit = 5) => rows.filter(predicate).sort(sort).slice(0, limit).map(compact);
  const getLeaderboard = (limit = 10) => ranking((a, b) => (b.ggRating ?? -1) - (a.ggRating ?? -1) || a.name.localeCompare(b.name), row => row.ggRating != null, limit);
  const getOffensiveRanking = (limit = 5) => ranking(sortOffensive, row => row.offensiveRating != null, limit);
  const getDefensiveRanking = (limit = 5) => ranking(sortDefensive, row => row.defensiveEligible && row.defensiveRating != null, limit);
  const getGoldenBoot = (limit = 5) => ranking(sortGoldenBoot, row => row.goals > 0, limit);
  const getAssistLeader = (limit = 5) => ranking(sortPlaymaker, row => row.assists > 0, limit);
  const getRecentMatches = (limit = 8) => [...matches].sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, limit).map(match => {
    const scores = getMatchScores(match);
    return { matchId: id(match), date: match.date, name: match.name || "Football Match", sideA: match.teamA?.label || "Side 1", sideB: match.teamB?.label || "Side 2", scoreA: scores.teamA, scoreB: scores.teamB };
  });
  const getMyPlayer = () => viewerPlayerId ? getPlayerStats({ playerId: viewerPlayerId }) : null;
  const getMyStats = () => getMyPlayer();
  const getMyForm = () => viewerPlayerId ? getPlayerForm({ playerId: viewerPlayerId }) : null;
  return { searchPlayers, getPlayer, getPlayerStats, getPlayerForm, getPlayerPerformance, getPlayerStyles, comparePlayers, getHeadToHead, getLeaderboard, getOffensiveRanking, getDefensiveRanking, getGoldenBoot, getAssistLeader, getRecentMatches, getMyPlayer, getMyStats, getMyForm };
}

export { normalize, compact };
