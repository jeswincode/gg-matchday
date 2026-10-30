import { useEffect, useMemo, useRef, useState } from "react";
import "./play-centre.css";
import { evaluateTacticalPlan, penaltyIsGoal, positionGroup, targetIsHit } from "./play-engine.js";

const MODES = [
  { key: "penalties", name: "Penalty Shootout", tag: "5 kicks" },
  { key: "crossbar", name: "Crossbar Challenge", tag: "Target practice" },
  { key: "dribble", name: "Dribble Run", tag: "Reaction test" },
  { key: "freekick", name: "Free Kick", tag: "Set-piece aim" },
];
const LANES = ["left", "centre", "right"];
const DRIBBLE_KEYS = ["left", "right", "up"];
const STORE_PREFIX = "gg-v4-practice-best-";
const readBest = key => {
  try {
    const value = Number(window.localStorage.getItem(STORE_PREFIX + key) || 0);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch { return 0; }
};
const saveBest = (key, score) => {
  try {
    if (score > readBest(key)) window.localStorage.setItem(STORE_PREFIX + key, String(score));
  } catch { /* Best scores are an optional local convenience. */ }
};
const choose = list => list[Math.floor(Math.random() * list.length)];
const playerOvr = player => {
  const value = player?.ovrSnapshot?.currentOvr ?? player?.ovrSnapshot?.careerOvr;
  return Number.isFinite(Number(value)) && value !== null ? Number(value) : null;
};

const SCENARIOS = [
  { key: "press", opponent: "Aggressive high press", problem: "They close passing lanes quickly and try to win the ball near your goal.", answers: ["Quick combinations and third-man runs", "Hold the ball in your own half", "Dribble into pressure"], correct: 0, clue: "Move the ball quickly and use the space behind the first press.", approachScores: { balanced: 9, aggressive: 10, conservative: 5 } },
  { key: "block", opponent: "Compact low block", problem: "They defend deep, protect the centre and leave little room between the lines.", answers: ["Force every pass through the middle", "Stretch the pitch and create wide overloads", "Drop every attacker into your own half"], correct: 1, clue: "Stretch the block horizontally before attacking the gaps.", approachScores: { balanced: 10, aggressive: 8, conservative: 6 } },
  { key: "counter", opponent: "Fast counter-attacking side", problem: "They leave players high and attack quickly when you lose possession.", answers: ["Send everyone forward at once", "Keep rest-defence cover and circulate patiently", "Abandon the midfield"], correct: 1, clue: "Protect the space behind the ball while keeping possession.", approachScores: { balanced: 9, aggressive: 4, conservative: 10 } },
  { key: "midfield", opponent: "Midfield overload", problem: "They crowd the centre and try to win second balls around the middle.", answers: ["Create wide outlets and switch play", "Keep all players in the centre", "Play short passes into the crowded zone"], correct: 0, clue: "Use width to pull their midfield apart.", approachScores: { balanced: 10, aggressive: 8, conservative: 6 } },
];
const FORMATIONS = {
  four: ["1-2-1", "2-1-1", "1-3", "3-1", "2-2"],
  five: ["1-2-2", "2-2-1", "2-1-2", "1-3-1", "3-1-1"],
};

function bestFor(mode) { return readBest(mode); }
function laneLabel(lane) { return lane === "centre" ? "CENTRE" : lane.toUpperCase(); }

function GamePanel({ mode, onModeChange, playerId }) {
  const scoreScope = String(playerId || "guest").replace(/[^a-zA-Z0-9_-]/g, "_");
  const bestKey = scoreScope + "-" + mode;
  const [best, setBest] = useState(() => bestFor(bestKey));
  const [round, setRound] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [selectedLane, setSelectedLane] = useState("centre");
  const [power, setPower] = useState("balanced");
  const [dribbleStep, setDribbleStep] = useState(0);

  useEffect(() => {
    setBest(bestFor(bestKey));
    setRound(null);
    setFeedback("");
    setDribbleStep(0);
  }, [bestKey]);

  const start = () => {
    if (mode === "penalties") {
      setRound({ step: 0, score: 0, keepers: Array.from({ length: 5 }, () => choose(LANES)), complete: false });
    } else if (mode === "crossbar" || mode === "freekick") {
      setRound({ step: 0, score: 0, targets: Array.from({ length: 5 }, () => mode === "crossbar" ? choose(["left", "centre", "right"]) : choose(["low-left", "high-left", "high-right", "low-right"])), complete: false });
    } else {
      setRound({ step: 0, score: 0, sequence: Array.from({ length: 8 }, () => choose(DRIBBLE_KEYS)), complete: false });
      setDribbleStep(0);
    }
    setFeedback("");
  };

  const finish = (score, total) => {
    const finalScore = Math.round(score);
    saveBest(bestKey, finalScore);
    setBest(current => Math.max(current, finalScore));
    setRound(current => ({ ...current, complete: true, score: finalScore, total }));
    setFeedback("Challenge complete. Your best score is saved on this device.");
  };

  const takeShot = lane => {
    if (!round || round.complete || mode === "dribble") return;
    const target = mode === "penalties" ? round.keepers[round.step] : round.targets[round.step];
    const hit = mode === "penalties"
      ? penaltyIsGoal({ keeperLane: target, shotLane: lane, power, powerRoll: Math.random() })
      : targetIsHit(target, lane);
    const score = round.score + (hit ? 1 : 0);
    const nextStep = round.step + 1;
    setSelectedLane(lane);
    if (hit) setFeedback(mode === "penalties" ? "GOAL! You sent the keeper the wrong way." : "ON TARGET! Nice execution.");
    else setFeedback(mode === "penalties" ? "SAVED! The goalkeeper read your direction." : "MISSED! Adjust your aim for the next attempt.");
    if (nextStep >= 5) finish(score, 5);
    else setRound(current => ({ ...current, step: nextStep, score }));
  };

  const makeDribbleMove = move => {
    if (!round || round.complete) return;
    const expected = round.sequence[dribbleStep];
    const nextScore = round.score + (move === expected ? 10 : 0);
    const nextStep = dribbleStep + 1;
    setDribbleStep(nextStep);
    setFeedback(move === expected ? "Clean touch. You beat the cone." : "You clipped the cone. Keep going.");
    if (nextStep >= round.sequence.length) finish(nextScore, round.sequence.length * 10);
    else setRound(current => ({ ...current, step: nextStep, score: nextScore }));
  };

  const progress = round ? Math.min(100, round.step / (mode === "dribble" ? 8 : 5) * 100) : 0;
  const currentTarget = round?.targets?.[round.step];
  const currentDribbleMove = round?.sequence?.[dribbleStep];
  const trainingCue = mode === "dribble"
    ? ({ left: "MOVE LEFT", right: "MOVE RIGHT", up: "PUSH FORWARD" }[currentDribbleMove] || "Choose your next touch")
    : mode === "crossbar"
      ? "Current target: " + laneLabel(currentTarget || "centre")
      : mode === "freekick"
        ? "Target quadrant: " + String(currentTarget || "high-left").replace("-", " ").toUpperCase()
        : "The keeper's starting position is hidden.";
  const modeCopy = {
    penalties: { eyebrow: "ONE VERSUS ONE", title: "Penalty Shootout", description: "Five kicks. Read the keeper. Choose your corner." },
    crossbar: { eyebrow: "TECHNIQUE TEST", title: "Crossbar Challenge", description: "Five attempts to place the ball in the target zone." },
    dribble: { eyebrow: "CLOSE CONTROL", title: "Dribble Run", description: "Follow the eight-move cone sequence and keep your touch clean." },
    freekick: { eyebrow: "SET-PIECE LAB", title: "Free Kick", description: "Pick the target quadrant and try to beat the wall." },
  }[mode];

  return (
    <section className="play-game-panel">
      <div className="play-game-header">
        <div><p className="play-eyebrow">{modeCopy.eyebrow}</p><h3>{modeCopy.title}</h3><p>{modeCopy.description}</p></div>
        <div className="play-best"><span>PERSONAL BEST</span><strong>{best}{mode === "dribble" ? " PTS" : " / 5"}</strong><small>This device only</small></div>
      </div>
      <div className="play-pitch-scene">
        <div className="play-pitch-lines" aria-hidden="true"><span/><span/><span/></div>
        {mode === "penalties" && <div className="play-goal"><span className="play-goal-net"/><span className="play-keeper">GK</span><span className="play-ball">⚽</span></div>}
        {mode === "crossbar" && <div className="play-target-board"><span className={"play-target-spot play-target-left" + (currentTarget === "left" ? " is-target" : "")}>01</span><span className={"play-target-spot play-target-centre" + (currentTarget === "centre" ? " is-target" : "")}>02</span><span className={"play-target-spot play-target-right" + (currentTarget === "right" ? " is-target" : "")}>03</span><b>CROSSBAR ZONES</b></div>}
        {mode === "freekick" && <div className="play-free-wall"><span className="play-wall">▮ ▮ ▮ ▮ ▮</span><span className="play-free-goal">GOAL</span><span className="play-ball">⚽</span></div>}
        {mode === "dribble" && <div className="play-cone-course"><span>▲</span><span>▲</span><span>▲</span><span>▲</span><span>▲</span><b>DRIBBLE COURSE</b></div>}
        <div className="play-scoreboard"><span>ATTEMPT</span><strong>{round ? Math.min(round.step + (round.complete ? 0 : 1), mode === "dribble" ? 8 : 5) : 0} <small>/ {mode === "dribble" ? 8 : 5}</small></strong><i>{round ? round.score : 0} {mode === "dribble" ? "PTS" : "SCORE"}</i></div>
      </div>
      <div className="play-progress"><span style={{ width: progress + "%" }}/></div>
      {!round ? (
        <div className="play-start-row"><div><strong>Ready when you are.</strong><small>Practice results never affect Matchday statistics or player ratings.</small></div><button type="button" className="play-primary-button" onClick={start}>Start challenge →</button></div>
      ) : round.complete ? (
        <div className="play-result">
          <div><p className="play-eyebrow">FINAL RESULT</p><strong>{round.score}{mode === "dribble" ? " PTS" : " / 5"}</strong><small>{mode === "dribble" ? "Correct moves: " + Math.round(round.score / 10) + " of 8" : "Successful attempts: " + round.score + " of 5"}</small></div>
          <div className="play-result-actions"><button type="button" className="play-secondary-button" onClick={start}>Play again</button><button type="button" className="play-primary-button" onClick={() => onModeChange("penalties")}>Next challenge →</button></div>
        </div>
      ) : mode === "dribble" ? (
        <div className="play-controls">
          <div className="play-control-copy"><strong>Move {dribbleStep + 1} of 8</strong><small>Read the cue and choose the matching touch.</small><small className="play-training-cue">{trainingCue}</small></div>
          <div className="play-direction-grid">
            <button type="button" className="play-direction-up" onClick={() => makeDribbleMove("up")}>↑ Push forward</button>
            <button type="button" onClick={() => makeDribbleMove("left")}>← Left</button>
            <button type="button" onClick={() => makeDribbleMove("right")}>Right →</button>
          </div>
        </div>
      ) : (
        <div className="play-controls">
          <div className="play-control-copy"><strong>{mode === "penalties" ? "Choose your shot direction" : mode === "crossbar" ? "Pick a target zone" : "Pick a free-kick quadrant"}</strong><small>{mode === "penalties" ? "Balanced power is the safer option. Power shots carry a small execution risk." : "You have five attempts to find the target."}</small>{round && <small className="play-training-cue">{trainingCue}</small>}</div>
          {mode === "penalties" && <div className="play-power-toggle"><button type="button" className={power === "balanced" ? "active" : ""} onClick={() => setPower("balanced")}>Balanced</button><button type="button" className={power === "power" ? "active" : ""} onClick={() => setPower("power")}>Power</button></div>}
          <div className="play-lane-grid">
            {(mode === "freekick" ? ["low-left", "high-left", "high-right", "low-right"] : LANES).map(lane => <button type="button" key={lane} className={selectedLane === lane ? "selected" : ""} onClick={() => takeShot(lane)}>{mode === "freekick" ? lane.replace("-", " ") : laneLabel(lane)}</button>)}
          </div>
        </div>
      )}
      <p className="play-feedback" role="status" aria-live="polite">{feedback || "Pick your move to begin the challenge."}</p>
      <div className="play-mode-switch">{MODES.map(item => <button type="button" key={item.key} className={mode === item.key ? "active" : ""} onClick={() => onModeChange(item.key)}><strong>{item.name}</strong><small>{item.tag}</small></button>)}</div>
    </section>
  );
}

function TacticalLab({ players }) {
  const [squadSize, setSquadSize] = useState(4);
  const [formation, setFormation] = useState("1-2-1");
  const [selectedPlayers, setSelectedPlayers] = useState(() => players.slice(0, 4).map(player => String(player._id)));
  const didInitialiseSquad = useRef(false);

  useEffect(() => {
    if (didInitialiseSquad.current || !players.length) return;
    didInitialiseSquad.current = true;
    setSelectedPlayers(players.slice(0, 4).map(player => String(player._id)));
  }, [players]);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [approach, setApproach] = useState("balanced");
  const [result, setResult] = useState(null);
  const scenario = SCENARIOS[scenarioIndex];
  const capacity = squadSize;
  const options = squadSize === 5 ? FORMATIONS.five : FORMATIONS.four;
  const pickedPlayers = useMemo(() => players.filter(player => selectedPlayers.includes(String(player._id))), [players, selectedPlayers]);
  const groups = pickedPlayers.map(player => positionGroup(player.position));
  const ovrValues = pickedPlayers.map(playerOvr).filter(value => value !== null);
  const planScore = evaluateTacticalPlan({
    positions: groups,
    selectedCount: pickedPlayers.length,
    requiredCount: capacity,
    answer,
    correctAnswer: scenario.correct,
    approachScore: scenario.approachScores[approach] ?? 5,
    ovrValues,
  });
  const pitchSlots = useMemo(() => {
    const lines = formation.split("-").map(Number);
    const lastRow = Math.max(1, lines.length - 1);
    return lines.flatMap((count, row) => Array.from({ length: count }, (_, column) => ({
      x: ((column + 1) / (count + 1)) * 100,
      y: 18 + (row / lastRow) * 64,
    })));
  }, [formation]);
  const shapeAdvice = pickedPlayers.length !== capacity
    ? "Your current selection has " + pickedPlayers.length + " players; this shape requires exactly " + capacity + ". Choose the matching 4v4 or 5v5 squad size."
    : "Your squad size matches the selected small-sided shape.";
  const formationOptions = options.includes(formation) ? options : options[0];

  useEffect(() => {
    if (!options.includes(formation)) setFormation(options[0]);
  }, [formation, options]);

  const togglePlayer = id => {
    setResult(null);
    setSelectedPlayers(current => current.includes(id)
      ? current.filter(value => value !== id)
      : current.length >= 5 ? current : [...current, id]);
  };

  const runChallenge = () => {
    if (pickedPlayers.length < 4) return;
    if (pickedPlayers.length !== capacity || answer === null) return;
    setResult({
      ...planScore,
      tacticalCorrect: answer === scenario.correct,
      explanation: answer === scenario.correct ? scenario.clue : "That response leaves the opponent's main advantage available. " + scenario.clue,
    });
  };

  return (
    <section className="tactical-lab">
      <div className="tactical-heading"><div><p className="play-eyebrow">THE TOUCHLINE / PRACTICE MODE</p><h3>Tactical Challenges</h3><p>Build a small-sided squad, read the opponent and choose a response.</p></div><div className="tactical-scenario-count">SCENARIO {scenarioIndex + 1} / {SCENARIOS.length}</div></div>
      <div className="tactical-opponent">
        <div><span className="tactical-opponent-label">OPPOSITION SCOUT REPORT</span><h4>{scenario.opponent}</h4><p>{scenario.problem}</p></div>
        <button type="button" className="play-secondary-button" onClick={() => { setScenarioIndex(current => (current + 1) % SCENARIOS.length); setAnswer(null); setResult(null); }}>Next scenario ↗</button>
      </div>
      <div className="tactical-builder">
        <section className="tactical-builder-panel">
          <div className="tactical-section-heading"><div><p className="play-eyebrow">01 / YOUR SHAPE</p><h4>Choose a formation</h4></div><span>{capacity} players</span></div>
          <div className="tactical-size-switch" role="group" aria-label="Squad size">
            {[4, 5].map(size => <button key={size} type="button" className={squadSize === size ? "active" : ""} aria-pressed={squadSize === size} onClick={() => {
              setSquadSize(size);
              setSelectedPlayers(current => current.slice(0, size));
              setResult(null);
            }}>{size}v{size}</button>)}
          </div>
          <div className="tactical-formation-select">{options.map(option => <button key={option} type="button" className={formation === option ? "active" : ""} onClick={() => { setFormation(option); setResult(null); }}>{option}</button>)}</div>
          <div className="tactical-pitch">
            <span className="tactical-pitch-circle"/><span className="tactical-pitch-line"/>
            <div className="tactical-pitch-slots">{Array.from({ length: capacity }, (_, index) => { const slot = pitchSlots[index] || { x: 50, y: 50 }; return <span key={index} style={{ left: slot.x + "%", top: slot.y + "%" }} className={pickedPlayers[index] ? "filled" : ""} title={pickedPlayers[index]?.name || "Open position"}>{pickedPlayers[index] ? pickedPlayers[index].name.slice(0, 1).toUpperCase() : index + 1}</span>; })}</div>
            <small>{formation} · {capacity}v{capacity}</small>
          </div>
          <p className="tactical-shape-advice">{shapeAdvice}</p>
        </section>
        <section className="tactical-builder-panel">
          <div className="tactical-section-heading"><div><p className="play-eyebrow">02 / SQUAD SELECTION</p><h4>Pick your players</h4></div><span>{pickedPlayers.length} / {capacity} selected</span></div>
          <div className="tactical-player-list">
            {players.map(player => {
              const selected = selectedPlayers.includes(String(player._id));
              const ovr = playerOvr(player);
              return <button type="button" key={player._id} className={selected ? "selected" : ""} onClick={() => togglePlayer(String(player._id))} disabled={!selected && selectedPlayers.length >= squadSize}><span className="tactical-player-avatar">{player.profileImage ? <img src={player.profileImage} alt=""/> : player.name.slice(0,1).toUpperCase()}</span><span className="tactical-player-name"><strong>{player.name}</strong><small>{player.position || "Position not set"}</small></span><span className="tactical-player-rating">{ovr ?? "—"}</span><span className="tactical-player-check">{selected ? "✓" : "+"}</span></button>;
            })}
            {!players.length && <div className="play-empty">Player directory is empty.</div>}
          </div>
          <p className="tactical-note">OVR is shown only where an existing player snapshot is available. The challenge never creates or changes an OVR value.</p>
        </section>
      </div>
      <section className="tactical-decision">
        <div className="tactical-section-heading"><div><p className="play-eyebrow">03 / MATCH PLAN</p><h4>How will you approach it?</h4></div><span>Choose your response</span></div>
        <div className="tactical-approach-options">{[{key:"balanced",label:"Balanced",detail:"Keep structure in and out of possession."},{key:"aggressive",label:"Aggressive",detail:"Commit more players to the press and attack."},{key:"conservative",label:"Conservative",detail:"Protect space and reduce transition risk."}].map(item => <button type="button" key={item.key} className={approach === item.key ? "active" : ""} onClick={() => { setApproach(item.key); setResult(null); }}><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div>
        <p className="tactical-question">What is your best response to the opposition?</p>
        <div className="tactical-answer-options">{scenario.answers.map((item, index) => <button type="button" key={item} className={answer === index ? "active" : ""} onClick={() => { setAnswer(index); setResult(null); }}><span>{String.fromCharCode(65 + index)}</span>{item}</button>)}</div>
        <button type="button" className="play-primary-button tactical-submit" disabled={pickedPlayers.length !== capacity || answer === null} onClick={runChallenge}>Evaluate my game plan →</button>
      </section>
      {result && <section className="tactical-result" aria-live="polite"><div className="tactical-result-score"><span>TACTICAL EXERCISE SCORE</span><strong>{result.score}<small> / {result.maxScore}</small></strong><em>{result.tacticalCorrect ? "SCOUTING READ CORRECT" : "SCOUTING READ NEEDS WORK"}</em></div><div className="tactical-result-copy"><p className="play-eyebrow">COACH'S REVIEW</p><h4>{result.tacticalCorrect ? "Good reading of the game." : "There is another way through."}</h4><p>{result.explanation}</p><p>{result.shapeAdvice}</p><small>{result.assessedOvr === null ? "No OVR snapshot was available; the score excludes OVR." : "Average selected-player OVR evidence: " + result.assessedOvr.toFixed(1) + ". This is practice feedback only."}</small></div></section>}
      <p className="play-safety-note">Practice simulation only. Tactical scores never affect GG Match ratings, OVR, official match records, Club Wallets, auction outcomes or competitive rankings.</p>
    </section>
  );
}

export default function PlayCentre({ players = [], playerId = null }) {
  const [section, setSection] = useState("arcade");
  const [mode, setMode] = useState("penalties");
  return (
    <section className="tab-content play-centre">
      <div className="play-centre-hero"><div><p className="play-eyebrow">GG MATCHDAY / TRAINING GROUND</p><h2>Play Centre</h2><p>Step away from the stats. Test your touch, sharpen your decisions and chase a personal best.</p></div><div className="play-centre-ball">⚽</div></div>
      <div className="play-centre-tabs" role="tablist" aria-label="Play Centre sections"><button type="button" role="tab" aria-selected={section === "arcade"} className={section === "arcade" ? "active" : ""} onClick={() => setSection("arcade")}>GG Arcade</button><button type="button" role="tab" aria-selected={section === "tactics"} className={section === "tactics" ? "active" : ""} onClick={() => setSection("tactics")}>Tactical Lab</button></div>
      {section === "arcade" ? <GamePanel mode={mode} onModeChange={setMode} playerId={playerId}/> : <TacticalLab players={players}/>}
    </section>
  );
}
