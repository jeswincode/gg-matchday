const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export const CAREER_MILESTONE_RULES = [
  { key: "matches", label: "Appearances", icon: "AP", thresholds: [1, 10, 25, 50, 100, 200, 500] },
  { key: "goals", label: "Goals", icon: "GO", thresholds: [1, 10, 25, 50, 100, 150, 200] },
  { key: "assists", label: "Assists", icon: "AS", thresholds: [1, 10, 25, 50, 100] },
  { key: "cleanSheets", label: "Clean sheets", icon: "CS", thresholds: [1, 10, 25, 50, 100] },
  { key: "wins", label: "Team wins", icon: "W", thresholds: [1, 10, 25, 50, 100] },
];

const OBJECTIVE_RULES = [
  { key: "matches", label: "Make your first appearance", target: 1, detail: "Your career starts with a recorded Matchday appearance." },
  { key: "goals", label: "Score your first career goal", target: 1, detail: "Get your name onto the official GG Matchday scoresheet." },
  { key: "assists", label: "Record your first assist", target: 1, detail: "Create a goal and add your first career assist." },
  { key: "matches", label: "Reach 10 appearances", target: 10, detail: "Build consistency and reach double-digit appearances." },
  { key: "goals", label: "Reach 10 career goals", target: 10, detail: "Move into the double-digit goals club." },
  { key: "assists", label: "Reach 10 career assists", target: 10, detail: "Become a regular source of chances for your team." },
  { key: "cleanSheets", label: "Record 10 clean sheets", target: 10, detail: "Help your side keep the opposition scoreless." },
  { key: "wins", label: "Reach 25 team wins", target: 25, detail: "Make your mark on another milestone in your career." },
  { key: "matches", label: "Reach 50 appearances", target: 50, detail: "A major career milestone built match by match." },
];

export function getNextCareerObjective(stats = {}) {
  const next = OBJECTIVE_RULES.find(rule => number(stats[rule.key]) < rule.target);
  if (!next) {
    const appearances = number(stats.matches);
    return {
      key: "matches",
      label: "Keep building your legacy",
      current: appearances,
      target: appearances + 10,
      detail: "Your next milestone is waiting in the next ten appearances.",
    };
  }
  return { ...next, current: number(stats[next.key]) };
}

export function getCareerMilestones(stats = {}) {
  return CAREER_MILESTONE_RULES.map(rule => {
    const value = number(stats[rule.key]);
    const unlocked = [...rule.thresholds].reverse().find(threshold => value >= threshold) || 0;
    const next = rule.thresholds.find(threshold => threshold > value) || Math.ceil((value + 1) / 100) * 100;
    return {
      ...rule,
      value,
      unlocked,
      earnedLevels: rule.thresholds.filter(threshold => value >= threshold),
      next,
      progress: Math.min(100, Math.round((value / next) * 100)),
    };
  });
}


export const CAREER_KIT_CATALOGUE = [
  {
    id: "home",
    label: "Matchday Home",
    subtitle: "Your first colours",
    requirement: "Available from the start",
    metric: null,
    threshold: 0,
    light: "#b9a056",
    dark: "#524522",
  },
  {
    id: "heritage",
    label: "Heritage",
    subtitle: "A growing career",
    requirement: "25 recorded appearances",
    metric: "matches",
    threshold: 25,
    light: "#c77c58",
    dark: "#713a2c",
  },
  {
    id: "golden",
    label: "Golden Season",
    subtitle: "Consistency deserves its shine",
    requirement: "50 recorded appearances",
    metric: "matches",
    threshold: 50,
    light: "#f0d17d",
    dark: "#78571d",
  },
  {
    id: "golden-boot",
    label: "Golden Boot",
    subtitle: "A proven goalscorer",
    requirement: "25 career goals",
    metric: "goals",
    threshold: 25,
    light: "#e5b95b",
    dark: "#77432d",
  },
  {
    id: "playmaker",
    label: "The Architect",
    subtitle: "Built on creativity",
    requirement: "25 career assists",
    metric: "assists",
    threshold: 25,
    light: "#74b8ae",
    dark: "#285a5a",
  },
  {
    id: "centurion",
    label: "Centurion",
    subtitle: "A century of appearances",
    requirement: "100 recorded appearances",
    metric: "matches",
    threshold: 100,
    light: "#b6a0df",
    dark: "#514078",
  },
];

export function getCareerKits(stats = {}) {
  return CAREER_KIT_CATALOGUE.map(kit => ({
    ...kit,
    unlocked: kit.metric === null || number(stats[kit.metric]) >= kit.threshold,
    progress: kit.metric === null
      ? 100
      : Math.min(100, Math.round((number(stats[kit.metric]) / kit.threshold) * 100)),
    current: kit.metric === null ? null : number(stats[kit.metric]),
  }));
}
