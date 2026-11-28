const tips = {
  home: "Tap a season total to see the matches behind it.",
  record: "Pick the teams first. For a Clubs booking, start with Record booked fixture.",
  leaderboard: "Pick a position or period, then tap a player to see their form.",
  calendar: "Choose a date to see its matches. Tap a result for the scorers.",
  players: "Tap a player for match history, attributes and positions.",
  admin: "Open Profile administration to review access and profile links.",
  overview: "Check Club Hub for upcoming fixtures and recent results.",
  myClub: "Find your squad and fixtures here. Captains can manage the squad.",
  matches: "Open a fixture for the lineup. Captains can respond to requests here.",
  betting: "Open a confirmed fixture to see its markets and your tickets.",
  playerDesk: "Check My Player for your club record and wallet.",
  market: "Scout available players and review your offers here.",
  adminApplications: "Open an application to review the squad and captains.",
  adminQueue: "Open a queued item to see what needs a decision.",
  reviews: "After an eligible match, choose a teammate or opponent to review.",
};

export function guideFor(tab, account) {
  if (tab === "record" && !["admin", "editor"].includes(account?.role)) {
    return account?.accessRequest === "pending"
      ? "Your editor request is pending. Catch up on results in Calendar."
      : "Want to record a match? Request editor access from your account bar.";
  }
  if (tab === "home" && account && account.role !== "admin" && !account.playerProfile) {
    return "Still need your player profile? Ask an admin to link it to your account.";
  }
  return tips[tab] || "Check Home for the latest Matchday activity.";
}

export function rankingNotes(trends, rows = [], ratingLabel = "GG Rating") {
  const { rise, improvement, standout } = trends || {};
  const leader = rows.find(row => row.rank === 1 && Number.isFinite(row.ggRating));
  const scorer = rows.filter(row => row.goals > 0).sort((a, b) => b.goals - a.goals)[0];
  return [
    rise && `${rise.name} climbed from #${rise.from} to #${rise.to} overall after the latest matchday.`,
    improvement && `${improvement.name} is finding form again. Their last three rated games averaged ${improvement.after.toFixed(2)}, up from ${improvement.before.toFixed(2)}.`,
    standout && `${standout.name} stood out on the latest matchday with a ${standout.rating.toFixed(2)} match rating.`,
    leader && `${leader.name} leads the overall leaderboard with a ${leader.ggRating.toFixed(2)} ${ratingLabel}.`,
    scorer && `${scorer.name} has ${scorer.goals} recorded goals, the most in the all-time rankings.`,
  ].filter(Boolean);
}

export function clasicoNotes(data) {
  const messi = data?.sides?.find(side => side.side === "Messi");
  const ronaldo = data?.sides?.find(side => side.side === "Ronaldo");
  const latest = data?.matches?.[0];
  if (!latest || !messi || !ronaldo) return [];
  return [
    `In El Clásico, Messi fans have ${messi.goals} goals and ${messi.assists} assists. Ronaldo fans have ${ronaldo.goals} goals and ${ronaldo.assists} assists.`,
    `The latest El Clásico result was ${latest.teamA.label} ${latest.teamA.score}–${latest.teamB.score} ${latest.teamB.label}.`,
    Number.isFinite(messi.averageRating) && Number.isFinite(ronaldo.averageRating) &&
      `El Clásico match ratings average ${messi.averageRating.toFixed(2)} for Messi fans and ${ronaldo.averageRating.toFixed(2)} for Ronaldo fans.`,
  ].filter(Boolean);
}

export function clubNotes(home, clubs, publicResult, performance) {
  const result = home?.recentMatches?.[0] || publicResult;
  const name = id => Array.isArray(clubs) && clubs.find(club => String(club._id) === String(id))?.name;
  const teamA = result && (result.clubAName || name(result.clubAId));
  const teamB = result && (result.clubBName || name(result.clubBId));
  const wins = home?.form?.filter(result => result === "W").length;
  const scorer = performance?.stats?.filter(row => row.playerId?.name && row.goals > 0)
    .sort((a, b) => b.goals - a.goals)[0];
  const creator = performance?.stats?.filter(row => row.playerId?.name && row.assists > 0)
    .sort((a, b) => b.assists - a.assists)[0];
  return [
    teamA && teamB && Number.isFinite(result.clubAScore) && Number.isFinite(result.clubBScore) &&
      `Latest recorded result here was ${teamA} ${result.clubAScore}–${result.clubBScore} ${teamB}.`,
    home?.currentClub && home.form?.length > 1 &&
      `${home.currentClub.name} won ${wins} of their last ${home.form.length} recorded Club matches.`,
    scorer && `${scorer.playerId.name} leads ${performance.club.name} in recorded Club goals with ${scorer.goals}.`,
    creator && `${creator.playerId.name} leads ${performance.club.name} in recorded Club assists with ${creator.assists}.`,
  ].filter(Boolean);
}

export function pitchNote(player, stats, topGoals, position) {
  if (!stats?.matches) return `${player.name} lines up at ${position}. Their Matchday record is still getting started.`;
  const goals = stats.goals;
  if (goals >= 2 && goals === topGoals) return `${player.name} leads the recorded scoring charts with ${goals} goals.`;
  const wins = stats.recent?.filter(match => match.result === "W").length;
  if (stats.recent?.length >= 3 && wins >= 3) return `${player.name} won ${wins} of their last ${stats.recent.length} Matchday appearances.`;
  if (stats.assists > 0 && stats.assists >= goals) return `${player.name} has set up ${stats.assists} goals in ${stats.matches} recorded appearances.`;
  if (goals > 0) return `${player.name} has scored ${goals} in ${stats.matches} recorded appearances.`;
  if (stats.cleanSheets > 0) return `${player.name} has been part of ${stats.cleanSheets} clean sheets in ${stats.matches} appearances.`;
  if (Number.isFinite(stats.averageRating)) return `${player.name} averages ${stats.averageRating.toFixed(2)} across their rated Matchday games.`;
  return `${player.name} has made ${stats.matches} recorded Matchday appearances.`;
}
