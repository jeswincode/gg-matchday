import mongoose from "mongoose";
import ClubContract from "../models/clubs/ClubContract.js";
import ClubMatch from "../models/clubs/ClubMatch.js";
import ClubPlayerStats from "../models/clubs/ClubPlayerStats.js";
import ClubHistory from "../models/clubs/ClubHistory.js";
import Match from "../models/Match.js";
import { getClubsConnection } from "../config/clubsDatabase.js";

const idOf = value => String(value?._id || value);

export function winnerForClub(scoreA, scoreB, isA) {
  if (scoreA === scoreB) return "draw";
  if (isA) return scoreA > scoreB ? "win" : "loss";
  return scoreB > scoreA ? "win" : "loss";
}

async function findContractMap(playerIds, date) {
  const contracts = await ClubContract.find({
    playerId: { $in: playerIds.map(id => new mongoose.Types.ObjectId(id)) },
    startAt: { $lte: date },
    endAt: { $gt: date },
  }).lean();
  return new Map(contracts.map(contract => [idOf(contract.playerId), contract]));
}

export function inferClubSides(mainMatch, contractMap, clubMatch) {
  const allowed = new Set([String(clubMatch.clubAId), String(clubMatch.clubBId)]);
  const sideClubIds = { A: new Set(), B: new Set() };
  const sideCounts = { A: 0, B: 0 };
  for (const participant of mainMatch.participants || []) {
    const contract = contractMap.get(idOf(participant.player));
    if (!contract || !allowed.has(String(contract.clubId))) return null;
    if (!["A", "B"].includes(participant.team)) return null;
    sideCounts[participant.team] += 1;
    sideClubIds[participant.team].add(String(contract.clubId));
  }
  if (sideCounts.A < 2 || sideCounts.A > 4 || sideCounts.B < 2 || sideCounts.B > 4) return null;
  if (sideClubIds.A.size !== 1 || sideClubIds.B.size !== 1) return null;
  const clubA = String(clubMatch.clubAId), clubB = String(clubMatch.clubBId);
  if (sideClubIds.A.has(clubA) && sideClubIds.B.has(clubB)) return { clubAIsSideA: true };
  if (sideClubIds.A.has(clubB) && sideClubIds.B.has(clubA)) return { clubAIsSideA: false };
  return null;
}

export async function attachMainMatchToClubMatch(mainMatch) {
  if (!mainMatch?._id) return { linked: false, clubMatchIds: [], affectedClubIds: [] };

  const playerIds = [...new Set(
    (mainMatch.participants || []).map(p => idOf(p.player)).filter(Boolean),
  )];
  if (!playerIds.length) return { linked: false, clubMatchIds: [], affectedClubIds: [] };

  const contractMap = await findContractMap(playerIds, mainMatch.date);
  if (contractMap.size < 2) return { linked: false, clubMatchIds: [], affectedClubIds: [] };

  const dayStart = new Date(mainMatch.date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const linked = [];
  const affectedClubIds = new Set();

  const existingLinked = await ClubMatch.find({
    mainMatchId: mainMatch._id,
    status: "completed",
  }).lean();

  const candidates = await ClubMatch.find({
    status: "accepted",
    scheduledAt: { $gte: dayStart, $lt: dayEnd },
    mainMatchId: null,
  }).lean();

  const mainMatchTime = new Date(mainMatch.date).getTime();
  candidates.sort((left, right) =>
    Math.abs(new Date(left.scheduledAt).getTime() - mainMatchTime) -
    Math.abs(new Date(right.scheduledAt).getTime() - mainMatchTime),
  );

  const scoreFor = (clubMatch, inference) => {
    const scoreA = Number(mainMatch.teamA?.score || 0);
    const scoreB = Number(mainMatch.teamB?.score || 0);
    return {
      clubAScore: inference.clubAIsSideA ? scoreA : scoreB,
      clubBScore: inference.clubAIsSideA ? scoreB : scoreA,
      winnerClubId: scoreA === scoreB
        ? null
        : (inference.clubAIsSideA
          ? (scoreA > scoreB ? clubMatch.clubAId : clubMatch.clubBId)
          : (scoreB > scoreA ? clubMatch.clubAId : clubMatch.clubBId)),
    };
  };

  for (const clubMatch of existingLinked) {
    const inference = inferClubSides(mainMatch, contractMap, clubMatch);
    if (!inference) continue;
    const updated = await ClubMatch.findOneAndUpdate(
      { _id: clubMatch._id, mainMatchId: mainMatch._id, status: "completed" },
      { $set: scoreFor(clubMatch, inference) },
      { new: true },
    );
    if (updated) {
      linked.push(updated);
      affectedClubIds.add(String(updated.clubAId));
      affectedClubIds.add(String(updated.clubBId));
    }
  }

  for (const clubMatch of candidates) {
    const inference = inferClubSides(mainMatch, contractMap, clubMatch);
    if (!inference) continue;
    const updated = await ClubMatch.findOneAndUpdate(
      { _id: clubMatch._id, status: "accepted", mainMatchId: null },
      {
        $set: {
          status: "completed",
          mainMatchId: mainMatch._id,
          ...scoreFor(clubMatch, inference),
        },
      },
      { new: true },
    );
    if (updated) {
      linked.push(updated);
      affectedClubIds.add(String(updated.clubAId));
      affectedClubIds.add(String(updated.clubBId));
      break;
    }
  }

  for (const clubId of affectedClubIds) {
    const linkedClubMatch = linked.find(
      item => String(item.clubAId) === clubId || String(item.clubBId) === clubId,
    );
    await rebuildClubPlayerStats(clubId);
    await ClubHistory.findOneAndUpdate(
      { clubId, relatedMainMatchId: mainMatch._id, eventType: "matchPlayed" },
      {
        $set: {
          relatedClubMatchId: linkedClubMatch?._id || null,
          description: "Club statistics synced from the normal GG Match Record.",
          metadata: {
            mainMatchId: String(mainMatch._id),
            clubMatchId: String(linkedClubMatch?._id || ""),
            clubAScore: Number(linkedClubMatch?.clubAScore ?? 0),
            clubBScore: Number(linkedClubMatch?.clubBScore ?? 0),
          },
          occurredAt: new Date(mainMatch.date),
        },
        $setOnInsert: {
          clubId,
          relatedMainMatchId: mainMatch._id,
          eventType: "matchPlayed",
        },
      },
      { upsert: true },
    );
  }

  return {
    linked: linked.length > 0,
    clubMatchIds: linked.map(item => String(item._id)),
    affectedClubIds: [...affectedClubIds],
  };
}
export async function rebuildClubPlayerStats(clubId) {
  const completedClubMatches = await ClubMatch.find({
    status: "completed",
    $or: [{ clubAId: clubId }, { clubBId: clubId }],
    mainMatchId: { $ne: null },
  }).sort({ scheduledAt: 1, createdAt: 1 }).lean();

  const contracts = await ClubContract.find({ clubId }).lean();
  const matchIds = completedClubMatches.map(item => item.mainMatchId);
  const mainMatches = matchIds.length ? await Match.find({ _id: { $in: matchIds } }).lean() : [];
  const mainMatchById = new Map(mainMatches.map(match => [String(match._id), match]));
  const playerIds = [...new Set(contracts.map(contract => String(contract.playerId)))];
  const stats = [];

  for (const playerId of playerIds) {
    let matchesPlayed = 0, wins = 0, draws = 0, losses = 0;
    let goals = 0, assists = 0, motm = 0, ratingTotal = 0, ratedMatches = 0;
    let lastMainMatchId = null, lastPlayedAt = null;

    for (const clubMatch of completedClubMatches) {
      const mainMatch = mainMatchById.get(String(clubMatch.mainMatchId));
      if (!mainMatch) continue;
      const contract = contracts.find(item =>
        String(item.playerId) === playerId &&
        new Date(item.startAt) <= new Date(mainMatch.date) &&
        new Date(item.endAt) > new Date(mainMatch.date),
      );
      if (!contract) continue;

      const participant = (mainMatch.participants || []).find(item => idOf(item.player) === playerId);
      if (!participant) continue;

      matchesPlayed += 1;
      const isA = String(clubMatch.clubAId) === String(clubId);
      const outcome = winnerForClub(Number(clubMatch.clubAScore || 0), Number(clubMatch.clubBScore || 0), isA);
      if (outcome === "win") wins += 1;
      else if (outcome === "draw") draws += 1;
      else losses += 1;

      goals += (mainMatch.events || []).filter(event => event.type === "goal" && idOf(event.player) === playerId).length;
      assists += (mainMatch.events || []).filter(event => event.type === "assist" && idOf(event.player) === playerId).length;
      if (idOf(mainMatch.motmWinner) === playerId) motm += 1;

      if (Number.isFinite(Number(participant.rating))) {
        ratingTotal += Number(participant.rating);
        ratedMatches += 1;
      }
      if (!lastPlayedAt || new Date(mainMatch.date) > new Date(lastPlayedAt)) {
        lastPlayedAt = mainMatch.date;
        lastMainMatchId = mainMatch._id;
      }
    }

    if (matchesPlayed) {
      stats.push({
        clubId: new mongoose.Types.ObjectId(clubId),
        playerId: new mongoose.Types.ObjectId(playerId),
        matches: matchesPlayed, wins, draws, losses, goals, assists, motm,
        ratingTotal, ratedMatches, lastMainMatchId, lastPlayedAt,
      });
    }
  }

  await ClubPlayerStats.deleteMany({ clubId });
  if (stats.length) await ClubPlayerStats.insertMany(stats);
  return stats;
}

export async function syncClubStatsForMatch(mainMatch) {
  if (getClubsConnection().readyState !== 1) {
    throw new Error("Clubs database is not connected.");
  }
  return attachMainMatchToClubMatch(mainMatch);
}
