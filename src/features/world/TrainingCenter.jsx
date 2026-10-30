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

export default function TrainingCenter({ player = null, playerId = "guest" }) {
  const drills = useMemo(() => drillsForPosition(player?.position), [player?.position]);
  const [sessions, setSessions] = useState(() => readSessions(String(playerId)));
  const [selectedDrillId, setSelectedDrillId] = useState(drills[0]?.id || "scan-release");
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [started, setStarted] = useState(false);
  const selectedDrill = drills.find(drill => drill.id === selectedDrillId) || drills[0];
  const totalSessions = sessions.length;
  const totalAnswers = sessions.reduce((sum, session) => sum + Number(session.total || 0), 0);
  const totalCorrect = sessions.reduce((sum, session) => sum + Number(session.correct || 0), 0);
  const averageAccuracy = totalAnswers ? Math.round(totalCorrect / totalAnswers * 100) : 0;

  const chooseDrill = id => {
    setSelectedDrillId(id);
    setStarted(false);
    setAnswers({});
    setResult(null);
  };
  const startDrill = () => {
    setAnswers({});
    setResult(null);
    setStarted(true);
  };
  const submitDrill = () => {
    const evaluation = evaluateTrainingRound(selectedDrill, selectedDrill.questions.map((_, index) => answers[index]));
    const session = {
      id: String(Date.now()),
      drillId: selectedDrill.id,
      drillName: selectedDrill.name,
      skill: selectedDrill.skill,
      correct: evaluation.correct,
      total: evaluation.total,
      accuracy: evaluation.accuracy,
      reps: selectedDrill.questions.length,
      completedAt: new Date().toISOString(),
    };
    const next = [session, ...sessions].slice(0, 100);
    saveSessions(String(playerId), next);
    setSessions(next);
    setResult(evaluation);
    setStarted(false);
  };

  return (
    <section className="gg-training-centre">
      <header className="gg-training-heading">
        <div>
          <p className="gg-world-eyebrow">GG GROUNDS / PLAYER DEVELOPMENT</p>
          <h2>Training Ground</h2>
          <p>Build football understanding with repeatable, position-aware practice.</p>
        </div>
        <div className="gg-training-position">
          <span>PRIMARY POSITION</span>
          <strong>{player?.position || "Not set"}</strong>
        </div>
      </header>

      <div className="gg-training-summary">
        <article><span>SESSIONS</span><strong>{totalSessions}</strong><small>Completed drills</small></article>
        <article><span>QUESTIONS ANSWERED</span><strong>{totalAnswers}</strong><small>Recorded practice reps</small></article>
        <article><span>SESSION ACCURACY</span><strong>{totalAnswers ? averageAccuracy + "%" : "—"}</strong><small>Across saved sessions</small></article>
      </div>

      <div className="gg-training-layout">
        <aside className="gg-training-drill-list">
          <div className="gg-training-section-head"><span>YOUR PROGRAMME</span><small>{drills.length} drills suggested</small></div>
          {drills.map(drill => (
            <button type="button" key={drill.id} className={selectedDrillId === drill.id ? "active" : ""} onClick={() => chooseDrill(drill.id)}>
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
              <div><strong>Ready for the session?</strong><small>{selectedDrill.questions.length} football situations · coaching feedback after every answer.</small></div>
              <button type="button" className="gg-world-primary" onClick={startDrill}>Start drill ↗</button>
            </div>
          )}

          {started && (
            <div className="gg-training-questions">
              {selectedDrill.questions.map((question, index) => (
                <fieldset key={selectedDrill.id + "-" + index} className="gg-training-question">
                  <legend><span>REP {String(index + 1).padStart(2, "0")}</span>{question.prompt}</legend>
                  <div>
                    {question.options.map((option, optionIndex) => (
                      <button type="button" key={option} className={answers[index] === optionIndex ? "selected" : ""} aria-pressed={answers[index] === optionIndex} onClick={() => setAnswers(current => ({ ...current, [index]: optionIndex }))}>
                        <b>{String.fromCharCode(65 + optionIndex)}</b>{option}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
              <button type="button" className="gg-world-primary" disabled={Object.keys(answers).length !== selectedDrill.questions.length} onClick={submitDrill}>Finish session & review ↗</button>
            </div>
          )}

          {result && (
            <div className="gg-training-result" aria-live="polite">
              <div className="gg-training-result-score"><span>SESSION COMPLETE</span><strong>{result.accuracy}%</strong><small>{result.correct} correct · {result.total} reps</small></div>
              <div className="gg-training-review">
                {selectedDrill.questions.map((question, index) => (
                  <article key={selectedDrill.id + "-review-" + index} data-correct={result.evaluated[index].correct}>
                    <strong>{result.evaluated[index].correct ? "Good decision" : "Review this situation"}</strong>
                    <p>{question.prompt}</p><small>{question.feedback}</small>
                  </article>
                ))}
              </div>
              <button type="button" className="gg-world-secondary" onClick={startDrill}>Repeat this drill ↻</button>
            </div>
          )}
        </section>
      </div>

      <section className="gg-training-history">
        <div className="gg-training-section-head"><span>PRIVATE TRAINING JOURNAL</span><small>{sessions.length} recent sessions</small></div>
        {sessions.length ? sessions.slice(0, 6).map(session => (
          <article key={session.id}><span className="gg-training-history-mark">✓</span><div><strong>{session.drillName}</strong><small>{session.skill} · {new Date(session.completedAt).toLocaleString("en-IN")}</small></div><b>{session.accuracy}%</b></article>
        )) : <p>No sessions recorded yet. Complete a drill and your private journal will begin here.</p>}
      </section>
      <p className="gg-training-privacy">Private by default · Training records are currently stored in this browser on this device. They do not change official GG Matchday ratings, OVR, match records or Club finances.</p>
    </section>
  );
}
