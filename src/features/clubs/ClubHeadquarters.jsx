import "./club-headquarters.css";

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const shortName = value => String(value || "GG Club").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "GG";

function stadiumTier(fixtures) {
  if (fixtures >= 30) return { level: 4, name: "Arena", description: "A proven home ground with a long fixture history." };
  if (fixtures >= 15) return { level: 3, name: "Stadium", description: "The stands have grown with every completed fixture." };
  if (fixtures >= 5) return { level: 2, name: "Ground", description: "Your Club is building a home-ground identity." };
  return { level: 1, name: "Training Ground", description: "The first chapter of your home ground starts here." };
}

function trainingTier(ovr) {
  if (ovr >= 85) return { level: 4, name: "Elite Centre", description: "The squad's current OVR has reached the elite band." };
  if (ovr >= 75) return { level: 3, name: "Performance Centre", description: "Your squad is developing into a strong unit." };
  if (ovr >= 65) return { level: 2, name: "Training Centre", description: "Recorded player performances are shaping the facility." };
  return { level: 1, name: "Training Base", description: "Build a larger Matchday sample to develop the facility." };
}

function Facility({ icon, label, tier, progress, note }) {
  return (
    <article className="club-hq-facility">
      <div className="club-hq-facility-head"><span className="club-hq-facility-icon">{icon}</span><span className="club-hq-level">LEVEL {tier.level}</span></div>
      <p>{label}</p>
      <strong>{tier.name}</strong>
      <small>{tier.description}</small>
      <div className="club-hq-facility-track"><span style={{ width: Math.max(8, Math.min(100, progress)) + "%" }} /></div>
      <em>{note}</em>
    </article>
  );
}

export default function ClubHeadquarters({ club, completedMatches = [], nextMatch, clubOvr, history = [] }) {
  const clubId = String(club?._id || "");
  const record = completedMatches.reduce((totals, match) => {
    const isSideA = String(match.clubAId || "") === clubId;
    const clubScore = number(isSideA ? match.clubAScore : match.clubBScore);
    const opponentScore = number(isSideA ? match.clubBScore : match.clubAScore);
    if (clubScore === opponentScore) totals.draws += 1;
    else if (clubScore > opponentScore) totals.wins += 1;
    else totals.losses += 1;
    return totals;
  }, { wins: 0, draws: 0, losses: 0 });
  const played = completedMatches.length;
  const ground = stadiumTier(played);
  const training = trainingTier(number(clubOvr));
  const memberCount = club?.memberIds?.length || 0;
  const hasFullSquad = memberCount >= 5;
  const academy = {
    level: hasFullSquad ? 3 : memberCount >= 4 ? 2 : 1,
    name: hasFullSquad ? "Full Squad Academy" : memberCount >= 4 ? "Academy Ready" : "Recruitment in progress",
    description: hasFullSquad ? "All five squad places are occupied." : "A complete four-to-five player squad unlocks the next stage.",
  };
  const honours = [...completedMatches].sort((a, b) => new Date(b.scheduledAt || b.fixtureDate || 0) - new Date(a.scheduledAt || a.fixtureDate || 0)).slice(0, 5);
  const groundProgress = played >= 30 ? 100 : played >= 15 ? Math.round((played - 15) / 15 * 100) : played >= 5 ? Math.round((played - 5) / 10 * 100) : Math.round(played / 5 * 100);
  const trainingProgress = clubOvr >= 85 ? 100 : clubOvr >= 75 ? Math.round((clubOvr - 75) / 10 * 100) : clubOvr >= 65 ? Math.round((clubOvr - 65) / 10 * 100) : Math.max(5, Math.round(number(clubOvr) / 65 * 100));
  const academyProgress = hasFullSquad ? 100 : memberCount >= 4 ? 80 : Math.round(memberCount / 4 * 80);

  return (
    <section className="club-hq" aria-label="Ultimate Club headquarters">
      <div className="club-hq-title-row">
        <div><p className="clubs-eyebrow">ULTIMATE CLUBS / HOME GROUND</p><h3>Club Headquarters</h3><p>One place for your Club identity, match legacy and development.</p></div>
        <span className="club-hq-official">OFFICIAL CLUB</span>
      </div>

      <div className="club-hq-hero">
        <div className="club-hq-hero-copy">
          <span className="club-hq-label">YOUR HOME</span>
          <div className="club-hq-crest">{shortName(club?.name)}</div>
          <h4>{club?.name || "Your Club"}</h4>
          <p>{club?.description || "A team identity built by the players who represent it."}</p>
          <div className="club-hq-meta"><span>{memberCount}/5 PLAYERS</span><span>{club?.captainIds?.length || 0} CAPTAIN(S)</span><span>{played} COMPLETED FIXTURES</span></div>
        </div>
        <div className="club-hq-stadium" aria-label="Illustrated Club home stadium">
          <div className="club-hq-stadium-roof" />
          <div className="club-hq-stands club-hq-stands-top"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
          <div className="club-hq-pitch">
            <span className="club-hq-pitch-line" />
            <span className="club-hq-pitch-circle" />
            <span className="club-hq-pitch-box club-hq-pitch-box-left" />
            <span className="club-hq-pitch-box club-hq-pitch-box-right" />
            <span className="club-hq-pitch-mark" />
          </div>
          <div className="club-hq-stands club-hq-stands-bottom"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
          <div className="club-hq-stadium-name"><strong>{ground.name.toUpperCase()}</strong><small>LEVEL {ground.level} · {played} FIXTURES</small></div>
        </div>
      </div>

      <div className="club-hq-record">
        <div><span>CLUB MATCH RECORD</span><strong>{record.wins}<i>W</i> {record.draws}<i>D</i> {record.losses}<i>L</i></strong></div>
        <div><span>TEAM OVR</span><strong>{clubOvr ?? "—"}</strong><small>{clubOvr == null ? "Waiting for complete player samples" : "Derived from member OVR"}</small></div>
        <div><span>CLUB APPEARANCES</span><strong>{played}</strong><small>Completed synced fixtures</small></div>
        <div><span>NEXT FIXTURE</span><strong>{nextMatch ? (nextMatch.clubAName || "Club A") + " vs " + (nextMatch.clubBName || "Club B") : "—"}</strong><small>{nextMatch?.fixtureDate || (nextMatch?.scheduledAt ? new Date(nextMatch.scheduledAt).toLocaleDateString("en-IN") : "No accepted fixture")}</small></div>
      </div>

      <div className="club-hq-section-heading"><div><p className="clubs-eyebrow">DEVELOPMENT WING</p><h4>Facilities evolve with your Club</h4></div><span>Read-only progression · no wallet spending</span></div>
      <div className="club-hq-facilities">
        <Facility icon="⌂" label="Home Ground" tier={ground} progress={groundProgress} note={played + " / " + (ground.level === 1 ? 5 : ground.level === 2 ? 15 : ground.level === 3 ? 30 : 30) + " fixtures"}/>
        <Facility icon="⚒" label="Training Centre" tier={training} progress={trainingProgress} note={clubOvr == null ? "OVR sample unavailable" : "Current squad OVR " + clubOvr}/>
        <Facility icon="♙" label="Academy" tier={academy} progress={academyProgress} note={memberCount + " / 5 active members"}/>
        <article className="club-hq-facility club-hq-honours">
          <div className="club-hq-facility-head"><span className="club-hq-facility-icon">★</span><span className="club-hq-level">LIVE RECORD</span></div>
          <p>Honours Hall</p><strong>{record.wins} wins</strong><small>Club Match victories recorded from completed synced fixtures.</small>
          <div className="club-hq-honours-trophies" aria-label={record.wins + " club match wins"}>{Array.from({ length: Math.min(8, record.wins) }, (_, index) => <span key={index}>★</span>)}{record.wins === 0 && <span className="club-hq-empty-honour">Your first win is waiting</span>}</div>
          <em>{record.wins} / 10 victories toward the next visual honour tier</em>
        </article>
      </div>

      <div className="club-hq-history-grid">
        <section className="club-hq-history-card">
          <div className="club-hq-section-heading"><div><p className="clubs-eyebrow">MATCH ARCHIVE</p><h4>Recent Club fixtures</h4></div><span>{honours.length} shown</span></div>
          {honours.length ? honours.map(match => {
            const isSideA = String(match.clubAId || "") === clubId;
            const clubScore = number(isSideA ? match.clubAScore : match.clubBScore);
            const opponentScore = number(isSideA ? match.clubBScore : match.clubAScore);
            const draw = clubScore === opponentScore;
            const won = clubScore > opponentScore;
            return <div className="club-hq-fixture" key={String(match._id)}><span className={"club-hq-fixture-result " + (draw ? "draw" : won ? "win" : "loss")}>{draw ? "D" : won ? "W" : "L"}</span><div><strong>{match.clubAName || "Club A"} vs {match.clubBName || "Club B"}</strong><small>{match.fixtureDate || "Completed fixture"} · {match.status}</small></div><b>{match.clubAScore ?? "—"} - {match.clubBScore ?? "—"}</b></div>;
          }) : <div className="club-hq-empty">Completed and synchronised Club fixtures will build your history here.</div>}
        </section>
        <section className="club-hq-history-card club-hq-timeline">
          <div className="club-hq-section-heading"><div><p className="clubs-eyebrow">CLUB CHRONICLE</p><h4>Recent milestones</h4></div><span>{history.length} events</span></div>
          {history.length ? history.slice(0, 5).map((event, index) => <div className="club-hq-event" key={String(event._id || index)}><span>✦</span><div><strong>{event.description || event.eventType || "Club milestone"}</strong><small>{event.occurredAt ? new Date(event.occurredAt).toLocaleDateString("en-IN") : "Club history"}</small></div></div>) : <div className="club-hq-empty">Official Club milestones will appear here as the Club history grows.</div>}
        </section>
      </div>
      <p className="club-hq-footnote">Facility tiers are visual summaries derived from completed, synchronised Club matches, current squad size and available member OVR. They do not create credits, alter bids, affect rewards or change the Club Wallet.</p>
    </section>
  );
}
