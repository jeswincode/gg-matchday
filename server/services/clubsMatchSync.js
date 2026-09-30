import mongoose from "mongoose";
import ClubContract from "../models/clubs/ClubContract.js";
import ClubPlayerStats from "../models/clubs/ClubPlayerStats.js";
import ClubHistory from "../models/clubs/ClubHistory.js";

function matchWinnerForSide(match, side) {
  const a = Number(match.teamA?.score || 0);
  const b = Number(match.teamB?.score || 0);
  if (a === b) return "draw";
  return side === "A" ? (a > b ? "win" : "loss") : (b > a ? "win" : "loss");
}

function inContract(contract, date) {
  const time = new Date(date).getTime();
  return new Date(contract.startAt).getTime() <= time && time < new Date(contract.endAt).getTime();
}

function numeric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export async function syncClubStatsForMatch(match, { connection = null } = {}) {
  if (!match?._id) return { affectedClubIds: [], synced: false };

  const participants = match.participants || [];
  const playerIds = [...new Set(participants.map(p => String(p.player?._id || p.player)).filter(Boolean))];
  if (!playerIds.length) return { affectedClubIds: [], synced: false };

  const contracts = await ClubContract.find({
    playerId: { $in: playerIds.map(id => new mongoose.Types.ObjectId(id)) },
    startAt: { $lte: match.date },
    endAt: { $gt: match.date },
  }).lean();

  const byPlayer = new Map(contracts.map(c => [String(c.playerId), c]));
  const clubIds = [...new Set(contracts.map(c => String(c.clubId)))];

  if (!clubIds.length) return { affectedClubIds: [], synced: false };

  const allClubContracts = await ClubContract.find({
    clubId: { $in: clubIds.map(id => new mongoose.Types.ObjectId(id)) },
  }).lean();

  const contractPlayers = new Map();
  for (const contract of allClubContracts) {
    const list = contractPlayers.get(String(contract.clubId)) || [];
    if (!list.some(item => String(item.playerId) === String(contract.playerId))) list.push(contract);
    else list.push(contract);
    contractPlayers.set(String(contract.clubId), list);
  }

  const allPlayerIds = [...new Set(allClubContracts.map(c => String(c.playerId)))];
  const Match = (await import("../models/Match.js")).default;
  const allMatches = await Match.find({
    "participants.player": { $in: allPlayerIds.map(id => new mongoose.Types.ObjectId(id)) },
  }).sort({ date: 1, createdAt: 1 }).lean();

  const affected = [];
  for (const clubId of clubIds) {
    const playerContracts = contractPlayers.get(clubId) || [];
    const statsDocs = [];

    for (const playerId of [...new Set(playerContracts.map(c => String(c.playerId)))]) {
      const playerMatches = allMatches.filter(m =>
        (m.participants || []).some(p =>
          String(p.player?._id || p.player) === playerId &&
          playerContracts.some(c => String(c.playerId) === playerId && inContract(c, m.date))
        )
      );

      if (!playerMatches.length) continue;

      let matchesPlayed = 0, wins = 0, draws = 0, losses = 0;
      let goals = 0, assists = 0, motm = 0, ratingTotal = 0, ratedMatches = 0;
      let lastMainMatchId = null, lastPlayedAt = null;

      for (const m of playerMatches) {
        const p = m.participants.find(item => String(item.player?._id || item.player) === playerId);
        if (!p) continue;
        const contract = playerContracts.find(c => String(c.playerId) === playerId && inContract(c, m.date));
        if (!contract) continue;

        matchesPlayed += 1;
        const outcome = matchWinnerForSide(m, p.team);
        if (outcome === "win") wins += 1;
        else if (outcome === "draw") draws += 1;
        else losses += 1;

        goals += (m.events || []).filter(e => e.type === "goal" && String(e.player?._id || e.player) === playerId).length;
        assists += (m.events || []).filter(e => e.type === "assist" && String(e.player?._id || e.player) === playerId).length;
        if (String(m.motmWinner?._id || m.motmWinner || "") === playerId) motm += 1;

        const rating = numeric(p.rating);
        if (rating !== null) {
          ratingTotal += rating;
          ratedMatches += 1;
        }

        if (!lastPlayedAt || new Date(m.date) > new Date(lastPlayedAt)) {
          lastPlayedAt = m.date;
          lastMainMatchId = m._id;
        }
      }

      statsDocs.push({
        clubId: new mongoose.Types.ObjectId(clubId),
        playerId: new mongoose.Types.ObjectId(playerId),
        matchesPlayed, wins, draws, losses, goals, assists, motm,
        ratingTotal, ratedMatches,
        lastMainMatchId, lastPlayedAt,
      });
    }

    await ClubPlayerStats.deleteMany({ clubId });

    if (statsDocs.length) await ClubPlayerStats.insertMany(statsDocs, { ordered: true });

    const currentClubPlayers = participants
      .filter(p => {
        const contract = byPlayer.get(String(p.player?._id || p.player));
        return contract && String(contract.clubId) === clubId;
      })
      .map(p => String(p.player?._id || p.player));

    await ClubHistory.findOneAndUpdate(
      { clubId, relatedMainMatchId: match._id, eventType: "matchPlayed" },
      {
        $set: {
          description: "Club player statistics synced from the normal GG Match Record.",
          metadata: {
            playerIds: currentClubPlayers,
            teamAScore: Number(match.teamA?.score || 0),
            teamBScore: Number(match.teamB?.score || 0),
          },
          occurredAt: new Date(),
        },
        $setOnInsert: { clubId, relatedMainMatchId: match._id, eventType: "matchPlayed" },
      },
      { upsert: true }
    );

    affected.push(clubId);
  }

  return { affectedClubIds: affected, synced: true };
}
