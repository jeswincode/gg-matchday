const numeric = value => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function summarizeClubRecord(clubId, matches = []) {
  const summary = { wins: 0, draws: 0, losses: 0, unavailable: 0 };
  for (const match of matches) {
    const isSideA = String(match.clubAId || "") === String(clubId);
    const isSideB = String(match.clubBId || "") === String(clubId);
    const clubScore = numeric(isSideA ? match.clubAScore : isSideB ? match.clubBScore : null);
    const opponentScore = numeric(isSideA ? match.clubBScore : isSideB ? match.clubAScore : null);
    if (clubScore === null || opponentScore === null || (!isSideA && !isSideB)) {
      summary.unavailable += 1;
      continue;
    }
    if (clubScore === opponentScore) summary.draws += 1;
    else if (clubScore > opponentScore) summary.wins += 1;
    else summary.losses += 1;
  }
  return summary;
}

export function getClubFacilityProgress({ fixtures = 0, teamOvr = null, memberCount = 0 } = {}) {
  const played = Math.max(0, numeric(fixtures) || 0);
  const ovr = numeric(teamOvr);
  const members = Math.max(0, numeric(memberCount) || 0);

  const ground = played >= 30
    ? { level: 4, name: "Arena", description: "A proven home ground with a long fixture history." }
    : played >= 15
      ? { level: 3, name: "Stadium", description: "The stands have grown with every completed fixture." }
      : played >= 5
        ? { level: 2, name: "Ground", description: "Your Club is building a home-ground identity." }
        : { level: 1, name: "Training Ground", description: "The first chapter of your home ground starts here." };
  const groundProgress = played >= 30 ? 100
    : played >= 15 ? Math.round((played - 15) / 15 * 100)
      : played >= 5 ? Math.round((played - 5) / 10 * 100)
        : Math.round(played / 5 * 100);

  let training;
  let trainingProgress;
  if (ovr === null) {
    training = { level: 1, name: "Training Base", description: "Build a larger Matchday sample to develop the facility." };
    trainingProgress = 0;
  } else if (ovr >= 85) {
    training = { level: 4, name: "Elite Centre", description: "The squad's current OVR has reached the elite band." };
    trainingProgress = 100;
  } else if (ovr >= 75) {
    training = { level: 3, name: "Performance Centre", description: "Your squad is developing into a strong unit." };
    trainingProgress = Math.round((ovr - 75) / 10 * 100);
  } else if (ovr >= 65) {
    training = { level: 2, name: "Training Centre", description: "Recorded player performances are shaping the facility." };
    trainingProgress = Math.round((ovr - 65) / 10 * 100);
  } else {
    training = { level: 1, name: "Training Base", description: "Build a larger Matchday sample to develop the facility." };
    trainingProgress = Math.max(0, Math.round(ovr / 65 * 100));
  }

  const hasFullSquad = members >= 5;
  const academy = {
    level: hasFullSquad ? 3 : members >= 4 ? 2 : 1,
    name: hasFullSquad ? "Full Squad Academy" : members >= 4 ? "Academy Ready" : "Recruitment in progress",
    description: hasFullSquad ? "All five squad places are occupied." : "A complete four-to-five player squad unlocks the next stage.",
  };
  const academyProgress = hasFullSquad ? 100 : members >= 4 ? 80 : Math.round(members / 4 * 80);

  return { ground, groundProgress, training, trainingProgress, academy, academyProgress, hasFullSquad };
}
