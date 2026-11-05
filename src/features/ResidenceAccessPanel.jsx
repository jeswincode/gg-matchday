import { useEffect, useState } from "react";
import { api } from "../lib/api";
import "./original-gg.css";

export default function ResidenceAccessPanel({ onClose }) {
  const [privacy,setPrivacy] = useState("private");
  const [visitors,setVisitors] = useState([]);
  const [query,setQuery] = useState("");
  const [results,setResults] = useState([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState("");

  useEffect(() => {
    let active = true;
    api("/world/residences/me/access").then((result) => {
      if (!active) return;
      setPrivacy(result.residence?.privacy || "private");
      setVisitors(result.visitors || []);
    }).catch((error) => { if (active) setNotice(error.message || "Could not load visitor settings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      api("/world/residence-directory/players?search=" + encodeURIComponent(text)).then((result) => {
        if (active) setResults((result.players || []).filter((item) => !visitors.some((visitor) => visitor.playerId === item.playerId)));
      }).catch(() => { if (active) setResults([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, visitors]);

  function addVisitor(visitor) {
    if (visitors.length >= 30) { setNotice("You can invite up to 30 visitors."); return; }
    setVisitors((current) => current.some((item) => item.playerId === visitor.playerId) ? current : [...current, visitor]);
    setQuery(""); setResults([]);
  }

  function removeVisitor(playerId) {
    setVisitors((current) => current.filter((item) => item.playerId !== playerId));
  }

  async function save() {
    setSaving(true); setNotice("");
    try {
      const result = await api("/world/residences/me/access", { method: "PATCH", body: { privacy, visitorPlayerIds: visitors.map((item) => item.playerId) } });
      setPrivacy(result.residence.privacy);
      setNotice("Your home access settings have been saved.");
    } catch (error) { setNotice(error.message || "Could not save home access settings."); }
    finally { setSaving(false); }
  }

  return <div className="gg-world-modal-backdrop gg-access-backdrop" onClick={onClose}>
    <section className="gg-world-interior-dialog gg-access-dialog" role="dialog" aria-modal="true" aria-labelledby="gg-access-title" onClick={(event)=>event.stopPropagation()}>
      <header><div><span>YOUR HOME · PRIVACY CONTROLS</span><h2 id="gg-access-title">Choose who can visit</h2></div><button className="gg-world-modal-close" onClick={onClose} aria-label="Close visitor settings">×</button></header>
      {loading ? <p className="gg-world-loading">Loading your home settings…</p> : <>
        <label className="gg-access-privacy">Interior access
          <select value={privacy} onChange={(event)=>setPrivacy(event.target.value)}>
            <option value="private">Private · only me</option>
            <option value="friends">Invited visitors only</option>
            <option value="public">Public · anyone can visit</option>
          </select>
        </label>
        <div className="gg-access-explain">{privacy==="private"?"Your home interior is visible only to you.":privacy==="friends"?"Only you and the players in your visitor list can enter.":"Any signed-in GG player can enter your home."}</div>
        <div className="gg-access-search"><label htmlFor="gg-residence-search">Invite a player</label><input id="gg-residence-search" value={query} maxLength={32} onChange={(event)=>setQuery(event.target.value)} placeholder="Search player names…"/>{query.trim().length>=2&&results.length>0&&<div className="gg-access-results">{results.map((visitor)=><button type="button" key={visitor.playerId} onClick={()=>addVisitor(visitor)}><span>{visitor.displayName}</span><b>+ Invite</b></button>)}</div>}</div>
        <div className="gg-access-visitors"><div><strong>Invited visitors</strong><small>{visitors.length}/30</small></div>{visitors.length?visitors.map((visitor)=><div className="gg-access-visitor" key={visitor.playerId}><span>{visitor.displayName}</span><button type="button" onClick={()=>removeVisitor(visitor.playerId)} aria-label={"Remove "+visitor.displayName}>Remove</button></div>):<p>No visitors invited yet.</p>}</div>
        <div className="gg-access-actions"><button type="button" className="gg-world-back" onClick={onClose}>Cancel</button><button type="button" className="gg-world-primary" onClick={save} disabled={saving}>{saving?"Saving…":"Save access settings"}</button></div>
      </>}
      {notice&&<p className="gg-world-notice" role="status">{notice}</p>}
    </section>
  </div>;
}
