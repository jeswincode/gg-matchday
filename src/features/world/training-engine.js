export const TRAINING_DRILLS = Object.freeze([
  {
    id: "scan-release",
    name: "Scan & Release",
    skill: "Scanning",
    focus: ["CAM", "CM", "CDM", "RM", "LM"],
    description: "Read the space before the ball arrives.",
    questions: [
      { prompt: "A midfielder receives with a defender closing from behind. What should happen before the first touch?", options: ["Check both shoulders and identify the free side", "Look only at the ball", "Turn into the nearest defender"], correct: 0, feedback: "Scan early so the first touch has a purpose." },
      { prompt: "Your striker starts a run while the centre-back steps forward. What do you read first?", options: ["The referee", "The defender's movement and the space behind", "Only the striker's feet"], correct: 1, feedback: "Read the defender and the space that movement creates." },
      { prompt: "You receive between two opponents. Which cue is most useful?", options: ["Where the nearest pressure is coming from and where the exit is", "The crowd", "Your own goal only"], correct: 0, feedback: "A useful scan identifies both pressure and the next safe action." },
      { prompt: "The passing lane closes as the ball travels. What is the best response?", options: ["Force the original pass", "Freeze", "Adjust your body shape and use the next available option"], correct: 2, feedback: "Good scanning is continuous; update the picture as it changes." },
      { prompt: "When is the most useful time to scan?", options: ["Only after controlling the ball", "Before the pass arrives and again as play changes", "Only when you are unmarked"], correct: 1, feedback: "Scan before receiving, then keep checking your surroundings." },
    ],
  },
  {
    id: "first-touch",
    name: "First-touch Gate",
    skill: "First touch",
    focus: ["CAM", "CM", "CDM", "ST", "CF", "LW", "RW", "LM", "RM"],
    description: "Choose the touch that opens the next action.",
    questions: [
      { prompt: "Pressure is arriving from your right and space is open to your left. Where should your first touch go?", options: ["Into the defender", "Across your body into the open left channel", "Straight back where the pass came from"], correct: 1, feedback: "Take the first touch away from pressure and into useful space." },
      { prompt: "A firm pass arrives at your feet with no immediate pressure. What helps you play forward quickly?", options: ["A controlled touch into your passing lane", "A large touch five metres away", "Stop the ball under your sole every time"], correct: 0, feedback: "A touch that sets the next action saves time." },
      { prompt: "You receive with your back to goal and a teammate overlaps. What is a useful first action?", options: ["Turn blindly", "Let the ball run out", "Protect the ball and set it into the teammate's path"], correct: 2, feedback: "Use your body to protect possession and connect the next runner." },
      { prompt: "A bouncing pass arrives while you are moving. What should you prioritise?", options: ["A controlled contact that keeps the ball playable", "A powerful clearance", "A stationary pose"], correct: 0, feedback: "Control is about keeping the next option alive." },
      { prompt: "The ball arrives on your weaker foot. What is the better training choice?", options: ["Avoid the ball", "Practise a simple directional touch with that foot", "Always switch feet after the touch"], correct: 1, feedback: "Repeated, controlled weaker-foot contacts build comfort." },
    ],
  },
  {
    id: "passing-lanes",
    name: "Passing Lanes",
    skill: "Passing",
    focus: ["CAM", "CM", "CDM", "CB", "LB", "RB", "LM", "RM"],
    description: "Find the pass that moves the opposition.",
    questions: [
      { prompt: "A compact block protects the centre. What is the best way to create a new lane?", options: ["Force a central pass", "Switch play and stretch the block", "Pass slowly into traffic"], correct: 1, feedback: "Move the block side to side before trying to split it." },
      { prompt: "A teammate checks toward the ball while another runs beyond. What can a third-player pass create?", options: ["A foul every time", "A dead end", "A one-touch combination that bypasses pressure"], correct: 2, feedback: "Third-player combinations can remove the first line of pressure." },
      { prompt: "A defender steps out of the back line. Which pass may be available?", options: ["A pass into the space the defender has left", "A pass straight at the defender", "No pass can ever be played"], correct: 0, feedback: "Recognise the space created by an opponent leaving their line." },
      { prompt: "You are under pressure and no forward lane is safe. What is a good decision?", options: ["Give the ball away", "Recycle possession and move to create a new angle", "Shoot from your own half"], correct: 1, feedback: "Keeping the ball can be the action that creates the next opening." },
      { prompt: "A teammate is tightly marked but a wide player is free. What should you do?", options: ["Ignore the free player", "Pass into the marked teammate anyway", "Use the free option and shift the defence"], correct: 2, feedback: "Use the free player to move the opposition and open the pitch." },
    ],
  },
  {
    id: "finish-quick",
    name: "Finishing Decisions",
    skill: "Finishing",
    focus: ["ST", "CF", "LW", "RW", "CAM"],
    description: "Select the finish for the angle and goalkeeper.",
    questions: [
      { prompt: "The goalkeeper is set and you have a clear view of the far corner. What matters most?", options: ["Placement and a composed contact", "Maximum power every time", "Close your eyes"], correct: 0, feedback: "A composed, accurate finish can beat power without control." },
      { prompt: "The goalkeeper rushes off the line and closes your angle. What option may be available?", options: ["A pass backwards only", "A lifted finish if the space and balance allow it", "Kick directly at the goalkeeper"], correct: 1, feedback: "Read the keeper's position and choose a finish that uses the space." },
      { prompt: "A cut-back reaches you around the penalty spot. What should you do?", options: ["Take several unnecessary touches", "Turn away from goal", "Set your body early and strike through the ball"], correct: 2, feedback: "Prepare your body shape before the cut-back arrives." },
      { prompt: "A defender blocks the near post. Where might the space be?", options: ["Across the goal toward the far side", "Behind the goal", "Inside the defender"], correct: 0, feedback: "Use the defender's position to identify the open side." },
      { prompt: "You are off balance and a teammate is free in a better position. What is the higher-quality choice?", options: ["Shoot regardless", "Play the teammate in", "Hold the ball until tackled"], correct: 1, feedback: "Good finishing starts with choosing the best scoring action." },
    ],
  },
  {
    id: "defensive-shape",
    name: "Pressing Triggers",
    skill: "Defensive awareness",
    focus: ["CB", "LB", "RB", "CDM", "CM"],
    description: "Recognise when to press, cover and protect space.",
    questions: [
      { prompt: "The opponent takes a heavy touch toward the sideline. What can trigger a press?", options: ["The heavy touch and restricted options", "The colour of their shirt", "A teammate's celebration"], correct: 0, feedback: "A heavy touch near the sideline can limit the opponent's exits." },
      { prompt: "Your teammate steps forward to press. What should you do?", options: ["All defenders chase the same player", "Drop your eyes", "Cover the space and passing lane behind the presser"], correct: 2, feedback: "Cover behind the press so one pass does not break the line." },
      { prompt: "The ball is on the far side. What should the weak-side defender do?", options: ["Stay connected and protect the far-post space", "Stand on the touchline", "Leave the back line"], correct: 0, feedback: "Weak-side positioning protects the space the ball can travel into." },
      { prompt: "An opponent receives facing their own goal under pressure. What is a useful team cue?", options: ["Retreat without communication", "Step together if cover is in place", "Break the defensive line"], correct: 1, feedback: "Press as a unit when the cover and distances are right." },
      { prompt: "The opponent breaks the first press. What becomes the priority?", options: ["Keep chasing from behind", "Protect the central route to goal and recover shape", "Stop tracking runners"], correct: 1, feedback: "Recover compactness and protect the most dangerous central spaces." },
    ],
  },
]);

export function drillsForPosition(position = "") {
  const code = String(position || "").trim().toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const aliases = [
    ["GK", ["GK", "GOALKEEPER"]],
    ["CB", ["CB", "CENTRE BACK", "CENTER BACK", "CENTRAL DEFENDER"]],
    ["LB", ["LB", "LEFT BACK", "LEFT FULLBACK", "LEFT FULL BACK"]],
    ["RB", ["RB", "RIGHT BACK", "RIGHT FULLBACK", "RIGHT FULL BACK"]],
    ["CDM", ["CDM", "DEFENSIVE MIDFIELDER", "HOLDING MIDFIELDER"]],
    ["CM", ["CM", "CENTRAL MIDFIELDER", "CENTRE MIDFIELDER", "CENTER MIDFIELDER"]],
    ["CAM", ["CAM", "AM", "ATTACKING MIDFIELDER", "OFFENSIVE MIDFIELDER"]],
    ["LM", ["LM", "LEFT MIDFIELDER", "LEFT WINGER MIDFIELDER"]],
    ["RM", ["RM", "RIGHT MIDFIELDER", "RIGHT WINGER MIDFIELDER"]],
    ["LW", ["LW", "LEFT WINGER"]],
    ["RW", ["RW", "RIGHT WINGER"]],
    ["CF", ["CF", "CENTRE FORWARD", "CENTER FORWARD", "SECOND STRIKER"]],
    ["ST", ["ST", "STRIKER", "CENTRE STRIKER", "CENTER STRIKER", "CENTRE FORWARD"]],
  ];
  const role = aliases.find(([, names]) => names.some(name => code === name || code.startsWith(name + " ")))?.[0];
  if (!role) return TRAINING_DRILLS;
  const matching = TRAINING_DRILLS.filter((drill) => drill.focus.includes(role));
  return matching.length ? matching : TRAINING_DRILLS;
}

export function evaluateTrainingRound(drill, answers = []) {
  const questions = Array.isArray(drill?.questions) ? drill.questions : [];
  const evaluated = questions.map((question, index) => ({
    correct: Number(answers[index]) === question.correct,
    feedback: question.feedback,
  }));
  const correct = evaluated.filter((item) => item.correct).length;
  const total = questions.length;
  return {
    correct,
    total,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    evaluated,
  };
}
