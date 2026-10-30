import { useMemo, useState } from "react";
import { api } from "../../lib/api";
import "./club-training-centre.css";

const FOCUS_OPTIONS = [
  ["passing", "Passing patterns"],
  ["possession", "Possession & rondos"],
  ["pressing", "Pressing triggers"],
  ["finishing", "Finishing combinations"],
  ["set-pieces", "Set-piece routines"],
  ["tactical", "Small-sided tactics"],
];
const defaultSchedule = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  const part = value => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + part(date.getMonth() + 1) + "-" + part(date.getDate())
    + "T" + part(date.getHours()) + ":" + part(date.getMinutes());
};
const dateLabel = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : new Intl.DateTimeFormat("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(date);
};
const personName = (playerId, players) => players.find(player => String(player._id) === String(playerId))?.name || "Club member";

export default function ClubTrainingCentre({ club, players = [], playerId, isCaptain = false, sessions = [], onRefresh }) {
  const [title, setTitle] = useState("Squad training session");
  const [focus, setFocus] = useState("passing");
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const playerById = useMemo(() => new Map(players.map(player => [String(player._id), player])), [players]);
  const completed = sessions.filter(session => session.status === "completed");
  const upcoming = sessions.filter(session => session.status === "scheduled");
  const attendanceCount = completed.reduce((sum, session) => sum + (session.attendees || []).filter(item => item.attendance === "present").length, 0);

  const runAction = async (id, action) => {
    setError("");
    setNotice("");
    setBusyId(id);
    try {
      await action();
      await onRefresh?.();
      setNotice("Club training record updated.");
    } catch (requestError) {
      setError(requestError.message || "The Club training action could not be completed.");
    } finally {
      setBusyId("");
    }
  };

  const createSession = async event => {
    event.preventDefault();
    await runAction("create", async () => {
      await api("/clubs/" + club._id + "/training", {
        method: "POST",
        body: { title, focus, notes, scheduledAt: new Date(scheduledAt).toISOString() },
      });
      setTitle("Squad training session");
      setNotes("");
      setScheduledAt(defaultSchedule());
    });
  };

  const respond = (session, response) => runAction("response-" + session._id, () =>
    api("/clubs/" + club._id + "/training/" + session._id + "/response", {
      method: "PATCH",
      body: { response },
    })
  );

  const markAttendance = (session, attendee, attendance) => runAction("attendance-" + session._id + "-" + attendee.playerId, () =>
    api("/clubs/" + club._id + "/training/" + session._id + "/attendance", {
      method: "PATCH",
      body: { playerId: attendee.playerId, attendance },
    })
  );

  const completeSession = session => runAction("complete-" + session._id, () =>
    api("/clubs/" + club._id + "/training/" + session._id + "/complete", { method: "POST", body: {} })
  );

  return (
    <section className="club-training-centre" aria-label="Club Training Centre">
      <header className="club-training-hero">
        <div>
          <p className="clubs-eyebrow">CLUBHOUSE / DEVELOPMENT WING</p>
          <h2>Training Centre</h2>
          <p>Plan sessions together, confirm who's coming and keep a shared record of team development.</p>
        </div>
        <div className="club-training-crest" aria-hidden="true">⚽</div>
      </header>

      <div className="club-training-metrics">
        <article><span>SCHEDULED SESSIONS</span><strong>{upcoming.length}</strong><small>Open team sessions</small></article>
        <article><span>COMPLETED SESSIONS</span><strong>{completed.length}</strong><small>Club training history</small></article>
        <article><span>RECORDED ATTENDANCES</span><strong>{attendanceCount}</strong><small>Member check-ins</small></article>
      </div>

      {isCaptain ? (
        <form className="club-training-create" onSubmit={createSession}>
          <div className="club-training-section-heading"><div><p className="clubs-eyebrow">CAPTAIN'S DESK</p><h3>Schedule a team session</h3></div><span>Invites all current Club members</span></div>
          <div className="club-training-form-grid">
            <label><span>SESSION NAME</span><input required minLength={3} maxLength={80} value={title} onChange={event => setTitle(event.target.value)} /></label>
            <label><span>TRAINING FOCUS</span><select value={focus} onChange={event => setFocus(event.target.value)}>{FOCUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>DATE & TIME</span><input required type="datetime-local" min={defaultSchedule().slice(0, 16)} value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} /></label>
            <label className="club-training-notes"><span>COACH'S NOTE (OPTIONAL)</span><input maxLength={280} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Bring cones, bibs or a specific focus…" /></label>
          </div>
          <button type="submit" className="clubs-primary-button" disabled={busyId === "create"}>{busyId === "create" ? "Scheduling…" : "Schedule team training ↗"}</button>
        </form>
      ) : (
        <div className="club-training-member-note"><strong>Squad training</strong><span>Your Club captain schedules the shared sessions. Accept or decline invitations below; your individual drill journal remains private.</span></div>
      )}

      {error && <div className="clubs-error" role="alert">{error}</div>}
      {notice && <p className="club-training-notice" role="status">{notice}</p>}

      <section className="club-training-session-list">
        <div className="club-training-section-heading"><div><p className="clubs-eyebrow">SQUAD CALENDAR</p><h3>Team sessions</h3></div><span>{sessions.length} recorded</span></div>
        {sessions.length ? sessions.map(session => {
          const own = (session.attendees || []).find(item => String(item.playerId) === String(playerId));
          const confirmed = (session.attendees || []).filter(item => item.response === "accepted").length;
          return (
            <article className="club-training-session-card" key={session._id}>
              <div className="club-training-session-top">
                <div><span className="club-training-focus">{FOCUS_OPTIONS.find(([value]) => value === session.focus)?.[1] || session.focus}</span><h4>{session.title}</h4><small>{dateLabel(session.scheduledAt)} · Hosted by {personName(session.createdBy, players)}</small></div>
                <span className={"club-training-status is-" + session.status}>{session.status.toUpperCase()}</span>
              </div>
              {session.notes && <p className="club-training-session-notes">{session.notes}</p>}
              <div className="club-training-roster">
                {(session.attendees || []).map(attendee => (
                  <div className="club-training-attendee" key={String(attendee.playerId)}>
                    <span className="club-training-attendee-avatar">{personName(attendee.playerId, players).split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                    <div><strong>{personName(attendee.playerId, players)}</strong><small>{attendee.response === "pending" ? "Response pending" : attendee.response === "accepted" ? "Confirmed" : "Declined"} · {attendee.attendance === "unmarked" ? "Attendance unmarked" : attendee.attendance}</small></div>
                    {isCaptain && session.status === "scheduled" && (
                      <div className="club-training-attendance-actions">
                        <button type="button" aria-label={"Mark " + personName(attendee.playerId, players) + " present"} className={attendee.attendance === "present" ? "active" : ""} disabled={busyId !== ""} onClick={() => markAttendance(session, attendee, "present")}>Present</button>
                        <button type="button" aria-label={"Mark " + personName(attendee.playerId, players) + " absent"} className={attendee.attendance === "absent" ? "active" : ""} disabled={busyId !== ""} onClick={() => markAttendance(session, attendee, "absent")}>Absent</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="club-training-session-actions">
                <span>{confirmed}/{session.attendees?.length || 0} members confirmed</span>
                {session.status === "scheduled" && own?.response === "pending" && (
                  <div><button type="button" className="clubs-secondary-button" disabled={busyId !== ""} onClick={() => respond(session, "declined")}>Decline</button><button type="button" className="clubs-primary-button" disabled={busyId !== ""} onClick={() => respond(session, "accepted")}>Accept invitation</button></div>
                )}
                {isCaptain && session.status === "scheduled" && (
                  <button type="button" className="clubs-primary-button" disabled={busyId !== ""} onClick={() => completeSession(session)}>Complete session</button>
                )}
                {session.status === "completed" && <small>Completed {session.completedAt ? dateLabel(session.completedAt) : ""}</small>}
              </div>
            </article>
          );
        }) : (
          <div className="clubs-empty"><strong>No team sessions scheduled yet.</strong><span>{isCaptain ? "Schedule your first Club session and every active member will receive an invitation here." : "Your Club captain can schedule passing, possession, pressing, finishing or tactical sessions here."}</span></div>
        )}
      </section>
      <p className="club-training-boundary">Shared Club session invitations and attendance are visible to current Club members. Individual GG Grounds training history remains private on the player's device. Team sessions do not spend Club credits or affect official ratings, OVR, match records or settlement.</p>
    </section>
  );
}
