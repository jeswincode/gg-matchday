import { useMemo, useState } from "react";
import { drillsForPosition, evaluateTrainingRound } from "./training-engine.js";

const STORE_PREFIX = "gg-v4-private-training:";
const readSessions = playerId => {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORE_PREFIX + playerId) || "[]");
    return Array.isArray(value) ? value.slice(0, 100) : [];
  } catch { return []; }
};
const saveSessions = (playerId, sessions) => {
  try { window.localStorage.setItem(STORE_PREFIX + playerId, JSON.stringify(sessions.slice(0, 100))); }
  catch { /* Private device-only training journal remains optional. */ }
};
const formatDuration = seconds => {
  const value = Math.max(0, Number(seconds) || 0);
  return value >= 60 ? Math.floor(value / 60) + "m " + (value % 60) + "s" : value + "s";
};

export default function TrainingCenter({ player = null, playerId = "guest" }) {
  const drills = useMemo(() => drillsForPosition(player?.position), [player?.position]);
  const [sessions, setSessions] = useState(() => readSessions(String(playerId)));
  const [selectedDrillId, setSelectedDrillId] = useState(drills[0]?.id || "scan-release");
  const [answers, setAnswers] = useState({});
  const [repIndex, setRepIndex] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [started, setStarted] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const selectedDrill = drills.find(drill => drill.id === selectedDrillId) || drills[0];
  const totalSessions = sessions.length;
  const totalAnswers = sessions.reduce((sum, session) => sum + Number(session.total || 0), 0);
  const totalCorrect = sessions.reduce((sum, session) => sum + Number(session.correct || 0), 0);
  const averageAccuracy = totalAnswers ? Math.round(totalCorrect / totalAnswers * 100) : 0;
  const currentQuestion = selectedDrill.questions[repIndex];
  const chosenAnswer = answers[repIndex];
  const progress = Math.round((Object.keys(answers).length / selectedDrill.questions.length) * 100);

  const chooseDrill = id => {
    setSelectedDrillId(id);
    setStarted(false);
    setAnswers({});
    setRepIndex(0);
    setFeedback(null);
    setResult(null);
    setSessionStartedAt(null);
  };
  const startDrill = () => {
    setAnswers({});
    setRepIndex(0);
    setFeedback(null);
    setResult(null);
    setSessionStartedAt(Date.now());
    setStarted(true);
  };
  const chooseAnswer = optionIndex => {
    if (!started || feedback) return;
    const correct = optionIndex === currentQuestion.correct;
    setAnswers(current => ({ ...current, [repIndex]: optionIndex }));
    setFeedback({ correct, text: currentQuestion.feedback });
  };
  const finishDrill = () => {
    const evaluation = evaluateTrainingRound(selectedDrill, selectedDrill.questions.map((_, index) => answers[index]));
    const durationSeconds = sessionStartedAt ? Math.max(1, Math.round((Date.now() - sessionStartedAt) / 1000)) : 0;
    const session = {
      id: String(Date.now()),
      drillId: selectedDrill.id,
      drillName: selectedDrill.name,
      skill: selectedDrill.skill,
      correct: evaluation.correct,
      total: evaluation.total,
      accuracy: evaluation.accuracy,
      reps: selectedDrill.questions.length,
      durationSeconds,
      completedAt: new Date().toISOString(),
    };
    const next = [session, ...sessions].slice(0, 100);
    saveSessions(String(playerId), next);
    setSessions(next);
    setResult({ ...evaluation, durationSeconds });
    setStarted(false);
  };
  const nextRep = () => {
    if (!feedback) return;
    if (repIndex + 1 >= selectedDrill.questions.length) {
      finishDrill();
      return;
    }
    setRepIndex(value => value + 1);
    setFeedback(null);
  };

  return (
    <section className="gg-training-centre">
      <header className="gg-training-heading">
        <div>
          <p className="gg-world-eyebrow">GG GROUNDS / PLAYER DEVELOPMENT</p>
          <h2>Training Ground</h2>
          <p>Position-aware football decision drills. One rep at a time, with coaching feedback after each choice.</p>
        </div>
        <div className="gg-training-position">
          <span>PRIMARY POSITION</span>
          <strong>{player?.position || "Not set"}</strong>
        </div>
      </header>

      <div className="gg-training-summary">
        <article><span>SESSIONS</span><strong>{totalSessions}</strong><small>Completed drills</small></article>
        <article><span>REPS COMPLETED</span><strong>{totalAnswers}</strong><small>Recorded decisions</small></article>
        <article><span>AVERAGE ACCURACY</span><strong>{totalAnswers ? averageAccuracy + "%" : "—"}</strong><small>Across saved sessions</small></article>
      </div>

      <div className="gg-training-layout">
        <aside className="gg-training-drill-list">
          <div className="gg-training-section-head"><span>YOUR PROGRAMME</span><small>{drills.length} drills suggested</small></div>
          {drills.map(drill => (
            <button type="button" key={drill.id} className={selectedDrillId === drill.id ? "active" : ""} onClick={() => chooseDrill(drill.id)} disabled={started}>
              <span className="gg-training-drill-mark">◎</span>
              <span><strong>{drill.name}</strong><small>{drill.skill} · {drill.questions.length} reps</small></span>
              <span className="gg-training-chevron">›</span>
            </button>
          ))}
        </aside>

        <section className="gg-training-session">
          <div className="gg-training-session-banner">
            <span className="gg-training-ball" aria-hidden="true">⚽</span>
            <div><p className="gg-world-eyebrow">INDIVIDUAL SESSION / {selectedDrill.skill.toUpperCase()}</p><h3>{selectedDrill.name}</h3><p>{selectedDrill.description}</p></div>
          </div>

          {!started && !result && (
            <div className="gg-training-start">
              <div><strong>Ready for the session?</strong><small>{selectedDrill.questions.length} football situations · one decision per rep · private session record.</small></div>
              <button type="button" className="gg-world-primary" onClick={startDrill}>Start drill ↗</button>
            </div>
          )}

          {started && (
            <div className="gg-training-live">
              <div className="gg-training-live-head"><span>REP {String(repIndex + 1).padStart(2, "0")} / {String(selectedDrill.questions.length).padStart(2, "0")}</span><strong>{Object.keys(answers).length} decisions made</strong></div>
              <div className="gg-training-progress"><span style={{ width: progress + "%" }}/></div>
              <div className="gg-training-pitch" aria-label="Training drill pitch">
                <span className="gg-training-pitch-half"/><span className="gg-training-pitch-circle"/><span className="gg-training-pitch-box gg-training-pitch-box-left"/><span className="gg-training-pitch-box gg-training-pitch-box-right"/>
                <span className="gg-training-player gg-training-player-one">10</span><span className="gg-training-player gg-training-player-two">7</span><span className="gg-training-opponent">×</span><span className="gg-training-pitch-ball">⚽</span>
                <span className="gg-training-pitch-caption">READ THE PICTURE · CHOOSE YOUR NEXT ACTION</span>
              </div>
              <article className="gg-training-rep-card">
                <p className="gg-world-eyebrow">COACH'S SCENARIO · {selectedDrill.skill.toUpperCase()}</p>
                <h4>{currentQuestion.prompt}</h4>
                <div className="gg-training-choice-grid">
                  {currentQuestion.options.map((option, optionIndex) => (
                    <button type="button" key={option} className={chosenAnswer === optionIndex ? (feedback?.correct ? "correct" : "incorrect") : ""} disabled={Boolean(feedback)} onClick={() => chooseAnswer(optionIndex)}>
                      <b>{String.fromCharCode(65 + optionIndex)}</b><span>{option}</span><i>{chosenAnswer === optionIndex ? (feedback?.correct ? "✓" : "×") : "↗"}</i>
                    </button>
                  ))}
                </div>
                {feedback && (
                  <div className={"gg-training-coach-feedback" + (feedback.correct ? " is-correct" : " is-review")} role="status" aria-live="polite">
                    <strong>{feedback.correct ? "Good read. Rep complete." : "Not quite. Take the coaching point."}</strong>
                    <p>{feedback.text}</p>
                    <button type="button" className="gg-world-primary" onClick={nextRep}>{repIndex + 1 === selectedDrill.questions.length ? "Complete session ↗" : "Next rep ↗"}</button>
                  </div>
                )}
              </article>
            </div>
          )}

          {result && (
            <div className="gg-training-result" aria-live="polite">
              <div className="gg-training-result-score"><span>SESSION COMPLETE</span><strong>{result.accuracy}%</strong><small>{result.correct} correct · {result.total} reps · {formatDuration(result.durationSeconds)}</small></div>
              <div className="gg-training-review">
                {selectedDrill.questions.map((question, index) => (
                  <article key={selectedDrill.id + "-review-" + index} data-correct={result.evaluated[index].correct}>
                    <strong>{result.evaluated[index].correct ? "Good decision" : "Review this situation"}</strong>
                    <p>{question.prompt}</p><small>{question.feedback}</small>
                  </article>
                ))}
              </div>
              <button type="button" className="gg-world-secondary" onClick={startDrill}>Repeat this drill ↻</button>
              <button type="button" className="gg-world-secondary" onClick={() => { setResult(null); setAnswers({}); setRepIndex(0); }}>Back to programme</button>
            </div>
          )}
        </section>
      </div>

      <section className="gg-training-history">
        <div className="gg-training-section-head"><span>PRIVATE TRAINING JOURNAL</span><small>{sessions.length} recent sessions</small></div>
        {sessions.length ? sessions.slice(0, 6).map(session => (
          <article key={session.id}><span className="gg-training-history-mark">✓</span><div><strong>{session.drillName}</strong><small>{session.skill} · {new Date(session.completedAt).toLocaleString("en-IN")} · {session.reps} reps · {formatDuration(session.durationSeconds || 0)}</small></div><b>{session.accuracy}%</b></article>
        )) : <p>No sessions recorded yet. Complete a drill and your private journal will begin here.</p>}
      </section>
      <p className="gg-training-privacy">Private by default · Training records are currently stored in this browser on this device. They do not change official GG Matchday ratings, OVR, match records or Club finances.</p>
    </section>
  );
}
