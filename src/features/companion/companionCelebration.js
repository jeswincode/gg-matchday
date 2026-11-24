const changeTime = 510;

export function celebrationTiming(name) {
  const ronaldo = name === "ronaldo";
  const moveTime = ronaldo ? 1060 : 870;
  const plantTime = ronaldo ? 160 : 0;
  const jumpTime = ronaldo ? 690 : 0;
  const landingTime = ronaldo ? 530 : 570;
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
  if (elapsed < plantAt) return { action: ronaldo ? "run" : "messi-walk", kit, facing: ronaldo ? side : undefined };
  if (elapsed < poseAt) return { action: "plant", kit, facing: side };
  if (elapsed < impactAt) {
    const turn = (elapsed - poseAt) / (impactAt - poseAt);
    return { action: "siuu", kit, facing: turn < .24 ? side : turn < .52 ? "front" : turn < .72 ? opposite : "back" };
  }
  if (elapsed < restoreAt) return { action: ronaldo ? "impact" : "sky", kit, facing: ronaldo ? "back" : undefined };
  if (elapsed < finishAt) return { action: "change-back", kit: elapsed < restoreAt + moveAt / 2 ? kit : undefined };
  return {};
}

export function celebrationCues(timing) {
  const { moveAt, plantAt, poseAt, impactAt, restoreAt, finishAt } = timing;
  const jump = impactAt - poseAt;
  return [...new Set([0, moveAt / 2, moveAt, plantAt, poseAt,
    poseAt + Math.ceil(jump * .24), poseAt + Math.ceil(jump * .52),
    poseAt + Math.ceil(jump * .72), impactAt, restoreAt,
    (restoreAt + finishAt) / 2, finishAt])];
}
