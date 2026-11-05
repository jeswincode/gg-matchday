import { useState } from "react";
import { api } from "../lib/api";
import "./original-gg.css";

export default function ClubGroundManagementPanel({ ground, onUpdated }) {
  const [name,setName] = useState(ground.name || "Club Ground");
  const [access,setAccess] = useState(ground.interiorAccess || "members");
  const [saving,setSaving] = useState(false);
  const [upgrading,setUpgrading] = useState(false);
  const [notice,setNotice] = useState("");
  const nextLevel = Number(ground.level || 1) + 1;
  const upgradeCost = Math.round(250 * Math.pow(nextLevel, 1.45));

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true); setNotice("");
    try {
      const result = await api("/world/club-grounds/"+ground.clubId+"/manage", { method: "PATCH", body: { name, interiorAccess: access } });
      setNotice("Club ground settings saved.");
      onUpdated?.(result.ground);
    } catch (error) { setNotice(error.message || "Could not save ground settings."); }
    finally { setSaving(false); }
  }

  async function upgrade() {
    setUpgrading(true); setNotice("");
    try {
      const result = await api("/world/club-grounds/"+ground.clubId+"/upgrade", { method: "POST", body: { idempotencyKey: crypto.randomUUID() } });
      setNotice(result.duplicate ? "That ground upgrade was already processed." : "Your club ground is now level "+result.level+".");
      onUpdated?.({ ...ground, level: result.level });
    } catch (error) { setNotice(error.message || "Could not upgrade this club ground."); }
    finally { setUpgrading(false); }
  }

  return <section className="gg-ground-manage">
    <div><span>CAPTAIN CONTROLS</span><h3>Manage your club ground</h3><p>These settings are saved by the server. Only club captains and GG administrators can change them.</p></div>
    <form onSubmit={saveSettings}>
      <label>Ground name<input value={name} onChange={(event)=>setName(event.target.value)} maxLength={100}/></label>
      <label>Interior access<select value={access} onChange={(event)=>setAccess(event.target.value)}><option value="members">Club members only</option><option value="public">Open to all GG players</option></select></label>
      <button type="submit" className="gg-world-primary" disabled={saving||name.trim().length<2}>{saving?"Saving…":"Save ground settings"}</button>
    </form>
    <div className="gg-ground-upgrade"><div><strong>Ground level {ground.level || 1}/20</strong><small>Next upgrade: ◈ {upgradeCost.toLocaleString()} club credits</small></div><button type="button" className="gg-world-primary" disabled={upgrading||(ground.level||1)>=20} onClick={upgrade}>{upgrading?"Upgrading…":(ground.level||1)>=20?"Max level":"Upgrade ground"}</button></div>
    {notice&&<p className="gg-world-notice" role="status">{notice}</p>}
  </section>;
}
