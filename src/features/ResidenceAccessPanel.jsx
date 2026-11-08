import { useEffect, useState } from "react";
import { api } from "../lib/api";
import "./original-gg.css";

export default function ResidenceAccessPanel({ onClose, onUpdated }) {
  const [privacy,setPrivacy] = useState("private");
  const [visitors,setVisitors] = useState([]);
  const [query,setQuery] = useState("");
  const [results,setResults] = useState([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState("");
  const [transfers,setTransfers] = useState([]);
  const [transferQuery,setTransferQuery] = useState("");
  const [transferResults,setTransferResults] = useState([]);
  const [transferSaving,setTransferSaving] = useState(false);
  const [respondingId,setRespondingId] = useState("");

  async function refreshHomeSettings() {
    const result = await api("/world/residences/me/access");
    setPrivacy(result.residence?.privacy || "private");
    setVisitors(result.visitors || []);
  }

  async function refreshTransfers() {
    const result = await api("/world/residences/me/transfers");
    setTransfers(result.transfers || []);
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      api("/world/residences/me/access"),
      api("/world/residences/me/transfers"),
    ]).then(([homeResult, transferResult]) => {
      if (!active) return;
      setPrivacy(homeResult.residence?.privacy || "private");
      setVisitors(homeResult.visitors || []);
      setTransfers(transferResult.transfers || []);
    }).catch((error) => { if (active) setNotice(error.message || "Could not load home settings."); })
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

  useEffect(() => {
    const text = transferQuery.trim();
    if (text.length < 2) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      api("/world/residence-directory/players?search=" + encodeURIComponent(text)).then((result) => {
        if (active) setTransferResults(result.players || []);
      }).catch(() => { if (active) setTransferResults([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [transferQuery]);

  async function inviteTransfer(target) {
    setTransferSaving(true);
    setNotice("");
    try {
      const result = await api("/world/residences/me/transfers", {
        method: "POST",
        body: { toPlayerId: target.playerId },
      });
      setNotice("Home transfer invitation sent to " + (result.transfer?.recipientName || target.displayName) + ".");
      setTransferQuery("");
      setTransferResults([]);
      await refreshTransfers();
    } catch (error) {
      setNotice(error.message || "Could not send the home transfer invitation.");
    } finally {
      setTransferSaving(false);
    }
  }

  async function respondToTransfer(transfer, action) {
    setRespondingId(transfer.id);
    setNotice("");
    try {
      const endpoint = action === "cancel"
        ? "/world/residences/me/transfers/" + transfer.id + "/cancel"
        : "/world/residences/transfers/" + transfer.id + "/" + action;
      await api(endpoint, { method: "POST" });
      setNotice(action === "accept" ? "Home ownership transferred successfully." : "Home transfer invitation " + (action === "decline" ? "declined." : "cancelled."));
      await refreshTransfers();
      if (action === "accept") {
        await refreshHomeSettings();
        await onUpdated?.();
      }
    } catch (error) {
      setNotice(error.message || "Could not update the home transfer.");
    } finally {
      setRespondingId("");
    }
  }

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
        <section className="gg-access-transfer">
          <div><strong>Transfer home ownership</strong><p>Invite a verified, linked GG player to take ownership. They must accept within 7 days. Their untouched Level 1 starter home is replaced; upgraded or furnished homes are protected.</p></div>
          <label htmlFor="gg-residence-transfer-search">Invite a new owner</label>
          <input id="gg-residence-transfer-search" value={transferQuery} maxLength={32} onChange={(event)=>{setTransferQuery(event.target.value);setTransferResults([]);}} placeholder="Search player names…"/>
          {transferQuery.trim().length>=2&&transferResults.length>0&&<div className="gg-access-results">{transferResults.map((target)=><button type="button" key={target.playerId} disabled={transferSaving} onClick={()=>inviteTransfer(target)}><span>{target.displayName}</span><b>{transferSaving?"Sending…":"Invite to own home"}</b></button>)}</div>}
          <div className="gg-access-transfer-list">
            {transfers.filter((item)=>item.status==="pending").map((item)=>(
              <div className="gg-access-visitor" key={item.id}>
                <span>{item.role==="incoming"?"From "+item.otherPlayerName:"To "+item.otherPlayerName}</span>
                {item.role==="incoming"?(
                  <span className="gg-access-transfer-actions">
                    <button type="button" disabled={Boolean(respondingId)} onClick={()=>respondToTransfer(item,"accept")}>{respondingId===item.id?"Saving…":"Accept"}</button>
                    <button type="button" disabled={Boolean(respondingId)} onClick={()=>respondToTransfer(item,"decline")}>Decline</button>
                  </span>
                ):(
                  <button type="button" disabled={Boolean(respondingId)} onClick={()=>respondToTransfer(item,"cancel")}>{respondingId===item.id?"Saving…":"Cancel invite"}</button>
                )}
              </div>
            ))}
            {!transfers.some((item)=>item.status==="pending")&&<p>No pending home transfers.</p>}
          </div>
        </section>
        <div className="gg-access-actions"><button type="button" className="gg-world-back" onClick={onClose}>Cancel</button><button type="button" className="gg-world-primary" onClick={save} disabled={saving}>{saving?"Saving…":"Save access settings"}</button></div>
      </>}
      {notice&&<p className="gg-world-notice" role="status">{notice}</p>}
    </section>
  </div>;
}
