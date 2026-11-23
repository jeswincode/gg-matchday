const tips = {
  home: "Home brings together your season totals, recent results and Starting XI. Pick a stat to look closer.",
  record: "Pick the teams first, then add the score, goals and assists. Use Record booked fixture for an official Clubs booking.",
  leaderboard: "Filter the rankings by position or season. Select a player to see the performances behind the numbers.",
  calendar: "Choose a date to see its matches. Open a result to review the teams and scorers.",
  players: "Choose a player to see their match history, attributes and preferred positions.",
  admin: "Use the Admin sections to review access, linked profiles and pending changes.",
  overview: "Club Hub brings together upcoming fixtures and the latest Club results.",
  myClub: "My Club shows your squad, club statistics and fixtures. Captains can manage their squad here.",
  matches: "Browse confirmed fixtures. Captains can handle fixture requests and confirm lineups here.",
  betting: "See the available markets on confirmed fixtures and track your open or settled tickets.",
  playerDesk: "My Player shows your Club career and player wallet.",
  market: "Use Market to scout available players and review offers.",
  adminApplications: "Review completed Club formation applications and open an application for its member and captain details.",
  adminQueue: "Open an outstanding Club action to review it directly.",
  reviews: "After an eligible match, you can review a teammate or an opponent.",
};

export function guideFor(tab, account) {
  if (tab === "record" && !["admin", "editor"].includes(account?.role)) {
    return account?.accessRequest === "pending"
      ? "Your editor request is awaiting review. You can still browse results in Calendar."
      : "Recording needs editor access. Request it from the account bar.";
  }
  if (tab === "home" && account && account.role !== "admin" && !account.playerProfile) {
    return "Start with Home for season totals. An administrator can link your account to your player profile.";
  }
  return tips[tab] || "Need a hand? Try Home for the latest Matchday activity.";
}
