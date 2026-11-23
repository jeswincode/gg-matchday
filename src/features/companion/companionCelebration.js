const changeTime = 430;

export function celebrationTiming(name) {
  const ronaldo = name === "ronaldo";
  const moveTime = ronaldo ? 790 : 930;
  const poseTime = ronaldo ? 880 : 330;

  return {
    ronaldo,
    kit: ronaldo ? "madrid" : "barcelona",
    moveAt: changeTime,
    poseAt: changeTime + moveTime,
    restoreAt: changeTime + moveTime + poseTime,
    finishAt: changeTime * 2 + moveTime + poseTime,
  };
}

export function celebrationFrame(timing, elapsed) {
  const { ronaldo, kit, moveAt, poseAt, restoreAt, finishAt } = timing;
  if (elapsed < moveAt) return { action: "change", kit: elapsed >= moveAt / 2 ? kit : undefined };
  if (elapsed < poseAt) return { action: ronaldo ? "run" : "sky", kit };
  if (elapsed < restoreAt) return { action: ronaldo ? "siuu" : "sky", kit };
  if (elapsed < finishAt) return { action: "change-back", kit: elapsed < restoreAt + moveAt / 2 ? kit : undefined };
  return {};
}
