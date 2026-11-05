export const WORLD_ECONOMY_RULES = Object.freeze({
  dailyXpCap: 250,
  dailyCoinCap: 120,
  dailyTrainingXpCap: 150,
  dailyTrainingCoinCap: 70,
  maxLevel: 100,
  levelBaseXp: 100,
  levelExponent: 1.65,
});

export function totalXpForLevel(level) {
  const safeLevel = Math.max(1, Math.min(WORLD_ECONOMY_RULES.maxLevel, Math.floor(Number(level) || 1)));
  if (safeLevel === 1) return 0;
  return Math.floor(WORLD_ECONOMY_RULES.levelBaseXp * Math.pow(safeLevel - 1, WORLD_ECONOMY_RULES.levelExponent));
}

export function levelProgress(totalXp) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  while (level < WORLD_ECONOMY_RULES.maxLevel && xp >= totalXpForLevel(level + 1)) level += 1;
  const currentLevelXp = totalXpForLevel(level);
  const nextLevelXp = level >= WORLD_ECONOMY_RULES.maxLevel ? currentLevelXp : totalXpForLevel(level + 1);
  return {
    level,
    totalXp: xp,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel: xp - currentLevelXp,
    xpForNextLevel: Math.max(0, nextLevelXp - currentLevelXp),
    xpRemaining: Math.max(0, nextLevelXp - xp),
    progressPercent: level >= WORLD_ECONOMY_RULES.maxLevel ? 100 : Math.max(0, Math.min(100, ((xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)) * 100)),
  };
}

export function trainingRewardForSession({ totalCounts, durationSeconds }) {
  const reps = Math.max(0, Math.min(1500, Math.floor(Number(totalCounts) || 0)));
  const duration = Math.max(0, Math.min(28800, Math.floor(Number(durationSeconds) || 0)));
  const xp = Math.min(60, 8 + Math.floor(Math.min(reps, 200) / 5) + Math.floor(Math.min(duration, 1800) / 300));
  const coins = Math.min(14, 4 + Math.floor(xp / 6));
  return { xp, coins };
}

export function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export const WORLD_ACHIEVEMENTS = Object.freeze([
  { id: "first-session", name: "First Whistle", description: "Log your first training session.", xp: 20, coins: 10, test: (profile) => (profile?.totals?.sessions || 0) >= 1 },
  { id: "five-sessions", name: "Finding Your Rhythm", description: "Log five training sessions.", xp: 35, coins: 15, test: (profile) => (profile?.totals?.sessions || 0) >= 5 },
  { id: "ten-sessions", name: "Training Regular", description: "Log ten training sessions.", xp: 60, coins: 25, test: (profile) => (profile?.totals?.sessions || 0) >= 10 },
  { id: "five-hundred-counts", name: "Five Hundred Club", description: "Record 500 workout counters.", xp: 30, coins: 15, test: (profile) => (profile?.totals?.totalCounts || 0) >= 500 },
  { id: "two-thousand-counts", name: "Committed to the Craft", description: "Record 2,000 workout counters.", xp: 75, coins: 35, test: (profile) => (profile?.totals?.totalCounts || 0) >= 2000 },
]);
