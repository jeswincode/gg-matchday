const changeTime = 510;

export function celebrationTiming(name) {
  const ronaldo = name === "ronaldo";
  const moveTime = ronaldo ? 1060 : 1050;
  const plantTime = ronaldo ? 160 : 375;
  const jumpTime = ronaldo ? 690 : 0;
  const landingTime = ronaldo ? 530 : 840;
  const poseAt = changeTime + moveTime + plantTime;
  const impactAt = poseAt + jumpTime;

  return {
    ronaldo,
    kit: ronaldo ? "madrid" : "barcelona",
    moveAt: changeTime,
    plantAt: changeTime + moveTime,
    poseAt,
    impactAt,
    restoreAt: impactAt + landingTime,
    finishAt: impactAt + landingTime + changeTime,
  };
}

export function celebrationFrame(timing, elapsed, side = "right") {
  const { ronaldo, kit, moveAt, plantAt, poseAt, impactAt, restoreAt, finishAt } = timing;
  const opposite = side === "right" ? "left" : "right";
  if (elapsed < moveAt) return { action: "change", kit: elapsed >= moveAt / 2 ? kit : undefined };
  if (elapsed < plantAt) return { action: ronaldo ? "run" : "messi-walk", kit, facing: side };
  if (elapsed < poseAt) return ronaldo ? { action: "plant", kit, facing: side }
    : { action: "kiss", kit, facing: "front" };
  if (elapsed < impactAt) {
    const turn = (elapsed - poseAt) / (impactAt - poseAt);
    return { action: "siuu", kit, facing: turn < .24 ? side : turn < .52 ? "front" : turn < .72 ? opposite : "back" };
  }
  if (elapsed < restoreAt) return { action: ronaldo ? "impact" : "sky", kit, facing: ronaldo ? "back" : "front" };
  if (elapsed < finishAt) return { action: "change-back", kit: elapsed < restoreAt + moveAt / 2 ? kit : undefined };
  return {};
}

export function celebrationDestination(x, row, min, max, ronaldo) {
  const spans = row.map(tab => {
    const inset = Math.min(13, (tab.right - tab.left) / 3);
    return { left: Math.max(min, tab.left + inset), right: Math.min(max, tab.right - inset) };
  }).filter(span => span.left <= span.right);
  if (!spans.length) return x;
  const left = Math.min(...spans.map(span => span.left));
  const right = Math.max(...spans.map(span => span.right));
  const shortest = ronaldo ? 45 : 20;
  const longest = Math.min(ronaldo ? 410 : 92, (right - left) * (ronaldo ? .61 : .32));
  const direction = x - left < shortest * 2 ? 1 : right - x < shortest * 2 ? -1
    : Math.random() < .5 ? -1 : 1;
  const available = direction > 0 ? right - x : x - left;
  const high = Math.min(longest, Math.max(0, available - 4));
  const low = Math.min(shortest, high * .7);
  const desired = x + direction * (low + Math.random() * (high - low));
  return spans.reduce((best, span) => {
    const point = Math.max(span.left, Math.min(desired, span.right));
    return Math.abs(point - desired) < Math.abs(best - desired) ? point : best;
  }, x);
}

export function celebrationCues(timing) {
  const { moveAt, plantAt, poseAt, impactAt, restoreAt, finishAt } = timing;
  const jump = impactAt - poseAt;
  return [...new Set([0, moveAt / 2, moveAt, plantAt, poseAt,
    poseAt + Math.ceil(jump * .24), poseAt + Math.ceil(jump * .52),
    poseAt + Math.ceil(jump * .72), impactAt, restoreAt,
    (restoreAt + finishAt) / 2, finishAt])];
}
