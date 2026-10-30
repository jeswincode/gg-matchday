export function positionGroup(position = "") {
  const value = String(position || "").toUpperCase();
  if (/GK|GOALKEEP/.test(value)) return "GK";
  if (/CB|LB|RB|LWB|RWB|DEF/.test(value)) return "DEF";
  if (/CDM|CM|CAM|LM|RM|MID/.test(value)) return "MID";
  if (/ST|CF|LW|RW|ATT|FORWARD/.test(value)) return "ATT";
  return "UNK";
}

export function penaltyIsGoal({ keeperLane, shotLane, power = "balanced", powerRoll = 0.5 }) {
  if (shotLane === keeperLane) return false;
  if (power === "power" && Number(powerRoll) < 0.15) return false;
  return true;
}

export function targetIsHit(target, selection) {
  return String(target) === String(selection);
}

export function evaluateTacticalPlan({
  positions = [],
  selectedCount = 0,
  requiredCount = 4,
  answer = null,
  correctAnswer = null,
  approachScore = 5,
  ovrValues = [],
}) {
  const coverage = new Set(positions.filter(role => role !== "UNK"));
  const roles = {
    hasKeeper: coverage.has("GK"),
    hasDefence: coverage.has("DEF"),
    hasMidfield: coverage.has("MID"),
    hasAttack: coverage.has("ATT"),
  };
  const assessedOvr = ovrValues.length
    ? ovrValues.reduce((total, value) => total + Number(value), 0) / ovrValues.length
    : null;
  const roleScore = Math.min(24, coverage.size * 6);
  const shapeScore = selectedCount === requiredCount
    ? 15
    : Math.max(0, 15 - Math.abs(selectedCount - requiredCount) * 5);
  const tacticalScore = answer === correctAnswer ? 26 : answer === null ? 0 : 8;
  const ovrScore = assessedOvr === null ? null : Math.round(assessedOvr / 99 * 20);
  const score = [roleScore, shapeScore, tacticalScore, approachScore, ovrScore]
    .filter(value => value !== null)
    .reduce((total, value) => total + value, 0);
  const shapeAdvice = selectedCount !== requiredCount
    ? "Your current selection has " + selectedCount + " players; this shape requires exactly " + requiredCount + ". Choose the matching 4v4 or 5v5 squad size."
    : "Your squad size matches the selected small-sided shape.";

  return {
    score,
    maxScore: ovrScore === null ? 75 : 95,
    roles,
    assessedOvr,
    shapeAdvice,
    roleScore,
    shapeScore,
    tacticalScore,
    approachScore,
    ovrScore,
  };
}
