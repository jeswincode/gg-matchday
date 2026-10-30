const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export const CAREER_MILESTONE_RULES = [
  { key: "matches", label: "Appearances", icon: "AP", thresholds: [1, 10, 25, 50, 100, 200, 500] },
  { key: "goals", label: "Goals", icon: "GO", thresholds: [1, 10, 25, 50, 100, 150, 200] },
  { key: "assists", label: "Assists", icon: "AS", thresholds: [1, 10, 25, 50, 100] },
  { key: "cleanSheets", label: "Clean sheets", icon: "CS", thresholds: [1, 10, 25, 50, 100] },
  { key: "wins", label: "Team wins", icon: "W", thresholds: [1, 10, 25, 50, 100] },
];

const APPEARANCE_OBJECTIVES = [
  { target: 1, label: "Make your first appearance", detail: "Your career starts with a recorded Matchday appearance." },
  { target: 10, label: "Reach 10 appearances", detail: "Build consistency and reach double-digit appearances." },
  { target: 25, label: "Reach 25 appearances", detail: "Your first major career milestone is within reach." },
  { target: 50, label: "Reach 50 appearances", detail: "A half-century of appearances is a milestone worth keeping." },
  { target: 100, label: "Reach 100 appearances", detail: "Join the centurion club through recorded Matchday appearances." },
  { target: 200, label: "Reach 200 appearances", detail: "A long-term career built one match at a time." },
  { target: 500, label: "Reach 500 appearances", detail: "A remarkable career archive, built on the pitch." },
];

export function getNextCareerObjective(stats = {}) {
  const appearances = number(stats.matches);
  const next = APPEARANCE_OBJECTIVES.find(objective => appearances < objective.target);
  if (!next) {
    return {
      key: "matches",
      label: "Keep building your legacy",
      current: appearances,
      target: appearances + 10,
      detail: "Your next milestone is waiting in the next ten appearances.",
    };
  }
  return { key: "matches", ...next, current: appearances };
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
