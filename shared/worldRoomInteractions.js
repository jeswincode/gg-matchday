const ROOM_INTERACTIONS = [
  {
    test: /sofa|seat|bench|tactics table|gaming station|console|arcade/i,
    pose: "seated", motion: "idle", duration: 0,
    dialogue: ["Make yourself comfortable.", "Every great club needs a place to think.", "Right, back to the football."],
  },
  {
    test: /ball|kickabout|match ball|football rack|mini-pitch|five-a-side-pitch/i,
    pose: "standing", motion: "juggle", duration: 1920,
    dialogue: ["A few keepy-uppies first.", "Keep the ball close and your eyes up.", "That touch is getting sharper."],
  },
  {
    test: /goal|scoreboard|\bnet(s)?\b/i,
    pose: "standing", motion: "kick", duration: 990,
    dialogue: ["Pick your corner.", "Plant your foot and strike through the ball.", "That's how you make the keeper work."],
  },
  {
    test: /training cones|cone drill|agility ladder/i,
    pose: "standing", motion: "stepover", duration: 1680,
    dialogue: ["Quick feet. Soft touches.", "Stay balanced through the turn.", "Sharp work. One more run."],
  },
  {
    test: /banner|supporter|club flag/i,
    pose: "standing", motion: "wave", duration: 1250,
    dialogue: ["Hear that? That's the supporters.", "Every badge has a story.", "Give them something to sing about."],
  },
  {
    test: /trophy|honours|plaque|display/i,
    pose: "standing", motion: "cheer", duration: 1450,
    dialogue: ["A little history on these walls.", "The next chapter is still waiting to be written.", "Let's earn another one."],
  },
  {
    test: /weight|training|workout/i,
    pose: "standing", motion: "cheer", duration: 1150,
    dialogue: ["Form first. Then intensity.", "Build the habit one session at a time.", "Good work. Recover well."],
  },
];

export function getRoomInteraction(label = "") {
  const value = String(label || "");
  const action = ROOM_INTERACTIONS.find((entry) => entry.test.test(value));
  if (!action) return { pose: "standing", motion: "idle", duration: 0 };
  return {
    pose: action.pose,
    motion: action.motion,
    duration: action.duration,
    dialogue: [...action.dialogue],
  };
}
