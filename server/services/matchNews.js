function scorerSummary(match) {
  const counts = new Map();
  for (const event of Array.isArray(match?.events) ? match.events : []) {
    if (event?.type !== "goal") continue;
    const player = event.player;
    const objectIdString = player && typeof player.toString === "function" ? player.toString() : "";
    const playerId = String(player?._id ?? (objectIdString && objectIdString !== "[object Object]" ? objectIdString : ""));
    const name = String(player?.name || (typeof player === "string" ? player : "") || playerId || "Unknown player").trim();
    const key = playerId || name;
    const current = counts.get(key) || { name, goals: 0 };
    current.goals += 1;
    counts.set(key, current);
  }
  return [...counts.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))[0] || null;
}

/**
 * Correct a misleading hat-trick headline when the recorded events show a
 * four-or-more-goal performance. This is intentionally display-only and does
 * not mutate the saved article.
 */
export function normalizeGoalMilestoneHeadline(headline, match) {
  const topScorer = scorerSummary(match);
  if (!topScorer || topScorer.goals < 4 || !/hat[ -]?trick/i.test(String(headline || ""))) {
    return headline;
  }
  return `${topScorer.name} dominates with a ${topScorer.goals}-goal haul`;
}

export function buildFallbackMatchNews(match) {
  const teamA = match?.teamA?.label || "Side 1";
  const teamB = match?.teamB?.label || "Side 2";
  const scoreA = Number(match?.teamA?.score || 0);
  const scoreB = Number(match?.teamB?.score || 0);
  const topScorer = scorerSummary(match);

  if (topScorer && topScorer.goals >= 4) {
    return {
      headline: `${topScorer.name} dominates with a ${topScorer.goals}-goal haul`,
      summary: `${topScorer.name} scored ${topScorer.goals} times in a standout performance.`,
      body: `${topScorer.name} found the net ${topScorer.goals} times as ${teamA} and ${teamB} finished ${scoreA}-${scoreB}.`,
      icon: "🔥",
      generatedBy: "fallback",
      aiError: null,
    };
  }

  if (topScorer && topScorer.goals === 3) {
    return {
      headline: `${topScorer.name} hits a hat-trick`,
      summary: `${topScorer.name} scored three times in a standout performance.`,
      body: `${topScorer.name} found the net three times as ${teamA} and ${teamB} finished ${scoreA}-${scoreB}.`,
      icon: "🔥",
      generatedBy: "fallback",
      aiError: null,
    };
  }

  if (topScorer && topScorer.goals === 2) {
    return {
      headline: `${topScorer.name} bags a brace`,
      summary: `${topScorer.name} scored twice in ${match?.name || "the match"}.`,
      body: `${topScorer.name} found the net twice as the match finished ${scoreA}-${scoreB}.`,
      icon: "⚡",
      generatedBy: "fallback",
      aiError: null,
    };
  }

  if (scoreA === scoreB) {
    return {
      headline: `${match?.name || "Football Match"} ends all square`,
      summary: `${teamA} and ${teamB} could not be separated after a ${scoreA}-${scoreB} draw.`,
      body: `Both sides finished level at ${scoreA}-${scoreB}.`,
      icon: "🤝",
      generatedBy: "fallback",
      aiError: null,
    };
  }

  const winner = scoreA > scoreB ? teamA : teamB;
  return {
    headline: `${winner} takes the win`,
    summary: `${winner} came out on top in ${match?.name || "the match"}.`,
    body: `${winner} finished ahead ${scoreA}-${scoreB} in ${match?.name || "the match"}.`,
    icon: "🏆",
    generatedBy: "fallback",
    aiError: null,
  };
}
