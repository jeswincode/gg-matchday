import "./club-headquarters.css";
import { getClubFacilityProgress, summarizeClubRecord } from "./club-progression.js";

const shortName = value => String(value || "GG Club").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "GG";
const formatEventType = value => String(value || "Club milestone").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());

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

export default function ClubHeadquarters({ club, clubs = [], completedMatches = [], nextMatch, clubOvr, trainingSessions = [], history = [] }) {
  const clubId = String(club?._id || "");
  const record = summarizeClubRecord(clubId, completedMatches);
  const played = completedMatches.length;
  const memberCount = club?.memberIds?.length || 0;
  const completedTrainingSessions = trainingSessions.filter(session => session.status === "completed");
  const teamTrainingAttendance = completedTrainingSessions.reduce((total, session) => total + (session.attendees || []).filter(attendee => attendee.attendance === "present").length, 0);
  const facilities = getClubFacilityProgress({ fixtures: played, completedTrainingSessions: completedTrainingSessions.length, memberCount });
  const { ground, groundProgress, training, trainingProgress, academy, academyProgress } = facilities;
  const getClubName = (id, fallback) => clubs.find(item => String(item._id) === String(id))?.name || fallback;
  const honours = [...completedMatches].sort((a, b) => new Date(b.scheduledAt || b.fixtureDate || 0) - new Date(a.scheduledAt || a.fixtureDate || 0)).slice(0, 5);

  return (
    <section className="club-hq" aria-label="Ultimate Club headquarters">
      <div className="club-hq-title-row">
        <div><p className="clubs-eyebrow">ULTIMATE CLUBS / HOME GROUND</p><h3>Club Headquarters</h3><p>One place for your Club identity, match legacy and development.</p></div>
        <span className="club-hq-official">OFFICIAL CLUB</span>
      </div>

      <div className="club-hq-hero">
        <div className="club-hq-hero-copy">
          <span className="club-hq-label">YOUR HOME</span>
          <div className="club-hq-crest">{club?.logoUrl ? <img src={club.logoUrl} alt={club.name + " crest"} /> : shortName(club?.name)}</div>
          <p className="club-hq-club-name">{club?.name || "Your Club"}</p>
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
        <div><span>NEXT FIXTURE</span><strong>{nextMatch ? (nextMatch.clubAName || getClubName(nextMatch.clubAId, "Club A")) + " vs " + (nextMatch.clubBName || getClubName(nextMatch.clubBId, "Club B")) : "—"}</strong><small>{nextMatch?.status === "requested" ? "Awaiting captain approval · " : ""}{nextMatch?.fixtureDate || (nextMatch?.scheduledAt ? new Date(nextMatch.scheduledAt).toLocaleDateString("en-IN") : "No accepted fixture")}</small></div>
      </div>

      <div className="club-hq-section-heading"><div><p className="clubs-eyebrow">DEVELOPMENT WING</p><h4>Facilities evolve with your Club</h4></div><span>Read-only progression · no wallet spending</span></div>
      <div className="club-hq-facilities">
        <Facility icon="⌂" label="Home Ground" tier={ground} progress={groundProgress} note={played + " / " + (ground.level === 1 ? 5 : ground.level === 2 ? 15 : ground.level === 3 ? 30 : 30) + " fixtures"}/>
        <Facility icon="⚒" label="Training Centre" tier={training} progress={trainingProgress} note={completedTrainingSessions.length + " completed team sessions · " + teamTrainingAttendance + " recorded attendances"}/>
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
            const hasScore = match.clubAScore !== null && match.clubAScore !== undefined && match.clubBScore !== null && match.clubBScore !== undefined;
            const clubScore = Number(isSideA ? match.clubAScore : match.clubBScore);
            const opponentScore = Number(isSideA ? match.clubBScore : match.clubAScore);
            const draw = hasScore && clubScore === opponentScore;
            const won = hasScore && clubScore > opponentScore;
            const resultLabel = !hasScore ? "—" : draw ? "D" : won ? "W" : "L";
            return <div className="club-hq-fixture" key={String(match._id)}><span className={"club-hq-fixture-result " + (!hasScore ? "draw" : draw ? "draw" : won ? "win" : "loss")}>{resultLabel}</span><div><strong>{match.clubAName || getClubName(match.clubAId, "Club A")} vs {match.clubBName || getClubName(match.clubBId, "Club B")}</strong><small>{match.fixtureDate || "Completed fixture"} · {match.status}</small></div><b>{match.clubAScore ?? "—"} - {match.clubBScore ?? "—"}</b></div>;
          }) : <div className="club-hq-empty">Completed and synchronised Club fixtures will build your history here.</div>}
        </section>
        <section className="club-hq-history-card club-hq-timeline">
          <div className="club-hq-section-heading"><div><p className="clubs-eyebrow">CLUB CHRONICLE</p><h4>Recent milestones</h4></div><span>{history.length} events</span></div>
          {history.length ? history.slice(0, 5).map((event, index) => <div className="club-hq-event" key={String(event._id || index)}><span>✦</span><div><strong>{event.description || formatEventType(event.eventType)}</strong><small>{event.occurredAt ? new Date(event.occurredAt).toLocaleDateString("en-IN") : "Club history"}</small></div></div>) : <div className="club-hq-empty">Official Club milestones will appear here as the Club history grows.</div>}
        </section>
      </div>
      <p className="club-hq-footnote">Home Ground tiers are derived from completed, synchronised Club matches; Training Centre tiers are derived from completed Club training sessions; Academy tiers reflect current squad size. They do not create credits, alter bids, affect rewards or change the Club Wallet.</p>
    </section>
  );
}
