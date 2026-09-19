const clamp = value => Math.max(0, Math.min(100, value));
const isGoalkeeper = player => /GK|GOALKEEP/i.test([player?.position, ...(player?.preferredPositions || [])].join(' '));
const cohortPercentile = (value, cohort, key) => {
  const values = cohort.map(row => Number(row[key] ?? 0)).filter(Number.isFinite);
  if (!values.length) return 50;
  if (values.length === 1 || values.every(item => item === values[0])) return 50;
  const lower = values.filter(item => item < value).length;
  const equal = values.filter(item => item === value).length;
  return clamp(100 * (lower + (equal - 1) / 2) / (values.length - 1));
};
export const STYLE_DEFINITIONS = {
  attacker: { label: 'ATTACKER', icon: '🔥', description: 'High goal production and offensive output relative to the eligible GG player pool.' },
  finisher: { label: 'FINISHER', icon: '🚀', description: 'Strong scoring rate with a large share of goal contributions coming from goals.' },
  creator: { label: 'CREATOR', icon: '🎯', description: 'Strong assist rate and creative contribution relative to the eligible GG player pool.' },
  playmaker: { label: 'PLAYMAKER', icon: '🧠', description: 'High involvement through assists and goal contributions with solid match performance.' },
  defender: { label: 'DEFENDER', icon: '🧱', description: 'Strong individual defensive performance, clean-sheet contribution and own-goal discipline.' },
  wall: { label: 'WALL', icon: '🧤', description: 'Goalkeeper with exceptional individual defensive performance and clean-sheet contribution.' },
  highImpact: { label: 'HIGH IMPACT', icon: '⚡', description: 'Combines strong personal performance, goal involvement and positive results.' },
  winner: { label: 'WINNER', icon: '🏆', description: 'Consistently turns appearances into victories and strong result scores.' },
  consistent: { label: 'CONSISTENT', icon: '🧊', description: 'Low variation in recorded match ratings across a meaningful sample.' },
  formMachine: { label: 'FORM MACHINE', icon: '🔥', description: 'Recent results are especially strong, with a strong current-form signal.' },
  workhorse: { label: 'WORKHORSE', icon: '💪', description: 'High appearance volume combined with meaningful attacking contribution.' }
};
export function getPlayerStyleScores(stats, cohort = [stats]) {
  const matches = Number(stats?.matches || 0), goals = Number(stats?.goals || 0), assists = Number(stats?.assists || 0);
  const contributions = Number(stats?.goalContributions ?? goals + assists);
  const averageRating = stats?.averageRating == null ? 0 : Number(stats.averageRating) * 10;
  const goalRate = Number(stats?.goalRate ?? 0), assistRate = Number(stats?.assistRate ?? 0), contributionRate = Number(stats?.contributionRate ?? 0);
  const goalShare = contributions ? goals / contributions : 0, assistShare = contributions ? assists / contributions : 0;
  const goalRatePct = cohortPercentile(goalRate, cohort, 'goalRate'), assistRatePct = cohortPercentile(assistRate, cohort, 'assistRate'), contributionRatePct = cohortPercentile(contributionRate, cohort, 'contributionRate'), appearancePct = cohortPercentile(matches, cohort, 'matches');
  const offensivePct = clamp(Number(stats?.offensiveRating ?? 5) * 10), defensivePct = clamp(Number(stats?.defensiveRating ?? 5) * 10);
  const winRate = clamp(Number(stats?.winRate || 0) * 100), cleanSheetRate = clamp(Number(stats?.defensiveCleanSheetRate ?? stats?.cleanSheetRate ?? 0) * 100), ownGoalScore = clamp(Number(stats?.ownGoalScore ?? 5) * 10), resultScore = clamp(Number(stats?.resultScore ?? 5) * 10), consistency = clamp(Number(stats?.ratingConsistency ?? 0)), form = clamp(Number(stats?.form ?? 0));
  const goalkeeper = isGoalkeeper(stats);
  const scores = {
    attacker: 0.45 * goalRatePct + 0.30 * offensivePct + 0.25 * contributionRatePct,
    finisher: 0.60 * goalRatePct + 0.40 * goalShare * 100,
    creator: 0.55 * assistRatePct + 0.25 * offensivePct + 0.20 * assistShare * 100,
    playmaker: 0.40 * assistRatePct + 0.25 * contributionRatePct + 0.20 * averageRating + 0.15 * winRate,
    defender: 0.70 * defensivePct + 0.20 * cleanSheetRate + 0.10 * ownGoalScore,
    wall: 0.75 * defensivePct + 0.20 * cleanSheetRate + 0.05 * ownGoalScore,
    highImpact: 0.30 * contributionRatePct + 0.25 * averageRating + 0.25 * resultScore + 0.20 * winRate,
    winner: 0.65 * winRate + 0.35 * resultScore,
    consistent: 0.70 * consistency + 0.30 * averageRating,
    formMachine: 0.70 * form + 0.30 * winRate,
    workhorse: 0.65 * appearancePct + 0.35 * contributionRatePct
  };
  const defensiveSample=Number(stats?.defensiveRatedMatches||0)>=3;
  const gates = {
    attacker: goals > 0 || offensivePct >= 70, finisher: goals > 0 && goalShare >= 0.45, creator: assists > 0,
    playmaker: assists > 0 && contributions >= 2, defender: defensiveSample && (cleanSheetRate > 0 || defensivePct >= 70),
    wall: goalkeeper && defensiveSample && (cleanSheetRate > 0 || defensivePct >= 70), highImpact: stats?.averageRating != null,
    winner: matches >= 5 && winRate >= 55, consistent: stats?.ratedMatches >= 5 && consistency >= 70,
    formMachine: matches >= 5 && form >= 70, workhorse: matches >= 8
  };
  return Object.keys(scores).map(key => ({key, ...STYLE_DEFINITIONS[key], score: Number(scores[key].toFixed(2)), eligible: Boolean(gates[key])}));
}
export function classifyPlayerStyles(stats, cohort, { minimumMatches = 5, maximumStyles = 4 } = {}) {
  if (!stats || Number(stats.matches || 0) < minimumMatches) return {status:'developing', styles:[]};
  const candidates = getPlayerStyleScores(stats, cohort).filter(item => item.eligible && item.score >= 65).sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label));
  let selected = candidates.slice(0, maximumStyles);
  if (selected.length < 2) {
    const safe = getPlayerStyleScores(stats, cohort).filter(item=>item.eligible&&!selected.some(style=>style.key===item.key)).sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label));
    selected = [...selected, ...safe.slice(0, 2-selected.length)].slice(0, maximumStyles);
  }
  return {status:selected.length?'active':'developing',styles:selected.map(({key,label,icon,description,score})=>({key,label,icon,description,score}))};
}
