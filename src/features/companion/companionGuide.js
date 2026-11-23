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
