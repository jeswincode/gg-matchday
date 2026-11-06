const ROOM_INTERACTIONS = [
  { test: /sofa|seat|bench|tactics table|gaming station|console|arcade/i, pose: "seated", motion: "idle", duration: 0 },
  { test: /ball|kickabout|match ball/i, pose: "standing", motion: "cheer", duration: 1450 },
  { test: /banner|supporter|club flag/i, pose: "standing", motion: "wave", duration: 1250 },
  { test: /trophy|honours|plaque|display/i, pose: "standing", motion: "wave", duration: 1250 },
  { test: /weight|training|rack|workout/i, pose: "standing", motion: "cheer", duration: 1150 },
];

export function getRoomInteraction(label = "") {
  const value = String(label || "");
  const action = ROOM_INTERACTIONS.find((entry) => entry.test.test(value));
  if (!action) return { pose: "standing", motion: "idle", duration: 0 };
  return { pose: action.pose, motion: action.motion, duration: action.duration };
}
