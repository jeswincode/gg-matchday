import { RATING_INPUT } from '../ratings';

export default function MatchRecordForm({
  onSubmit,
  date,
  setDate,
  matchName,
  setMatchName,
  teamALabel,
  setTeamALabel,
  teamBLabel,
  setTeamBLabel,
  teamAScore,
  teamBScore,
  players,
  teams,
  setPlayerTeam,
  goals,
  setGoals,
  assists,
  setAssists,
  ownGoals,
  setOwnGoals,
  ratings,
  setRatings,
  legacyUnrated,
  defensivePerformances,
  setDefensivePerformances,
  legacyDefensiveUnrated,
  assignedPlayers,
  totalGoals,
  totalAssists,
  savingMatch,
  editingMatchId,
  resetMatchForm,
  changeCount,
}) {
  return (
    <section className="card">
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <label>
            Date
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label>
            Match name
            <input value={matchName} maxLength={160} onChange={e => setMatchName(e.target.value)} placeholder="Sunday Football" />
          </label>
        </div>

        <div className="match-score-header">
          <div className="side-block">
            <span>Side 1</span>
            <input value={teamALabel} maxLength={80} onChange={e => setTeamALabel(e.target.value)} />
            <strong key={teamAScore}>{teamAScore}</strong>
          </div>
          <span className="versus">:</span>
          <div className="side-block">
            <span>Side 2</span>
            <input value={teamBLabel} maxLength={80} onChange={e => setTeamBLabel(e.target.value)} />
            <strong key={teamBScore}>{teamBScore}</strong>
          </div>
        </div>

        <div className="subsection">
          <div className="section-heading">
            <h3>Player performances</h3>
            <span className="muted">{assignedPlayers.length} participating</span>
          </div>

          <div className="gg-performance-head">
            <span>Player</span>
            <span>Side</span>
            <span>Goals</span>
            <span>Assists</span>
            <span>Own Goal</span>
            <span>Rating</span>
            <span>Defensive</span>
          </div>

          {players.map(player => {
            const id = String(player._id);
            const assigned = Boolean(teams[id]);

            return (
              <div className={`gg-performance-row ${assigned ? 'assigned' : ''}`} key={id}>
                <div>
                  <strong>{player.name}</strong>
                  <small>
                    {teams[id] === 'A'
                      ? teamALabel
                      : teams[id] === 'B'
                        ? teamBLabel
                        : 'Not participating'}
                  </small>
                </div>

                <div className="team-switch">
                  {['A', 'B'].map((team, i) => (
                    <button
                      key={team}
                      type="button"
                      aria-label={`${player.name} Side ${i + 1}`}
                      aria-pressed={teams[id] === team}
                      className={teams[id] === team ? 'active' : ''}
                      onClick={() => setPlayerTeam(id, team)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                {[
                  [goals, setGoals, 'Goals'],
                  [assists, setAssists, 'Assists'],
                  [ownGoals, setOwnGoals, 'Own Goal'],
                ].map(([values, setter, label]) => (
                  <div className="counter" key={label}>
                    <button
                      type="button"
                      disabled={!assigned || !values[id]}
                      aria-label={`Remove ${label.toLowerCase()} for ${player.name}`}
                      onClick={() => changeCount(setter, id, -1)}
                    >
                      −
                    </button>
                    <strong key={values[id]}>{assigned ? values[id] || 0 : 0}</strong>
                    <button
                      type="button"
                      disabled={!assigned}
                      aria-label={`Add ${label.toLowerCase()} for ${player.name}`}
                      onClick={() => changeCount(setter, id, 1)}
                    >
                      +
                    </button>
                  </div>
                ))}

                <label className="gg-rating-input">
                  <span className="sr-only">Rating for {player.name}</span>
                  <input
                    type="number"
                    min={RATING_INPUT.min}
                    max={RATING_INPUT.max}
                    step={RATING_INPUT.step}
                    placeholder={legacyUnrated.includes(id) ? 'Unrated' : '0–10'}
                    disabled={!assigned}
                    required={assigned && !legacyUnrated.includes(id)}
                    value={ratings[id] ?? ''}
                    onChange={e => setRatings(old => ({...old, [id]: e.target.value}))}
                  />
                </label>

                <label className="gg-defense-input">
                  <span className="sr-only">Defensive performance for {player.name}</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    placeholder={legacyDefensiveUnrated.includes(id) ? 'Not recorded' : '0–10'}
                    disabled={!assigned}
                    required={assigned && !legacyDefensiveUnrated.includes(id)}
                    value={defensivePerformances[id] ?? ''}
                    onChange={e => setDefensivePerformances(old => ({...old, [id]: e.target.value}))}
                  />
                </label>
              </div>
            );
          })}
        </div>

        <div className="match-total">
          <span>{totalGoals} goals</span>
          <span>{totalAssists} assists</span>
        </div>

        <button type="submit" className="save-button" disabled={savingMatch}>
          {savingMatch ? 'Saving…' : editingMatchId ? 'Update Match' : 'Save Match'}
        </button>

        {editingMatchId && (
          <button type="button" className="secondary-button" onClick={resetMatchForm}>
            Cancel edit
          </button>
        )}
      </form>
    </section>
  );
}
