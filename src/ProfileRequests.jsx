import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const POSITIONS = ["GK","CB","LB","RB","LWB","RWB","CDM","CM","CAM","LM","RM","LW","RW","ST","CF"];
const FIELDS = [
  ["height", "Height"], ["weight", "Weight"], ["position", "Position"],
  ["preferredFoot", "Preferred foot"], ["jerseyNumber", "Jersey number"],
  ["dateOfBirth", "Date of birth"], ["bio", "Bio"], ["profileImage", "Profile image URL"],
];

async function api(path, options = {}) {
  const user = auth?.currentUser;
  const token = user ? await user.getIdToken() : null;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    ...(options.body !== undefined ? { body: typeof options.body === "string" ? options.body : JSON.stringify(options.body) } : {}),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

function styles() {
  return `
    .pr-footer{width:100%;text-align:center;padding:22px 16px 92px;color:#777;font-size:12px}
    .pr-footer strong{color:#aaa;font-weight:600}
    .pr-launch{position:fixed;right:18px;bottom:82px;z-index:50;border:1px solid #333;background:#171717;color:#fff;border-radius:999px;padding:11px 15px;cursor:pointer;box-shadow:0 8px 30px #0008}
    .pr-launch:hover{background:#222}
    .pr-backdrop{position:fixed;inset:0;z-index:100;background:#000a;display:flex;align-items:center;justify-content:center;padding:18px}
    .pr-modal{width:min(720px,100%);max-height:90vh;overflow:auto;background:#101010;border:1px solid #292929;border-radius:18px;padding:20px;color:#eee;box-shadow:0 24px 80px #000}
    .pr-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:18px}.pr-head h2{margin:0;font-size:20px}.pr-x{background:none;border:0;color:#aaa;font-size:24px;cursor:pointer}
    .pr-card{border:1px solid #282828;background:#151515;border-radius:14px;padding:15px;margin:10px 0}.pr-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pr-field label{display:block;font-size:12px;color:#999;margin-bottom:5px}.pr-field input,.pr-field select,.pr-field textarea{width:100%;box-sizing:border-box;background:#0b0b0b;color:#eee;border:1px solid #333;border-radius:9px;padding:10px}.pr-field textarea{min-height:80px;resize:vertical}.pr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.pr-btn{border:1px solid #333;background:#222;color:#fff;border-radius:9px;padding:9px 13px;cursor:pointer}.pr-btn.primary{background:#fff;color:#000}.pr-btn.danger{background:#351717}.pr-muted{color:#999;font-size:13px}.pr-status{font-size:12px;padding:4px 8px;border-radius:999px;background:#242424;display:inline-block}.pr-diff{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}.pr-diff div{background:#0b0b0b;padding:8px;border-radius:8px}.pr-msg{padding:10px;border-radius:10px;background:#1d251d;color:#b9d8b9;margin-bottom:12px;font-size:13px}@media(max-width:600px){.pr-grid,.pr-diff{grid-template-columns:1fr}.pr-modal{padding:15px}.pr-launch{right:12px}}\n    @media(max-width:760px){\n      .pr-backdrop{padding:10px 8px 86px;align-items:flex-start}\n      .pr-modal{width:100%;max-height:calc(100dvh - 96px);margin-top:8px;border-radius:20px;padding:16px}\n      .pr-head{position:sticky;top:0;background:#101010;padding-bottom:12px;z-index:2}\n      .pr-head h2{font-size:19px;line-height:1.15}\n      .pr-card{padding:14px}\n      .pr-grid{grid-template-columns:1fr}\n      .pr-actions{display:grid;grid-template-columns:1fr}\n      .pr-actions .pr-btn{width:100%;min-height:44px}\n    }
  `;
}

export default function ProfileRequests() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [player, setPlayer] = useState(null);
  const [requests, setRequests] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [linkUser, setLinkUser] = useState("");
  const [linkPlayer, setLinkPlayer] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({});
  const [rejectingRequestId, setRejectingRequestId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => auth ? onAuthStateChanged(auth, async (u) => {
    setFirebaseUser(u);
    if (!u) { setAccount(null); return; }
    try {
      const data = await api("/auth/me");
      setAccount(data.user);
    } catch (e) { console.error(e); }
  }) : undefined, []);

  async function refresh() {
    if (!firebaseUser) return;
    try {
      const me = await api("/auth/me");
      setAccount(me.user);
      if (me.user.playerProfile) {
        const all = await api("/players");
        const list = Array.isArray(all) ? all : (all.players || []);
        const p = list.find((x) => String(x._id || x.id) === String(me.user.playerProfile));
        setPlayer(p || null);
        if (p) setForm({...Object.fromEntries(FIELDS.map(([k]) => [k, k === "dateOfBirth" && p[k] ? new Date(p[k]).toISOString().slice(0,10) : p[k] ?? ""])), preferredPositions:p.preferredPositions||[],clasicoSide:p.clasicoSide||""});
      } else setPlayer(null);
      const mine = await api("/profile-requests/me");
      setRequests(mine);
      if (me.user.role === "admin") {
        const [rq, us, ps] = await Promise.all([api("/profile-requests/admin"), api("/profile-requests/admin/users"), api("/players")]);
        setAdminRequests(rq); setViewers(us); setPlayers(Array.isArray(ps) ? ps : (ps.players || []));
      }
    } catch (e) { setMessage(e.message); }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- Refresh the existing linked-account panel after Firebase identity changes.
  useEffect(() => { if (firebaseUser) refresh(); }, [firebaseUser]);

  async function submit() {
    setBusy(true); setMessage("");
    try { await api("/profile-requests", { method: "POST", body: JSON.stringify({ playerId: player?._id || player?.id, changes: form }) }); setMessage("Submitted for admin approval. Your official profile has not changed yet."); await refresh(); }
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
      await api(`/profile-requests/admin/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setMessage("Request approved.");
      await refresh();
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
        body: JSON.stringify({ reason }),
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
    try { await api("/profile-requests/admin/link", { method: "POST", body: JSON.stringify({ userId: linkUser, playerId: linkPlayer }) }); setMessage("Account linked to player profile."); setLinkUser(""); setLinkPlayer(""); await refresh(); }
    catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }

  if (!firebaseUser || !account) return <><style>{styles()}</style><footer className="pr-footer">Made by <strong>Jeswin</strong></footer></>;

  const isAdmin = account.role === "admin";
  return <>
    <style>{styles()}</style>
    <button className="pr-launch" onClick={() => { setOpen(true); refresh(); }}>{isAdmin ? "⚙ Profile Admin" : "👤 My Profile"}</button>
    <footer className="pr-footer">Made by <strong>Jeswin</strong></footer>
    {open && <div className="pr-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <section className="pr-modal">
        <div className="pr-head"><h2>{isAdmin ? "Profile Administration" : "My Profile"}</h2><button className="pr-x" onClick={() => setOpen(false)}>×</button></div>
        {message && <div className="pr-msg">{message}</div>}

        {!isAdmin && !player && <div className="pr-card"><strong>Profile not linked yet</strong><p className="pr-muted">An admin must link your account to your player profile before you can submit profile changes.</p></div>}

        {!isAdmin && player && <>
          <div className="pr-card"><strong>{player.name}</strong><p className="pr-muted">Changes below are sent to the admin for approval. Nothing becomes official until approved.</p></div>
          <div className="pr-grid">{FIELDS.map(([key,label]) => <div className="pr-field" key={key}><label>{label}</label>{key === "bio" ? <textarea value={form[key] ?? ""} onChange={(e)=>setForm({...form,[key]:e.target.value})}/> : key === "preferredFoot" ? <select value={form[key] ?? ""} onChange={(e)=>setForm({...form,[key]:e.target.value})}><option value="">Select</option><option>Left</option><option>Right</option><option>Both</option></select> : <input type={key === "dateOfBirth" ? "date" : key === "height" || key === "weight" || key === "jerseyNumber" ? "number" : "text"} value={form[key] ?? ""} onChange={(e)=>setForm({...form,[key]:e.target.value})}/>}</div>)}</div>
          <fieldset className="gg-associations"><legend>Preferred positions</legend>{POSITIONS.map(position=><label key={position}><input type="checkbox" checked={(form.preferredPositions||[]).includes(position)} onChange={e=>setForm(old=>({...old,preferredPositions:e.target.checked?[...(old.preferredPositions||[]),position]:(old.preferredPositions||[]).filter(p=>p!==position)}))}/>{position}</label>)}</fieldset>
          <label>El Clásico side<select disabled={Boolean(player.clasicoSide)} value={form.clasicoSide||""} onChange={e=>setForm({...form,clasicoSide:e.target.value})}><option value="">Choose a side</option><option>Messi</option><option>Ronaldo</option></select></label><p className="pr-muted">Preferences require approval. Your approved El Clásico side is permanent.</p>
          <div className="pr-actions"><button className="pr-btn primary" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit for Approval"}</button></div>
          {requests.length > 0 && <div className="pr-card"><strong>Request history</strong>{requests.map(r=><div key={r._id} style={{marginTop:10}}><span className="pr-status">{r.status}</span> <span className="pr-muted">{new Date(r.createdAt).toLocaleString()}</span>{r.rejectionReason && <div className="pr-muted">Reason: {r.rejectionReason}</div>}</div>)}</div>}
        </>}

        {isAdmin && <>
          <div className="pr-card"><strong>Link account to player</strong><div className="pr-grid" style={{marginTop:10}}><div className="pr-field"><label>Account</label><select value={linkUser} onChange={e=>setLinkUser(e.target.value)}><option value="">Select account</option>{viewers.map(u=><option key={u._id} value={u._id}>{u.name || u.email} — {u.email}</option>)}</select></div><div className="pr-field"><label>Player</label><select value={linkPlayer} onChange={e=>setLinkPlayer(e.target.value)}><option value="">Select player</option>{players.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}</select></div></div><div className="pr-actions"><button className="pr-btn primary" disabled={busy || !linkUser || !linkPlayer} onClick={link}>Link account</button></div></div>
          <div className="pr-card"><strong>Pending profile requests</strong>{adminRequests.length === 0 && <p className="pr-muted">No pending requests.</p>}{adminRequests.map(r=><div className="pr-card" key={r._id}><strong>{r.requestedBy?.name || r.requestedBy?.email}</strong><div className="pr-muted">{r.player?.name} • {new Date(r.createdAt).toLocaleString()}</div><div className="pr-diff" style={{marginTop:10}}>{Object.keys(r.changes || {}).map(k=><div key={k}><strong>{k}</strong><br/>Before: {String(r.before?.[k] ?? "—")}<br/>After: {String(r.changes?.[k] ?? "—")}</div>)}</div><div className="pr-actions"><button className="pr-btn primary" disabled={busy} onClick={()=>review(r._id,"approve")}>Approve</button><button className="pr-btn danger" disabled={busy} onClick={()=>review(r._id,"reject")}>Reject</button></div></div>)}</div>
        </>}
      </section>
    </div>}

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
