import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./lib/api";

const POSITIONS = ["GK","CB","LB","RB","LWB","RWB","CDM","CM","CAM","LM","RM","LW","RW","ST","CF"];
const FIELDS = [
  ["height", "Height"], ["weight", "Weight"], ["position", "Position"],
  ["preferredFoot", "Preferred foot"], ["jerseyNumber", "Jersey number"],
  ["dateOfBirth", "Date of birth"], ["bio", "Bio"], ["profileImage", "Profile image URL"],
];

function styles() {
  return `
    .pr-backdrop{position:fixed;inset:0;z-index:100;background:#000a;display:flex;align-items:center;justify-content:center;padding:18px}
    .pr-modal{width:min(720px,100%);max-height:90vh;overflow:auto;background:#101010;border:1px solid #292929;border-radius:18px;padding:20px;color:#eee;box-shadow:0 24px 80px #000}
    .pr-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:18px}.pr-head h2{margin:0;font-size:20px}.pr-x{background:none;border:0;color:#aaa;font-size:24px;cursor:pointer}
    .pr-card{border:1px solid #282828;background:#151515;border-radius:14px;padding:15px;margin:10px 0}.pr-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pr-field label{display:block;font-size:12px;color:#999;margin-bottom:5px}.pr-field input,.pr-field select,.pr-field textarea{width:100%;box-sizing:border-box;background:#0b0b0b;color:#eee;border:1px solid #333;border-radius:9px;padding:10px}.pr-field textarea{min-height:80px;resize:vertical}.pr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.pr-btn{border:1px solid #333;background:#222;color:#fff;border-radius:9px;padding:9px 13px;cursor:pointer}.pr-btn.primary{background:#fff;color:#000}.pr-btn.danger{background:#351717}.pr-muted{color:#999;font-size:13px}.pr-status{font-size:12px;padding:4px 8px;border-radius:999px;background:#242424;display:inline-block}.pr-diff{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}.pr-diff div{background:#0b0b0b;padding:8px;border-radius:8px}.pr-msg{padding:10px;border-radius:10px;background:#1d251d;color:#b9d8b9;margin-bottom:12px;font-size:13px}@media(max-width:600px){.pr-grid,.pr-diff{grid-template-columns:1fr}.pr-modal{padding:15px}.pr-launch{right:12px}}
    @media(max-width:760px){
      .pr-backdrop{padding:10px 8px 86px;align-items:flex-start}
      .pr-modal{width:100%;max-height:calc(100dvh - 96px);margin-top:8px;border-radius:20px;padding:16px}
      .pr-head{position:sticky;top:0;background:#101010;padding-bottom:12px;z-index:2}
      .pr-head h2{font-size:19px;line-height:1.15}
      .pr-card{padding:14px}
      .pr-grid{grid-template-columns:1fr}
      .pr-actions{display:grid;grid-template-columns:1fr}
      .pr-actions .pr-btn{width:100%;min-height:44px}
    }
  `;
}

export default function ProfileRequests({ mode, playerId, onClose }) {
  const isAdmin = mode === "admin";
  const [player, setPlayer] = useState(null);
  const [requests, setRequests] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [linkUser, setLinkUser] = useState("");
  const [linkPlayer, setLinkPlayer] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({});
  const [rejectingRequestId, setRejectingRequestId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const refresh = useCallback(async () => {
    try {
      if (isAdmin) {
        const [rq, us, ps] = await Promise.all([api("/profile-requests/admin"), api("/profile-requests/admin/users"), api("/players")]);
        setAdminRequests(rq); setViewers(us); setPlayers(Array.isArray(ps) ? ps : (ps.players || []));
      } else {
        const [p, mine] = await Promise.all([api("/players/" + encodeURIComponent(playerId)), api("/profile-requests/me")]);
        setPlayer(p);
        setRequests(mine);
        setForm({...Object.fromEntries(FIELDS.map(([k]) => [k, k === "dateOfBirth" && p[k] ? new Date(p[k]).toISOString().slice(0,10) : p[k] ?? ""])), preferredPositions:p.preferredPositions||[],clasicoSide:p.clasicoSide||""});
      }
    } catch (e) { setMessage(e.message); } finally { setLoaded(true); }
  }, [isAdmin, playerId]);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  const closeButton = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    closeButton.current?.focus();
    return () => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);

  async function submit() {
    setBusy(true); setMessage("");
    try { await api("/profile-requests", { method: "POST", body: { playerId, changes: form } }); setMessage("Submitted for admin approval."); await refresh(); }
    catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }

  async function review(id, action) {
    if (action === "reject") {
      setRejectingRequestId(id);
      setRejectionReason("");
      setMessage("");
      return;
    }

    setBusy(true); setMessage("");
    try {
      const approved = await api("/profile-requests/admin/" + id + "/approve", {
        method: "POST",
        body: {},
      });
      // Immediately update the approving admin; other viewers receive SSE.
      setAdminRequests(current => current.filter(request => String(request._id) !== String(id)));
      setMessage("Approved and published live.");
      const playerId = approved.request?.player?._id || approved.request?.player;
      if (playerId) window.dispatchEvent(new CustomEvent("gg-player-updated", { detail: { playerId: String(playerId) } }));
      void refresh();
    }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function confirmReject() {
    const reason = rejectionReason.trim();

    if (!reason) {
      setMessage("Please enter a reason for rejecting this request.");
      return;
    }

    if (reason.length > 300) {
      setMessage("Rejection reason must be 300 characters or fewer.");
      return;
    }

    setBusy(true); setMessage("");
    try {
      await api(`/profile-requests/admin/${rejectingRequestId}/reject`, {
        method: "POST",
        body: { reason },
      });
      setMessage("Request rejected.");
      setRejectingRequestId(null);
      setRejectionReason("");
      await refresh();
    }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  function cancelReject() {
    setRejectingRequestId(null);
    setRejectionReason("");
  }

  async function link() {
    if (!linkUser || !linkPlayer) return;
    setBusy(true); setMessage("");
    try { await api("/profile-requests/admin/link", { method: "POST", body: { userId: linkUser, playerId: linkPlayer } }); setMessage("Account linked to player profile."); setLinkUser(""); setLinkPlayer(""); await refresh(); }
    catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }

  return <>
    <style>{styles()}</style>
    <div className="pr-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="pr-modal" role="dialog" aria-modal="true" aria-labelledby="profile-requests-title"
        onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
        <div className="pr-head"><h2 id="profile-requests-title">{isAdmin ? "Profile Administration" : "Request profile edit"}</h2><button type="button" ref={closeButton} className="pr-x" aria-label="Close" onClick={onClose}>×</button></div>
        {message && <div className="pr-msg" role="status">{message}</div>}
        {!loaded && <p className="pr-muted" role="status">Loading profile records…</p>}

        {!isAdmin && player && <>
          <div className="pr-card"><strong>{player.name}</strong><p className="pr-muted">Changes below are sent to the admin for approval. Nothing becomes official until approved.</p></div>
          <div className="pr-grid">{FIELDS.map(([key,label]) => <div className="pr-field" key={key}><label>{label}</label>{key === "bio" ? <textarea value={form[key] ?? ""} onChange={(e)=>setForm({...form,[key]:e.target.value})}/> : key === "preferredFoot" ? <select value={form[key] ?? ""} onChange={(e)=>setForm({...form,[key]:e.target.value})}><option value="">Select</option><option>Left</option><option>Right</option><option>Both</option></select> : <input type={key === "dateOfBirth" ? "date" : key === "height" || key === "weight" || key === "jerseyNumber" ? "number" : "text"} value={form[key] ?? ""} onChange={(e)=>setForm({...form,[key]:e.target.value})}/>}</div>)}</div>
          <fieldset className="gg-associations"><legend>Preferred positions</legend>{POSITIONS.map(position=><label key={position}><input type="checkbox" checked={(form.preferredPositions||[]).includes(position)} onChange={e=>setForm(old=>({...old,preferredPositions:e.target.checked?[...(old.preferredPositions||[]),position]:(old.preferredPositions||[]).filter(p=>p!==position)}))}/>{position}</label>)}</fieldset>
          <label>El Clásico side<select disabled={Boolean(player.clasicoSide)} value={form.clasicoSide||""} onChange={e=>setForm({...form,clasicoSide:e.target.value})}><option value="">Choose a side</option><option>Messi</option><option>Ronaldo</option></select></label><p className="pr-muted">Preferences require approval. Your approved El Clásico side is permanent.</p>
          <div className="pr-actions"><button className="pr-btn primary" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit for Approval"}</button></div>
          {requests.length > 0 && <div className="pr-card"><strong>Request history</strong>{requests.map(r=><div key={r._id} style={{marginTop:10}}><span className="pr-status">{r.status}</span> <span className="pr-muted">{new Date(r.createdAt).toLocaleString()}</span>{r.rejectionReason && <div className="pr-muted">Reason: {r.rejectionReason}</div>}</div>)}</div>}
        </>}

        {isAdmin && loaded && <>
          <div className="pr-card"><strong>Link account to player</strong><div className="pr-grid" style={{marginTop:10}}><div className="pr-field"><label>Account</label><select value={linkUser} onChange={e=>setLinkUser(e.target.value)}><option value="">Select account</option>{viewers.map(u=><option key={u._id} value={u._id}>{u.name || u.email} — {u.email}</option>)}</select></div><div className="pr-field"><label>Player</label><select value={linkPlayer} onChange={e=>setLinkPlayer(e.target.value)}><option value="">Select player</option>{players.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}</select></div></div><div className="pr-actions"><button className="pr-btn primary" disabled={busy || !linkUser || !linkPlayer} onClick={link}>Link account</button></div></div>
          <div className="pr-card"><strong>Pending profile requests</strong>{adminRequests.length === 0 && <p className="pr-muted">No pending requests.</p>}{adminRequests.map(r=><div className="pr-card" key={r._id}><strong>{r.requestedBy?.name || r.requestedBy?.email}</strong><div className="pr-muted">{r.player?.name} • {new Date(r.createdAt).toLocaleString()}</div><div className="pr-diff" style={{marginTop:10}}>{Object.keys(r.changes || {}).map(k=><div key={k}><strong>{k}</strong><br/>Before: {String(r.before?.[k] ?? "—")}<br/>After: {String(r.changes?.[k] ?? "—")}</div>)}</div><div className="pr-actions"><button className="pr-btn primary" disabled={busy} onClick={()=>review(r._id,"approve")}>Approve</button><button className="pr-btn danger" disabled={busy} onClick={()=>review(r._id,"reject")}>Reject</button></div></div>)}</div>
        </>}
      </section>
    </div>

    {rejectingRequestId && (
      <div
        className="pr-backdrop"
        style={{ zIndex: 200 }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) cancelReject();
        }}
      >
        <section
          className="pr-modal"
          style={{ width: "min(520px, 100%)" }}
        >
          <div className="pr-head">
            <h2>Reject Profile Request</h2>
            <button
              className="pr-x"
              onClick={cancelReject}
              disabled={busy}
            >
              ×
            </button>
          </div>

          <p className="pr-muted">
            Enter a reason for rejecting this profile update request.
            The user will be able to see this reason in their request history.
          </p>

          <div className="pr-field">
            <label htmlFor="rejection-reason">Reason for rejection</label>
            <textarea
              id="rejection-reason"
              value={rejectionReason}
              maxLength={300}
              autoFocus
              placeholder="Example: Please provide a more accurate playing position."
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div
              className="pr-muted"
              style={{ marginTop: 5, textAlign: "right" }}
            >
              {rejectionReason.length}/300
            </div>
          </div>

          <div className="pr-actions">
            <button
              className="pr-btn"
              disabled={busy}
              onClick={cancelReject}
            >
              Cancel
            </button>
            <button
              className="pr-btn danger"
              disabled={busy || !rejectionReason.trim()}
              onClick={confirmReject}
            >
              {busy ? "Rejecting…" : "Confirm Rejection"}
            </button>
          </div>
        </section>
      </div>
    )}
  </>;
}
