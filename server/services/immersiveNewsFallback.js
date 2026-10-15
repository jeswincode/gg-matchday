function safeScore(value) {
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 ? score : 0;
}

function safeLabel(value, fallback) {
  const label = String(value || "").replace(/\s+/g, " ").trim();
  return label || fallback;
}

/**
 * Build a deterministic, factual response when the Gemini provider is
 * unavailable. The output intentionally uses only saved labels and scores.
 */
export function buildFallbackImmersiveNews(facts) {
  const name = safeLabel(facts?.name, "Football Match");
  const teamA = safeLabel(facts?.side1?.label, "Team A");
  const teamB = safeLabel(facts?.side2?.label, "Team B");
  const scoreA = safeScore(facts?.side1?.score);
  const scoreB = safeScore(facts?.side2?.score);

  if (scoreA === scoreB) {
    return {
      momentTitle: `${name} ends level`,
      momentText: `${teamA} and ${teamB} finished level at ${scoreA}-${scoreB}.`,
      headline: `${teamA} and ${teamB} share the result`,
      summary: `${name} finished level at ${scoreA}-${scoreB}.`,
      body: `${teamA} scored ${scoreA} and ${teamB} scored ${scoreB}. The saved score records a draw.`,
      icon: "🤝",
      generatedBy: "fallback",
    };
  }

  const teamAWon = scoreA > scoreB;
  const winner = teamAWon ? teamA : teamB;
  const loser = teamAWon ? teamB : teamA;
  const winnerScore = teamAWon ? scoreA : scoreB;
  const loserScore = teamAWon ? scoreB : scoreA;

  return {
    momentTitle: `${winner} finish ahead in ${name}`,
    momentText: `${winner} beat ${loser} ${winnerScore}-${loserScore}.`,
    headline: `${winner} take the win in ${name}`,
    summary: `${winner} beat ${loser} ${winnerScore}-${loserScore}.`,
    body: `${teamA} scored ${scoreA}, while ${teamB} scored ${scoreB}. The saved score records ${winner} as the winner.`,
    icon: "🏆",
    generatedBy: "fallback",
  };
}
