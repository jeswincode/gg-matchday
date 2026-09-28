import { calculateMatchRatings, PERFORMANCE_CODE_CATEGORIES } from '../ratings/matchCalculator';

function PointsLine({ items }) {
  return (
    <div className="gg-rating-breakdown">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {item.label}: {item.points >= 0 ? '+' : ''}{item.points.toFixed(2)}
        </span>
      ))}
    </div>
  );
}

function PerformancePicker({ value = [], onChange, disabled }) {
  const selected = new Set(value);
  function toggle(code, category) {
    const categoryCodes = PERFORMANCE_CODE_CATEGORIES.find(item => item.key === category)?.codes || [];
    const withoutCategory = [...selected].filter(existing => !categoryCodes.some(item => item.code === existing));
    const next = selected.has(code) ? withoutCategory : [...withoutCategory, code];
    onChange(next);
  }

  return (
    <div className="gg-code-picker">
      {PERFORMANCE_CODE_CATEGORIES.map(category => (
        <div className="gg-code-category" key={category.key}>
          <span>{category.label}</span>
          <div>
            {category.codes.map(code => (
              <button
                type="button"
                key={code.code}
                disabled={disabled}
                aria-pressed={selected.has(code.code)}
                className={selected.has(code.code) ? 'active' : ''}
                onClick={() => toggle(code.code, category.key)}
              >
                {code.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MatchRecordForm({
  onSubmit, date, setDate, matchName, setMatchName, teamALabel, setTeamALabel, teamBLabel, setTeamBLabel,
  teamAScore, teamBScore, players, teams, setPlayerTeam, goals, setGoals, assists, setAssists, ownGoals, setOwnGoals,
  performanceCodes, setPerformanceCodes, assignedPlayers, totalGoals, totalAssists,
  savingMatch, editingMatchId, resetMatchForm, changeCount,
}) {
  const teamACount = assignedPlayers.filter(player => teams[String(player._id)] === 'A').length;
  const teamBCount = assignedPlayers.filter(player => teams[String(player._id)] === 'B').length;

  return (
    <section className="card">
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <label>Date<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
          <label>Match name<input value={matchName} maxLength={160} onChange={e => setMatchName(e.target.value)} placeholder="Sunday Football" /></label>
        </div>

        <div className="match-score-header">
          <div className="side-block"><span>Side 1</span><input value={teamALabel} maxLength={80} onChange={e => setTeamALabel(e.target.value)} /><strong>{teamAScore}</strong></div>
          <span className="versus">:</span>
          <div className="side-block"><span>Side 2</span><input value={teamBLabel} maxLength={80} onChange={e => setTeamBLabel(e.target.value)} /><strong>{teamBScore}</strong></div>
        </div>



        <div className="subsection">
          <div className="section-heading">
            <h3>Player performances</h3>
            <span className="muted">{assignedPlayers.length} participating</span>
          </div>

          <div className="gg-performance-head">
            <span>Player</span><span>Side</span><span>Goals</span><span>Assists</span><span>Own Goal</span><span>Performance codes</span><span>Ratings</span>
          </div>

          {players.map(player => {
            const id = String(player._id);
            const assigned = Boolean(teams[id]);
            const codes = performanceCodes[id];
            const legacy = editingMatchId && codes === undefined;
            const calculated = !legacy && assigned ? calculateMatchRatings({
              team: teams[id], teamACount, teamBCount, teamAScore, teamBScore,
              goals: goals[id] || 0, assists: assists[id] || 0, ownGoals: ownGoals[id] || 0, performanceCodes: codes || [],
            }) : null;

            return (
              <div className={`gg-performance-row ${assigned ? 'assigned' : ''}`} key={id}>
                <div><strong>{player.name}</strong><small>{teams[id] === 'A' ? teamALabel : teams[id] === 'B' ? teamBLabel : 'Not participating'}</small></div>
                <div className="team-switch">{['A','B'].map((team,i)=><button key={team} type="button" aria-label={`${player.name} Side ${i+1}`} aria-pressed={teams[id]===team} className={teams[id]===team?'active':''} onClick={()=>setPlayerTeam(id,team)}>{i+1}</button>)}</div>
                {[[goals,setGoals,'Goals'],[assists,setAssists,'Assists'],[ownGoals,setOwnGoals,'Own Goal']].map(([values,setter,label])=>(
                  <div className="counter" key={label}>
                    <button type="button" disabled={!assigned || !values[id]} aria-label={`Remove ${label.toLowerCase()} for ${player.name}`} onClick={()=>changeCount(setter,id,-1)}>−</button>
                    <strong>{assigned ? values[id] || 0 : 0}</strong>
                    <button type="button" disabled={!assigned} aria-label={`Add ${label.toLowerCase()} for ${player.name}`} onClick={()=>changeCount(setter,id,1)}>+</button>
                  </div>
                ))}
                <div className="gg-code-cell">
                  <PerformancePicker
                    value={codes || []}
                    disabled={!assigned}
                    onChange={next => setPerformanceCodes(old => ({ ...old, [id]: next }))}
                  />
                  {calculated && (
                    <div className="gg-calculated-ratings">
                      <strong>🛡️ {calculated.defensiveRating.toFixed(1)}</strong>
                      <strong>⭐ {calculated.matchRating.toFixed(1)}</strong>
                      <small>{calculated.resultContext} · {calculated.result}</small>
                      <PointsLine items={calculated.matchBreakdown} />
                      <PointsLine items={calculated.defensiveBreakdown} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="match-total"><span>{totalGoals} goals</span><span>{totalAssists} assists</span></div>
        <button type="submit" className="save-button" disabled={savingMatch}>{savingMatch ? 'Saving…' : editingMatchId ? 'Update Match' : 'Save Match'}</button>
        {editingMatchId && <button type="button" className="secondary-button" onClick={resetMatchForm}>Cancel edit</button>}
      </form>
    </section>
  );
}
