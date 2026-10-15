const numberOrZero = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const idOf = value => String(value?._id ?? value ?? "");
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const rounded = value => Number(Number(value).toFixed(2));

/**
 * Public, non-financial Clubs career summary for the player analytics view.
 * Wallet values, transfer amounts and private transactions are deliberately
 * excluded from this shape.
 */
export function buildPlayerClubAnalytics(rows = []) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const ratingPoints = sourceRows.reduce((total, row) => total + numberOrZero(row?.ratingTotal), 0);
  const clubs = sourceRows
    .map(row => {
      const club = row?.clubId && typeof row.clubId === "object" ? row.clubId : null;
      const ratedMatches = numberOrZero(row?.ratedMatches);
      const ratingTotal = numberOrZero(row?.ratingTotal);
      return {
        clubId: idOf(row?.clubId),
        clubName: clean(club?.name) || "Club history",
        clubStatus: clean(club?.status) || "unknown",
        logoUrl: clean(club?.logoUrl),
        matches: numberOrZero(row?.matches),
        wins: numberOrZero(row?.wins),
        draws: numberOrZero(row?.draws),
        losses: numberOrZero(row?.losses),
        goals: numberOrZero(row?.goals),
        assists: numberOrZero(row?.assists),
        motm: numberOrZero(row?.motm),
        ratedMatches,
        averageRating: ratedMatches > 0 ? rounded(ratingTotal / ratedMatches) : null,
        lastPlayedAt: row?.lastPlayedAt || null,
      };
    })
    .filter(row => row.clubId)
    .sort((a, b) => new Date(b.lastPlayedAt || 0) - new Date(a.lastPlayedAt || 0) || a.clubName.localeCompare(b.clubName));

  const career = clubs.reduce((total, club) => {
    for (const key of ["matches", "wins", "draws", "losses", "goals", "assists", "motm", "ratedMatches"]) {
      total[key] += club[key];
    }
    return total;
  }, {
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals: 0,
    assists: 0,
    motm: 0,
    ratedMatches: 0,
  });

  career.winRate = career.matches ? rounded((career.wins / career.matches) * 100) : null;
  career.averageRating = career.ratedMatches
    ? rounded(ratingPoints / career.ratedMatches)
    : null;

  return {
    clubCount: new Set(clubs.map(club => club.clubId)).size,
    career,
    clubs,
  };
}
