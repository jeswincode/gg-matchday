export const CLUB_MAX_MEMBERS = 4;
export const CLUB_STARTING_BALANCE = 3000;

export const CLUB_FORMATIONS = Object.freeze([
  "1-2-1",
  "2-1-1",
  "1-3",
  "3-1",
  "2-2",
]);

export const CLUB_STATUSES = Object.freeze([
  "draft",
  "pendingApproval",
  "approved",
  "rejected",
  "archived",
]);

export function normalizeClubName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function validateClubMemberCount(memberIds) {
  if (!Array.isArray(memberIds)) {
    throw new Error("Club members must be an array.");
  }

  const uniqueIds = [...new Set(memberIds.map(String))];

  if (uniqueIds.length < 1 || uniqueIds.length > CLUB_MAX_MEMBERS) {
    throw new Error(`A club must have between 1 and ${CLUB_MAX_MEMBERS} members.`);
  }

  return uniqueIds;
}

export function validateFormation(formation) {
  if (!CLUB_FORMATIONS.includes(formation)) {
    throw new Error("Choose a valid 4-player club formation.");
  }

  return formation;
}

export function nextRenewalBoundary(date = new Date()) {
  const source = new Date(date);

  if (Number.isNaN(source.getTime())) {
    throw new Error("Invalid contract date.");
  }

  return new Date(Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth() + 2,
    1,
    0,
    0,
    0,
    0,
  ));
}

export function contractWindow(startDate) {
  const start = nextRenewalBoundary(startDate);
  const end = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth() + 2,
    1,
    0,
    0,
    0,
    0,
  ));

  return { start, end };
}

export function selectCaptainCandidates(members, ovrByPlayerId) {
  const rows = [...(members || [])]
    .map((playerId) => ({
      playerId: String(playerId),
      ovr: Number(ovrByPlayerId?.get(String(playerId)) ?? -Infinity),
    }))
    .sort((a, b) => b.ovr - a.ovr || a.playerId.localeCompare(b.playerId));

  return rows.slice(0, 2).map(row => row.playerId);
}

export function resolveCaptainVote(candidates, votes) {
  const allowed = new Set((candidates || []).map(String));
  const counts = new Map();

  for (const vote of votes || []) {
    const candidateId = String(vote.candidatePlayerId);
    if (!allowed.has(candidateId)) continue;
    counts.set(candidateId, (counts.get(candidateId) || 0) + 1);
  }

  const ranked = [...allowed]
    .map(playerId => ({ playerId, votes: counts.get(playerId) || 0 }))
    .sort((a, b) => b.votes - a.votes || a.playerId.localeCompare(b.playerId));

  if (!ranked.length) return [];

  const topVotes = ranked[0].votes;
  return ranked.filter(row => row.votes === topVotes).map(row => row.playerId);
}