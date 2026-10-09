import express from "express";
import mongoose from "mongoose";
import Player from "../models/Player.js";
import Match from "../models/Match.js";
import Award from "../models/Award.js";
import Achievement from "../models/Achievement.js";
import {
  buildStatistics,
  sortOffensive,
  sortDefensive,
  sortMostWins,
  sortGoldenBoot,
  sortPlaymaker,
  dateQuery,
  isClasico,
  milestones,
  selectAwards,
  id,
  compareByGG,
  buildHeadToHead,
  buildPlayerPerformanceAnalytics,
  getMatchScores,
} from "../services/statistics.js";
import { classifyPlayerStyles } from "../services/playerStyles.js";
import { loadPlayerStatistics } from "../services/persistedStatistics.js";

const router = express.Router();
const round = value => Number(Number(value).toFixed(2));
const safe = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    const invalid = /valid|year and month/i.test(error.message);
    res.status(invalid ? 400 : 500).json({
      message: invalid ? error.message : "Could not load football statistics.",
    });
  }
};
const matchChronology = (a, b) =>
  new Date(b.date) - new Date(a.date) ||
  new Date(b.createdAt || 0) - new Date(a.createdAt || 0) ||
  id(b).localeCompare(id(a));
const resultForPlayer = (match, playerId) => {
  const participants = Array.isArray(match?.participants) ? match.participants : [];
  const side = participants.find(participant => id(participant.player) === playerId)?.team;
  if (!side) return null;
  const scores = getMatchScores(match);
  return side === "A"
    ? (scores.teamA > scores.teamB ? "W" : scores.teamA === scores.teamB ? "D" : "L")
    : (scores.teamB > scores.teamA ? "W" : scores.teamB === scores.teamA ? "D" : "L");
};
const totalGoals = match => {
  const hasDetailedData =
    (Array.isArray(match?.events) && match.events.length > 0) ||
    (Array.isArray(match?.participants) && match.participants.some(participant => Number(participant.ownGoals || 0) > 0));
  if (!hasDetailedData) return Number(match?.teamA?.score || 0) + Number(match?.teamB?.score || 0);
  const scores = getMatchScores(match);
  return scores.teamA + scores.teamB;
};
const positionMatches = (stats, position) => {
  const pattern = ({
    attackers: /ST|CF|LW|RW|FORWARD|ATTACK/,
    midfielders: /CM|CAM|CDM|LM|RM|MIDFIELD/,
    defenders: /CB|LB|RB|LWB|RWB|DEFEND/,
    goalkeepers: /GK|GOALKEEP/,
  })[position] || /.*/;
  return pattern.test([stats.position, ...(stats.preferredPositions || [])].join(" ").toUpperCase());
};
const groupMatchYears = () => Match.aggregate([
  { $group: {
    _id: { $year: "$date" },
    matches: { $sum: 1 },
    goals: { $sum: { $add: [
      { $ifNull: ["$teamA.score", 0] },
      { $ifNull: ["$teamB.score", 0] },
    ] } },
  } },
  { $sort: { _id: -1 } },
]);
const annualAwardsFromSnapshots = (rows, year) => {
  const selections = [];
  const rated = rows.filter(row => row.ggRating !== null).sort(compareByGG);
  const eligible = rows.filter(row => row.eligible);
  const defensiveEligible = eligible.filter(row => row.defensiveEligible);
  const bestOffensive = [...eligible].sort(sortOffensive)[0];
  const bestDefensive = [...defensiveEligible].sort(sortDefensive)[0];
  const goldenBoot = [...eligible].filter(row => row.goals > 0).sort(sortGoldenBoot)[0];
  const assistLeader = [...eligible].filter(row => row.assists > 0).sort(sortPlaymaker)[0];
  const choices = [
    ["player", rated[0], "ggRating"],
    ["offensive", bestOffensive, "offensiveRating"],
    ["defensive", bestDefensive, "defensiveRating"],
    ["golden-boot", goldenBoot, "goals"],
    ["assist-leader", assistLeader, "assists"],
  ];
  for (const [type, row, metric] of choices) {
    if (!row) continue;
    selections.push({
      type, year, month: null, player: row.playerId, playerId: row.playerId,
      playerName: row.name, value: round(row[metric]), metric, finalized: false,
    });
  }
  return selections;
};

router.get("/overview", safe(async (req, res) => {
  const [players, matches, totals] = await Promise.all([
    Player.countDocuments(),
    Match.countDocuments(),
    Match.aggregate([
      {
        $project: {
          storedScoreTotal: {
            $add: [
              { $ifNull: ["$teamA.score", 0] },
              { $ifNull: ["$teamB.score", 0] },
            ],
          },
          normalGoalCount: {
            $size: {
              $filter: {
                input: { $ifNull: ["$events", []] },
                as: "event",
                cond: { $eq: ["$event.type", "goal"] },
              },
            },
          },
          ownGoalCount: {
            $sum: {
              $map: {
                input: { $ifNull: ["$participants", []] },
                as: "participant",
                in: {
                  $max: [
                    0,
                    {
                      $convert: {
                        input: "$participant.ownGoals",
                        to: "double",
                        onError: 0,
                        onNull: 0,
                      },
                    },
                  ],
                },
              },
            },
          },
          hasDetailedData: {
            $or: [
              { $gt: [{ $size: { $ifNull: ["$events", []] } }, 0] },
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ["$participants", []] },
                        as: "participant",
                        cond: {
                          $gt: [
                            {
                              $convert: {
                                input: "$participant.ownGoals",
                                to: "double",
                                onError: 0,
                                onNull: 0,
                              },
                            },
                            0,
                          ],
                        },
                      },
                    },
                  },
                  0,
                ],
              },
            ],
          },
        },
      },
      {
        $project: {
          totalGoals: {
            $cond: [
              "$hasDetailedData",
              { $add: ["$normalGoalCount", "$ownGoalCount"] },
              "$storedScoreTotal",
            ],
          },
        },
      },
      { $group: { _id: null, goals: { $sum: "$totalGoals" } } },
    ]),
  ]);
  res.json({ players, matches, goals: Number(totals[0]?.goals || 0) });
}));

router.get("/leaderboard", safe(async (req, res) => {
  const players = await Player.find().lean();
  const clasico = req.query.clasico === "true";
  const requestedYear = req.query.year ? Number(req.query.year) : null;
  const month = req.query.month ? Number(req.query.month) : null;
  let rows;

  if (clasico || month !== null) {
    const year = requestedYear || new Date().getUTCFullYear();
    const filter = dateQuery(year, month);
    let matches = await Match.find(filter).lean();
    if (clasico) matches = matches.filter(match => isClasico(match.name));
    rows = buildStatistics(players, matches, { minimumMatches: clasico ? 3 : 5 });
  } else {
    rows = await loadPlayerStatistics(players, { year: requestedYear });
  }

  const filtered = req.query.position ? rows.filter(stats => positionMatches(stats, req.query.position)) : rows;
  res.json({
    leaderboard: filtered,
    offensive: filtered.filter(stats => stats.eligible).sort(sortOffensive),
    defensive: filtered.filter(stats => stats.eligible && stats.defensiveEligible).sort(sortDefensive),
  });
}));

router.get("/awards", safe(async (req, res) => {
  const year = Number(req.query.year) || new Date().getUTCFullYear();
  const month = req.query.month ? Number(req.query.month) : undefined;
  const matches = await Match.find(dateQuery(year, month)).lean();
  const players = await Player.find().lean();
  const awards = selectAwards(players, matches, { year, month });
  const winner = awards.find(award => award.type === "player");
  res.json({ winner: winner ? { ...winner, name: winner.playerName, ggRating: winner.value } : null, awards, provisional: true });
}));

router.get("/award-history", safe(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();
  dateQuery(year);
  const [awards, years] = await Promise.all([
    Award.find({ year }).sort({ month: 1, type: 1 }).lean(),
    groupMatchYears(),
  ]);
  res.json({ awards, years: years.map(item => item._id) });
}));

router.get("/calendar", safe(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();
  const matches = await Match.find(dateQuery(year, req.query.month))
    .populate("participants.player", "name profileImage")
    .populate("events.player", "name")
    .sort({ date: 1 })
    .lean();
  res.json({ matches });
}));

router.get("/player/:id", safe(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid player id." });
  const player = await Player.findById(req.params.id).lean();
  if (!player) return res.status(404).json({ message: "Player not found." });
  const [players, own] = await Promise.all([
    Player.find().lean(),
    Match.find({ "participants.player": player._id }).lean(),
  ]);
  own.sort(matchChronology);
  const [allStats, stats] = await Promise.all([
    loadPlayerStatistics(players),
    loadPlayerStatistics([player]),
  ]);
  const currentStats = stats[0];
  const styleCohort = allStats.filter(row => row.eligible);
  const styles = classifyPlayerStyles(currentStats, styleCohort);
  currentStats.recent = own.slice(0, 5).map(match => ({
    matchId: id(match), date: match.date, result: resultForPlayer(match, id(player)),
  }));
  const years = [...new Set(own.map(match => new Date(match.date).getUTCFullYear()))].sort((a, b) => b - a);
  const seasons = await Promise.all(years.map(async year => ({
    year,
    ...(await loadPlayerStatistics([player], { year }))[0],
  })));
  const [awards, achievements] = await Promise.all([
    Award.find({ player: player._id }).sort({ year: -1 }).lean(),
    Achievement.find({ player: player._id }).lean(),
  ]);
  const matchHistory = req.query.historyLimit === "all" ? own : own.slice(0, 20);
  const clasico = buildStatistics([player], own.filter(match => isClasico(match.name)), { minimumMatches: 3 })[0];
  res.json({
    player, stats: currentStats, matches: matchHistory, seasons, awards, achievements,
    milestones: milestones(currentStats), styles, clasico,
  });
}));

router.get('/player/:id/performance', safe(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid player id." });
  const player = await Player.findById(req.params.id).lean();
  if (!player) return res.status(404).json({ message: "Player not found." });
  const [players, matches, rows] = await Promise.all([
    Player.find().lean(),
    Match.find({ "participants.player": player._id }).lean(),
    loadPlayerStatistics([player]),
  ]);
  res.json({ player, stats: rows[0], analytics: buildPlayerPerformanceAnalytics(players, matches, req.params.id) });
}));

router.get("/head-to-head/:a/:b", safe(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.a) || !mongoose.isValidObjectId(req.params.b)) {
    return res.status(400).json({ message: "Invalid player id." });
  }
  const [players, matches] = await Promise.all([
    Player.find({ _id: { $in: [req.params.a, req.params.b] } }).lean(),
    Match.find({ "participants.player": { $all: [req.params.a, req.params.b] } }).lean(),
  ]);
  const result = buildHeadToHead(players, matches, req.params.a, req.params.b);
  if (!result) return res.status(404).json({ message: "Both players must exist and be different players." });
  res.json(result);
}));

router.get("/goals", safe(async (req, res) => {
  const players = await Player.find().lean();
  const rows = (await loadPlayerStatistics(players)).filter(stats => stats.goals > 0)
    .sort((a, b) => b.goals - a.goals || compareByGG(a, b) || a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId));
  res.json({ records: rows.map(stats => ({ playerId: stats.playerId, name: stats.name, profileImage: stats.profileImage, goals: stats.goals })) });
}));

router.get("/seasons", safe(async (req, res) => {
  const [players, aggregate, persistedAwards] = await Promise.all([
    Player.find().lean(),
    groupMatchYears(),
    Award.find({ month: null }).lean(),
  ]);
  const seasons = [];
  const currentYear = new Date().getUTCFullYear();
  for (const yearData of aggregate) {
    const year = Number(yearData._id);
    const rows = await loadPlayerStatistics(players, { year });
    const [clasicoMatches,] = await Promise.all([
      Match.find({ ...dateQuery(year), name: { $regex: /cl[aá]sico|clasico/i } }).lean(),
    ]);
    const clasicoAwards = selectAwards(players, clasicoMatches.filter(match => isClasico(match.name)), { year })
      .filter(award => award.type === "clasico");
    const computed = annualAwardsFromSnapshots(rows, year);
    if (clasicoAwards[0]) computed.push({ ...clasicoAwards[0], finalized: false });
    const byType = new Map(computed.map(award => [award.type, award]));
    for (const award of persistedAwards.filter(item => Number(item.year) === year)) {
      byType.set(award.type, {
        type: award.type, year: award.year, month: award.month ?? null, player: award.player,
        playerId: id(award.player), playerName: award.playerName, value: award.value,
        metric: award.metric, finalized: true,
      });
    }
    seasons.push({
      year,
      matches: yearData.matches,
      players: rows.filter(stats => stats.matches > 0).length,
      goals: yearData.goals,
      status: year === currentYear ? "live" : "archived",
      awards: [...byType.values()],
    });
  }
  res.json({ seasons });
}));

router.get("/clasico", safe(async (req, res) => {
  const [players, matches] = await Promise.all([
    Player.find().lean(),
    Match.find({ name: { $regex: /cl[aá]sico|clasico/i } }).lean(),
  ]);
  const clasicoMatches = matches.filter(match => isClasico(match.name));
  const statistics = buildStatistics(players, clasicoMatches, { minimumMatches: 3 });
  const sides = ["Messi", "Ronaldo"].map(side => {
    const rows = statistics.filter(stats => stats.clasicoSide === side);
    const result = { side, players: rows.length };
    for (const key of ["matches", "wins", "draws", "losses", "goals", "assists", "cleanSheets", "goalContributions"]) {
      result[key] = rows.reduce((sum, stats) => sum + stats[key], 0);
    }
    const weighted = rows.reduce((sum, stats) => sum + (stats.averageRating || 0) * stats.ratedMatches, 0);
    const rated = rows.reduce((sum, stats) => sum + stats.ratedMatches, 0);
    result.averageRating = rated ? weighted / rated : null;
    return result;
  });
  res.json({ statistics, sides, matches: clasicoMatches.sort((a, b) => new Date(b.date) - new Date(a.date)) });
}));

router.get("/hall-of-fame", safe(async (req, res) => {
  const [players, awards, years] = await Promise.all([
    Player.find().lean(),
    Award.find().sort({ year: -1 }).lean(),
    groupMatchYears(),
  ]);
  const rows = await loadPlayerStatistics(players);
  const records = ["goals", "assists", "wins", "cleanSheets", "ggRating"].map(key => ({
    key,
    player: [...rows].filter(stats => stats[key] !== null && stats[key] > 0)
      .sort(key === "wins"
        ? sortMostWins
        : (a, b) => (b[key] - a[key]) || compareByGG(a, b) || a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId))[0] || null,
  }));
  const motm = new Map();
  for (const award of awards.filter(item => item.type === "motm")) motm.set(id(award.player), (motm.get(id(award.player)) || 0) + 1);
  const most = [...motm].map(([playerId, count]) => {
    const stats = rows.find(row => row.playerId === playerId);
    return { playerId, count, ggRating: stats?.ggRating ?? -1, averageRating: stats?.averageRating ?? -1, matches: stats?.matches ?? 0, name: stats?.name ?? "" };
  }).sort((a, b) => b.count - a.count || b.ggRating - a.ggRating || b.averageRating - a.averageRating || b.matches - a.matches || a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId))[0];
  res.json({
    records,
    mostMotm: most ? { player: players.find(player => id(player) === most.playerId), count: most.count } : null,
    awards,
    years: years.map(item => item._id),
  });
}));

export default router;
