import { useState } from "react";
import { api } from "../../lib/api";
import { refreshLiveTopics } from "../../lib/liveData";
import { clubDateKey, clubInitials, fixtureDateLabel } from "./clubPresentation";

export function ClubCrest({ club, name }) {
  return (
    <span className="clubs-fixture-crest" aria-hidden="true">
      {club?.logoUrl ? <img src={club.logoUrl} alt="" loading="lazy" decoding="async" /> : clubInitials(name)}
    </span>
  );
}

export function FixtureTeams({ fixture, clubs, children }) {
  const home = fixture.clubAId?.name ? fixture.clubAId : clubs.get(String(fixture.clubAId));
  const away = fixture.clubBId?.name ? fixture.clubBId : clubs.get(String(fixture.clubBId));
  const homeName = home?.name || fixture.clubAName || "Club unavailable";
  const awayName = away?.name || fixture.clubBName || "Club unavailable";
  const hasScore = fixture.status === "completed" && fixture.clubAScore != null && fixture.clubBScore != null;
  return (
    <div className="clubs-fixture-teams">
      <div><ClubCrest club={home} name={homeName} /><strong>{homeName}</strong></div>
      <span className="clubs-fixture-score">
        {hasScore ? `${fixture.clubAScore}–${fixture.clubBScore}` : "vs"}
      </span>
      <div><ClubCrest club={away} name={awayName} /><strong>{awayName}</strong></div>
      {children}
    </div>
  );
}

function FixtureRequestForm({ clubs, captainClubs, submitting, onRequest }) {
  const [own, setOwn] = useState("");
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState("");
  const clubId = own || String(captainClubs[0]?._id || "");
  const today = clubDateKey();
  const tomorrow = new Date(today + "T12:00:00+05:30");
  tomorrow.setTime(tomorrow.getTime() + 86_400_000);
  return (
    <form className="clubs-create-form clubs-match-form" onSubmit={async event => {
      event.preventDefault();
      if (await onRequest({ clubAId: clubId, clubBId: opponent, fixtureDate: date })) {
        setOpponent("");
        setDate("");
      }
    }}>
      <div className="clubs-invite-grid">
        <label><span>Your Club</span><select value={clubId} onChange={event => {
          setOwn(event.target.value);
          if (opponent === event.target.value) setOpponent("");
        }}>
          {captainClubs.map(club => <option key={club._id} value={club._id}>{club.name}</option>)}
        </select></label>
        <label><span>Opponent</span><select required value={opponent} onChange={event => setOpponent(event.target.value)}>
          <option value="">Choose a club</option>
          {Array.from(clubs.values()).filter(club => String(club._id) !== clubId)
            .map(club => <option key={club._id} value={club._id}>{club.name}</option>)}
        </select></label>
        <label><span>Fixture date (IST)</span><input type="date" min={clubDateKey(tomorrow)} required value={date} onChange={event => setDate(event.target.value)} /></label>
      </div>
      <button type="submit" className="clubs-primary-button" disabled={submitting || !opponent || !date}>
        {submitting ? "Sending request…" : "Send fixture request"}
      </button>
    </form>
  );
}

function FixtureLineupForm({ fixture, club, players }) {
  const clubId = String(club._id);
  const draft = fixture.lineups?.find(lineup => String(lineup.clubId) === clubId);
  const [selected, setSelected] = useState(() => draft?.playerIds?.map(String) || club.memberIds.map(String));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api(`/clubs/matches/${fixture._id}/lineup`, {
        method: "PUT", body: { clubId, playerIds: selected },
      });
      setMessage({ text: result.confirmed ? "Lineup confirmed." : "Approval recorded. Waiting for your co-captain." });
      refreshLiveTopics(["clubs"]);
    } catch (error) {
      setMessage({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="clubs-fixture-lineup" onSubmit={save}>
      <fieldset disabled={busy}>
        <legend>{club.name} lineup</legend>
        <p className="clubs-workspace-muted">Choose 2–6 eligible players. Co-captains confirm the same selection.</p>
        {club.memberIds.map(id => {
          const key = String(id);
          return <label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={event => {
            setSelected(event.target.checked ? [...selected, key] : selected.filter(item => item !== key));
          }} />{players.find(player => String(player._id) === key)?.name || "Club player"}</label>;
        })}
      </fieldset>
      {message && <p role={message.error ? "alert" : "status"}>{message.text}</p>}
      <button className="clubs-primary-button" disabled={busy || selected.length < 2 || selected.length > 6} type="submit">
        {busy ? "Saving lineup…" : "Confirm lineup"}
      </button>
    </form>
  );
}

export default function ClubFixtures({
  clubs, fixtures, currentClub, captainClubs, playerId, players, requests, notice, busyId, loading, submitting,
  onRequest, onRespond, onCancel, onBetting,
}) {
  const [view, setView] = useState(currentClub ? "mine" : "upcoming");
  const [showForm, setShowForm] = useState(false);
  const [lineupId, setLineupId] = useState("");
  const captainIds = new Set(captainClubs.map(club => String(club._id)));
  const activeRequests = requests.filter(request =>
    captainIds.has(String(request.clubBId)) || captainIds.has(String(request.requestedByClubId)),
  );
  const currentClubId = String(currentClub?._id || "");
  const activeView = view === "mine" && !currentClub ? "upcoming" : view;
  const today = clubDateKey();
  const filtered = fixtures.filter(match => {
    if (activeView === "results") return match.status === "completed";
    if (match.status !== "accepted" || (match.fixtureDate || clubDateKey(match.scheduledAt)) < today) return false;
    return activeView !== "mine" || [match.clubAId, match.clubBId].some(id => String(id) === currentClubId);
  }).sort((a, b) => (activeView === "results" ? -1 : 1) * (new Date(a.scheduledAt) - new Date(b.scheduledAt)));

  return (
    <section id="clubs-match-center" className="clubs-section clubs-fixtures-view">
      <div className="clubs-workspace-heading">
        <div><h2>Schedule &amp; fixtures</h2><p>Confirmed fixtures and Club results.</p></div>
        {captainIds.size > 0 && (
          <button className="clubs-primary-button" type="button" aria-expanded={showForm} aria-controls="clubs-fixture-composer"
            onClick={() => setShowForm(open => !open)}>{showForm ? "Close form" : "Request fixture"}</button>
        )}
      </div>
      {showForm && captainIds.size > 0 && (
        <div id="clubs-fixture-composer" className="clubs-workspace-card">
          <h3>Request a Club fixture</h3>
          <FixtureRequestForm clubs={clubs} captainClubs={captainClubs} submitting={submitting} onRequest={onRequest} />
        </div>
      )}
      {activeRequests.length > 0 && (
        <section className="clubs-fixture-requests" aria-label="Captain fixture requests">
          <h3>Fixture requests</h3>
          {activeRequests.map(match => {
            const incoming = captainIds.has(String(match.clubBId));
            const responded = match.captainResponses?.some(response => String(response.captainId) === playerId);
            return (
              <article className="clubs-workspace-card clubs-fixture-card" key={match._id}>
                <p className="clubs-fixture-meta"><span>{incoming ? "Incoming" : "Sent"}</span><time>{fixtureDateLabel(match)}</time></p>
                <FixtureTeams fixture={match} clubs={clubs} />
                <div className="clubs-fixture-actions">
                  {incoming && responded && <span>Response recorded · awaiting co-captain</span>}
                  {incoming && !responded && <>
                    <button type="button" className="clubs-primary-button" disabled={busyId === match._id} onClick={() => onRespond(match._id, true)}>Accept</button>
                    <button type="button" className="clubs-secondary-button" disabled={busyId === match._id} onClick={() => onRespond(match._id, false)}>Decline</button>
                  </>}
                  {captainIds.has(String(match.requestedByClubId)) && (
                    <button type="button" className="clubs-secondary-button" disabled={busyId === match._id} onClick={() => onCancel(match._id)}>Cancel request</button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
      {notice && <p className="clubs-workspace-notice" role="status">{notice}</p>}
      <div className="clubs-view-filters" aria-label="Filter fixtures">
        {[[currentClub ? "My fixtures" : null, "mine"], ["All fixtures", "upcoming"], ["Results", "results"]]
          .filter(([label]) => label).map(([label, key]) => (
            <button key={key} type="button" aria-pressed={activeView === key} onClick={() => setView(key)}>{label}</button>
          ))}
      </div>
      <div className="clubs-fixture-grid">
        {filtered.map(match => {
          const captainClub = captainClubs.find(club => [match.clubAId, match.clubBId].some(id => String(id) === String(club._id)));
          const canSetLineup = captainClub && match.status === "accepted" && (match.fixtureDate || clubDateKey(match.scheduledAt)) > today;
          return (
          <article className="clubs-workspace-card clubs-fixture-card" key={match._id}>
            <p className="clubs-fixture-meta"><span>{match.status === "completed" ? "Final" : "Confirmed"}</span><time>{fixtureDateLabel(match)}</time></p>
            <FixtureTeams fixture={match} clubs={clubs} />
            {canSetLineup && <button type="button" className="clubs-secondary-button"
              aria-expanded={lineupId === match._id}
              onClick={() => setLineupId(lineupId === match._id ? "" : match._id)}>Set fixture lineup</button>}
            {canSetLineup && lineupId === match._id && <FixtureLineupForm fixture={match} club={captainClub} players={players} />}
            {match.status === "accepted" && captainIds.has(String(match.requestedByClubId)) && (
              <div className="clubs-fixture-actions">
                <button type="button" className="clubs-secondary-button" disabled={busyId === match._id} onClick={() => onCancel(match._id)}>Cancel fixture</button>
              </div>
            )}
          </article>
          );
        })}
        {filtered.length === 0 && <div className="clubs-empty clubs-workspace-empty" role={loading ? "status" : undefined}>
          <strong>{loading ? "Loading fixtures…" : activeView === "results" ? "No results yet" : "No confirmed fixtures yet"}</strong>
        </div>}
      </div>
      {onBetting && activeView !== "results" && filtered.length > 0 && (
        <button className="clubs-secondary-button clubs-fixture-betting-link" type="button" onClick={onBetting}>Open Betting</button>
      )}
    </section>
  );
}
