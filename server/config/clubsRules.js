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

export const CLUB_PREDICTION_WEIGHTS = Object.freeze({
  averagePlayerOvr: 0.30,
  recentForm: 0.25,
  averageMatchRating: 0.20,
  record: 0.15,
  headToHead: 0.10,
});

export const CLUB_BETTING_MIN_STAKE = 10;
export const CLUB_BETTING_MAX_STAKE = 100;

export const CLUB_AUCTION_OFFER_DURATION_HOURS = 48;
export const CLUB_AUCTION_MIN_BID = 25;
export const CLUB_AUCTION_BID_INCREMENT = 5;

export const CLUB_MATCH_REQUEST_TTL_HOURS = 24;

export const CLUB_REWARDS = Object.freeze({
  matchWin: 100,
  matchDraw: 50,
  playerAppearance: 10,
  motm: 25,
  cleanSheet: 10,
  firstMatch: 25,
  fiveAppearances: 50,
  tenAppearances: 100,
  firstWin: 50,
});

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

  if (memberIds.length !== CLUB_MAX_MEMBERS) {
    throw new Error("A club formation requires exactly " + CLUB_MAX_MEMBERS + " players.");
  }

  const uniqueIds = [...new Set(memberIds.map(String))];

  if (uniqueIds.length !== CLUB_MAX_MEMBERS) {
    throw new Error("A club formation requires exactly " + CLUB_MAX_MEMBERS + " unique players.");
  }

  return uniqueIds;
}

export function auctionOfferExpiry(createdAt = new Date()) {
  const created = new Date(createdAt);
  return new Date(created.getTime() + CLUB_AUCTION_OFFER_DURATION_HOURS * 60 * 60 * 1000);
}

export function validateAuctionBid(amount, highestActiveBid = 0) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < CLUB_AUCTION_MIN_BID) {
    throw new Error(`The minimum auction bid is ${CLUB_AUCTION_MIN_BID} credits.`);
  }
  const minimumNextBid = highestActiveBid > 0
    ? Number(highestActiveBid) + CLUB_AUCTION_BID_INCREMENT
    : CLUB_AUCTION_MIN_BID;
  if (value < minimumNextBid) {
    throw new Error(`The next auction bid must be at least ${minimumNextBid} credits.`);
  }
  return Math.round(value * 100) / 100;
}

export function normalizeFixtureDate(value) {
  const key = String(value || "");
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(key)) {
    throw new Error("Choose a valid Club Match date.");
  }
  const parsed = new Date(key + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key) {
    throw new Error("Choose a valid Club Match date.");
  }
  return { key, date: parsed };
}

export function clubMatchRequestExpiry(createdAt) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return new Date(0);
  }
  return new Date(created.getTime() + CLUB_MATCH_REQUEST_TTL_HOURS * 60 * 60 * 1000);
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
    .map(playerId => ({
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
    .map(playerId => ({
      playerId,
      votes: counts.get(playerId) || 0,
    }))
    .sort((a, b) => b.votes - a.votes || a.playerId.localeCompare(b.playerId));

  if (!ranked.length) return [];

  const topVotes = ranked[0].votes;
  return ranked
    .filter(row => row.votes === topVotes)
    .map(row => row.playerId);
}
