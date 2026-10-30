const validNumber = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

function bestEntry(timeline, key, minimum = 0) {
  return timeline
    .filter(item => validNumber(item[key]) && Number(item[key]) > minimum)
    .sort((a, b) => Number(b[key]) - Number(a[key]) || new Date(b.date || 0) - new Date(a.date || 0))[0] || null;
}

export function getCareerRecords(analytics = {}) {
  const timeline = Array.isArray(analytics?.timeline) ? analytics.timeline : [];
  const bestRating = bestEntry(timeline, "rating", 0);
  const bestGoals = bestEntry(timeline, "goals", 0);
  const bestAssists = bestEntry(timeline, "assists", 0);
  const month = analytics?.bestMonth && Number(analytics.bestMonth.count) > 0
    ? {
        ...analytics.bestMonth,
        averageRating: Number(analytics.bestMonth.total) / Number(analytics.bestMonth.count),
      }
    : null;

  return {
    bestRating,
    bestGoals,
    bestAssists,
    bestMonth: month,
    bestTeammate: analytics?.bestTeammate || null,
  };
}
