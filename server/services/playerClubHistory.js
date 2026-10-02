const EARNING_TYPES = new Set([
  "signing_payment",
  "motm_reward",
  "individual_match_reward",
  "competition_reward",
]);

const ACHIEVEMENT_TYPES = new Set(["achievement", "competitionResult"]);

const toDate = value => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const idOf = value => String(value?._id ?? value);

function inContractWindow(contract, date) {
  const start = toDate(contract?.startAt);
  const end = toDate(contract?.endAt);
  const at = toDate(date);
  return Boolean(start && end && at && start <= at && end > at);
}

function emptyContribution(clubId) {
  return {
    clubId: String(clubId),
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: 0,
    goals: 0,
    assists: 0,
    motm: 0,
    ratingTotal: 0,
    ratedMatches: 0,
    averageRating: null,
    cleanSheets: 0,
    defensiveRatingTotal: 0,
    defensiveRatedMatches: 0,
    averageDefensiveRating: null,
    achievements: [],
    competitionContributions: [],
  };
}

function contributionFor(contributions, clubId) {
  const key = String(clubId);
  if (!contributions.has(key)) contributions.set(key, emptyContribution(key));
  return contributions.get(key);
}

function getClubSide(clubMatch, clubId, participantTeam) {
  if (participantTeam === "A" && String(clubMatch.clubAId) === String(clubId)) return "A";
  if (participantTeam === "B" && String(clubMatch.clubBId) === String(clubId)) return "B";
  return null;
}

function formatDuration(fromValue, toValue) {
  const from = toDate(fromValue);
  const to = toDate(toValue);
  if (!from || !to || to < from) return "—";

  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());

  const anchor = new Date(Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth() + months,
    from.getUTCDate(),
  ));

  if (anchor > to) months -= 1;

  const adjusted = new Date(Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth() + months,
    from.getUTCDate(),
  ));

  const days = Math.max(
    0,
    Math.round((to.getTime() - adjusted.getTime()) / (24 * 60 * 60 * 1000)),
  );

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts = [];
  if (years) parts.push(years + "y");
  if (remainingMonths) parts.push(remainingMonths + "mo");
  if (days || parts.length === 0) parts.push(days + "d");
  return parts.join(" ");
}

export function mergeContractTenures(contracts = [], clubsById = new Map()) {
  const sorted = [...contracts]
    .map(contract => ({
      ...contract,
      clubId: idOf(contract.clubId),
      startAt: toDate(contract.startAt),
      endAt: toDate(contract.endAt),
    }))
    .filter(contract => contract.clubId && contract.startAt && contract.endAt && contract.endAt >= contract.startAt)
    .sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt);

  const merged = [];

  for (const contract of sorted) {
    const previous = merged[merged.length - 1];
    const consecutive =
      previous &&
      previous.clubId === contract.clubId &&
      contract.startAt.getTime() <= previous.leftAt.getTime() + 24 * 60 * 60 * 1000;

    if (consecutive) {
      previous.leftAt = previous.leftAt > contract.endAt ? previous.leftAt : contract.endAt;
      previous.contracts.push(contract);
      previous.statuses.add(contract.status);
      continue;
    }

    const club = clubsById.get(contract.clubId) || null;
    merged.push({
      clubId: contract.clubId,
      clubName: club?.name || "Unknown Club",
      clubStatus: club?.status || "unknown",
      logoUrl: club?.logoUrl || "",
      description: club?.description || "",
      joinedAt: contract.startAt,
      leftAt: contract.endAt,
      current: false,
      statuses: new Set([contract.status]),
      contracts: [contract],
    });
  }

  return merged;
}

export function classifyPlayerEarnings(transactions = []) {
  const byClub = new Map();

  for (const transaction of transactions) {
    const type = String(transaction?.type || "");
    if (!EARNING_TYPES.has(type)) continue;

    const clubId = transaction?.clubId ? idOf(transaction.clubId) : "";
    if (!clubId) continue;

    const amount = Number(transaction?.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (!byClub.has(clubId)) {
      byClub.set(clubId, {
        signingPayment: 0,
        matchRewards: 0,
        motmRewards: 0,
        cleanSheetRewards: 0,
        competitionRewards: 0,
        total: 0,
      });
    }

    const row = byClub.get(clubId);
    const description = String(transaction?.description || "").toLowerCase();

    if (type === "signing_payment") row.signingPayment += amount;
    else if (type === "motm_reward" || description.includes("motm")) row.motmRewards += amount;
    else if (description.includes("clean-sheet") || description.includes("clean sheet")) row.cleanSheetRewards += amount;
    else if (type === "competition_reward") row.competitionRewards += amount;
    else row.matchRewards += amount;

    row.total += amount;
  }

  return byClub;
}

export function buildPlayerClubHistory({
  contracts = [],
  clubs = [],
  clubMatches = [],
  mainMatches = [],
  playerHistories = [],
  walletTransactions = [],
  playerId,
  now = new Date(),
}) {
  const normalizedPlayerId = String(playerId);
  const clubsById = new Map(clubs.map(club => [idOf(club._id), club]));
  const mergedTenures = mergeContractTenures(contracts, clubsById);

  for (const tenure of mergedTenures) {
    tenure.current = tenure.contracts.some(contract =>
      String(contract.status) === "active" &&
      inContractWindow(contract, now),
    );
    delete tenure.statuses;
  }

  const contributions = new Map();
  const seenClubMatchPlayerAppearances = new Set();

  const mainMatchById = new Map(mainMatches.map(match => [idOf(match._id), match]));

  for (const clubMatch of clubMatches) {
    if (String(clubMatch.status) !== "completed" || !clubMatch.mainMatchId) continue;

    const mainMatch = mainMatchById.get(idOf(clubMatch.mainMatchId));
    if (!mainMatch) continue;

    const participant = (mainMatch.participants || []).find(item => idOf(item.player) === normalizedPlayerId);
    if (!participant) continue;

    // Resolve the contract that was actually active on the authoritative Match date.
    // This matters when a player has consecutive renewal contracts for the same Club.
    const contract = contracts.find(item =>
      (String(item.clubId) === String(clubMatch.clubAId) ||
        String(item.clubId) === String(clubMatch.clubBId)) &&
      inContractWindow(item, mainMatch.date),
    );
    const applicableClubId = contract ? String(contract.clubId) : null;
    if (!applicableClubId) continue;

    const side = getClubSide(clubMatch, applicableClubId, participant.team);
    if (!side) continue;

    const appearanceKey = idOf(clubMatch._id) + ":" + applicableClubId;
    if (seenClubMatchPlayerAppearances.has(appearanceKey)) continue;
    seenClubMatchPlayerAppearances.add(appearanceKey);

    const row = contributionFor(contributions, applicableClubId);
    row.matches += 1;

    const scoreA = Number(clubMatch.clubAScore ?? 0);
    const scoreB = Number(clubMatch.clubBScore ?? 0);
    const teamScore = side === "A" ? scoreA : scoreB;
    const opponentScore = side === "A" ? scoreB : scoreA;

    if (teamScore > opponentScore) row.wins += 1;
    else if (teamScore < opponentScore) row.losses += 1;
    else row.draws += 1;

    row.goals += (mainMatch.events || []).filter(
      event => event.type === "goal" && idOf(event.player) === normalizedPlayerId,
    ).length;

    row.assists += (mainMatch.events || []).filter(
      event => event.type === "assist" && idOf(event.player) === normalizedPlayerId,
    ).length;

    if (idOf(mainMatch.motmWinner) === normalizedPlayerId) row.motm += 1;

    const rating = Number(participant.rating);
    if (Number.isFinite(rating)) {
      row.ratingTotal += rating;
      row.ratedMatches += 1;
    }

    const defensiveRating = Number(participant.defensivePerformance);
    if (Number.isFinite(defensiveRating)) {
      row.defensiveRatingTotal += defensiveRating;
      row.defensiveRatedMatches += 1;
    }

    if (opponentScore === 0) row.cleanSheets += 1;
  }

  const achievementsByClub = new Map();
  for (const event of playerHistories) {
    const clubId = event?.clubId ? idOf(event.clubId) : "";
    if (!clubId) continue;
    if (!ACHIEVEMENT_TYPES.has(String(event.eventType))) continue;

    const row = contributionFor(contributions, clubId);
    const item = {
      id: idOf(event._id),
      type: String(event.eventType),
      description: String(event.description || ""),
      occurredAt: event.occurredAt || event.createdAt || null,
      metadata: event.metadata || {},
    };
    row.achievements.push(item);

    if (String(event.eventType) === "competitionResult") {
      row.competitionContributions.push(item);
    }

    if (!achievementsByClub.has(clubId)) achievementsByClub.set(clubId, []);
    achievementsByClub.get(clubId).push(item);
  }

  for (const row of contributions.values()) {
    row.winRate = row.matches ? Number(((row.wins / row.matches) * 100).toFixed(1)) : 0;
    row.averageRating = row.ratedMatches
      ? Number((row.ratingTotal / row.ratedMatches).toFixed(2))
      : null;
    row.averageDefensiveRating = row.defensiveRatedMatches
      ? Number((row.defensiveRatingTotal / row.defensiveRatedMatches).toFixed(2))
      : null;
    delete row.ratingTotal;
    delete row.defensiveRatingTotal;
  }

  const earningsByClub = classifyPlayerEarnings(walletTransactions);

  const tenures = mergedTenures.map(tenure => {
    const contribution = contributions.get(tenure.clubId) || emptyContribution(tenure.clubId);
    const earnings = earningsByClub.get(tenure.clubId) || {
      signingPayment: 0,
      matchRewards: 0,
      motmRewards: 0,
      cleanSheetRewards: 0,
      competitionRewards: 0,
      total: 0,
    };

    return {
      clubId: tenure.clubId,
      clubName: tenure.clubName,
      clubStatus: tenure.clubStatus,
      clubLogoUrl: tenure.logoUrl,
      joinedAt: tenure.joinedAt,
      leftAt: tenure.leftAt,
      current: tenure.current,
      totalTimeLabel: formatDuration(tenure.joinedAt, tenure.current ? now : tenure.leftAt),
      contracts: tenure.contracts.map(contract => ({
        id: idOf(contract._id),
        startAt: contract.startAt,
        endAt: contract.endAt,
        status: contract.status,
        source: contract.source,
        signingAmount: Number(contract.signingAmount || 0),
        renewalNumber: Number(contract.renewalNumber || 0),
      })),
      contribution: {
        ...contribution,
        achievements: [...contribution.achievements].sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0)),
        competitionContributions: [...contribution.competitionContributions].sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0)),
      },
      earnings: {
        ...earnings,
        total: Number(earnings.total.toFixed(2)),
      },
    };
  });

  const activeTenure = tenures.find(tenure => tenure.current) || null;

  const career = tenures.reduce((summary, tenure) => {
    const c = tenure.contribution;
    summary.clubCount += 1;
    summary.matches += c.matches;
    summary.wins += c.wins;
    summary.draws += c.draws;
    summary.losses += c.losses;
    summary.goals += c.goals;
    summary.assists += c.assists;
    summary.motm += c.motm;
    summary.ratedMatches += c.ratedMatches;
    summary.cleanSheets += c.cleanSheets;
    summary.ratingPoints += c.averageRating == null ? 0 : c.averageRating * c.ratedMatches;
    summary.defensiveRatingPoints += c.averageDefensiveRating == null ? 0 : c.averageDefensiveRating * c.defensiveRatedMatches;
    summary.defensiveRatedMatches += c.defensiveRatedMatches;
    summary.earnings += tenure.earnings.total;
    return summary;
  }, {
    clubCount: 0,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals: 0,
    assists: 0,
    motm: 0,
    ratedMatches: 0,
    cleanSheets: 0,
    ratingPoints: 0,
    defensiveRatingPoints: 0,
    defensiveRatedMatches: 0,
    earnings: 0,
  });

  career.winRate = career.matches ? Number(((career.wins / career.matches) * 100).toFixed(1)) : 0;
  career.averageRating = career.ratedMatches
    ? Number((career.ratingPoints / career.ratedMatches).toFixed(2))
    : null;
  career.averageDefensiveRating = career.defensiveRatedMatches
    ? Number((career.defensiveRatingPoints / career.defensiveRatedMatches).toFixed(2))
    : null;
  career.earnings = Number(career.earnings.toFixed(2));
  delete career.ratingPoints;
  delete career.defensiveRatingPoints;

  const timeline = [
    ...tenures.flatMap(tenure => [
      {
        id: "join:" + tenure.clubId + ":" + new Date(tenure.joinedAt).toISOString(),
        type: "joined",
        clubId: tenure.clubId,
        clubName: tenure.clubName,
        occurredAt: tenure.joinedAt,
        description: "Joined " + tenure.clubName,
      },
      ...(tenure.current ? [] : [{
        id: "left:" + tenure.clubId + ":" + new Date(tenure.leftAt).toISOString(),
        type: "left",
        clubId: tenure.clubId,
        clubName: tenure.clubName,
        occurredAt: tenure.leftAt,
        description: "Left " + tenure.clubName,
      }]),
    ]),
    ...playerHistories
      .filter(event => event?.occurredAt || event?.createdAt)
      .map(event => ({
        id: idOf(event._id),
        type: String(event.eventType),
        clubId: event?.clubId ? idOf(event.clubId) : null,
        clubName: clubsById.get(event?.clubId ? idOf(event.clubId) : "")?.name || "Club",
        occurredAt: event.occurredAt || event.createdAt,
        description: String(event.description || event.eventType || "Club history event"),
      })),
  ].sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0));

  return {
    currentClub: activeTenure
      ? {
          id: activeTenure.clubId,
          name: activeTenure.clubName,
          status: activeTenure.clubStatus,
        }
      : null,
    tenures,
    careerSummary: career,
    timeline,
    history: [...playerHistories],
    contracts: [...contracts],
    privateEarnings: tenures.map(tenure => ({
      clubId: tenure.clubId,
      clubName: tenure.clubName,
      ...tenure.earnings,
    })),
  };
}
