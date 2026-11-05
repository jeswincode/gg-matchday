import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { PlayerSprite } from "./OriginalGGWorld";
import { AVATAR_OPTIONS, WORLD_COSMETIC_CATALOG } from "../../shared/worldCustomization.js";
import { FREE_AVATAR_OPTIONS } from "../../shared/worldAvatarOptions.js";
import "./original-gg.css";

const defaults = { displayName:"", appearance:{skinTone:"medium",bodyType:"athletic",hairStyle:"short",hairColor:"black",kitPrimary:"black",kitSecondary:"gold",bootColor:"white",headAccessory:"none"} };
const choices = AVATAR_OPTIONS;
const labels = {skinTone:"Skin tone",bodyType:"Body build",hairStyle:"Hair style",hairColor:"Hair colour",kitPrimary:"Kit colour",kitSecondary:"Kit trim",bootColor:"Boots",headAccessory:"Headwear"};

export default function OriginalGGProfile({ authUser, backendUser, onBack }) {
  const [avatar,setAvatar] = useState(defaults);
  const [player,setPlayer] = useState(null);
  const [linked,setLinked] = useState(false);
  const [ownedCosmetics,setOwnedCosmetics] = useState([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([api("/world/bootstrap"),api("/players"),api("/world/economy")]).then(([world,players,economy]) => {
      if (!active) return;
      const linkedPlayer = Array.isArray(players) ? players.find((item)=>String(item._id)===String(backendUser?.playerProfile)) : null;
      setPlayer(linkedPlayer||null);
      setLinked(Boolean(backendUser?.playerProfile));
      if (world.avatar) setAvatar(world.avatar);
      setOwnedCosmetics((economy.inventory||[]).filter((entry)=>entry.quantity>0).map((entry)=>entry.itemId));
    }).catch((error) => {
      if (active) setMessage(error.message||"Could not load your profile.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  },[backendUser?.playerProfile]);
  function updateAppearance(key,value) {
    setAvatar((current)=>({...current,appearance:{...current.appearance,[key]:value}}));
  }
  async function save(event) {
    event.preventDefault();
    setSaving(true);setMessage("");
    try {
      const result=await api("/world/avatar",{method:"PUT",body:avatar});
      setAvatar(result.avatar);
      setMessage("Your character changes have been saved.");
    } catch(error) {
      setMessage(error.message||"Could not save your character.");
    } finally {
      setSaving(false);
    }
  }
  const appearance=avatar.appearance||defaults.appearance;
  const editableChoices = Object.fromEntries(Object.entries(FREE_AVATAR_OPTIONS).map(([field,values])=>[field,[...values,...WORLD_COSMETIC_CATALOG.filter((item)=>ownedCosmetics.includes(item.id)&&item.appearancePatch?.[field]).map((item)=>item.appearancePatch[field])].filter((value,index,array)=>array.indexOf(value)===index)]));
  return <main className="gg-world gg-profile-page">
    <header className="gg-world-header"><div className="gg-world-brand"><span className="gg-world-crest">GG</span><div><p>YOUR PLAYER SPACE</p><h1>My Profile</h1></div></div><button className="gg-world-back" onClick={onBack}>← Matchday</button></header>
    <section className="gg-world-intro"><div><span className="gg-world-kicker">YOUR ACCOUNT · YOUR FOOTBALL IDENTITY</span><h2>Welcome, {authUser?.displayName||authUser?.email?.split("@")[0]||"GG Player"}.</h2><p>Your Matchday account and your Original GG character in one place.</p></div></section>
    {loading ? <div className="gg-world-loading">Loading your player profile…</div> : <>
      <section className="gg-profile-account">
        <div className="gg-profile-account-avatar">{authUser?.photoURL?<img src={authUser.photoURL} alt=""/>:<span>{(authUser?.displayName||authUser?.email||"G").charAt(0).toUpperCase()}</span>}</div>
        <div className="gg-profile-account-copy"><span>GG MATCHDAY ACCOUNT</span><h2>{authUser?.displayName||"GG Matchday Player"}</h2><p>{authUser?.email||"Signed-in account"}</p><div><small>{backendUser?.role||"player"}</small><small>{linked?"GG player profile linked":"Player profile not linked"}</small></div></div>
        <div className="gg-profile-stat"><span>PLAYER IDENTITY</span><strong>{player?.name|| (linked?"Linked":"Not linked")}</strong><small>{player?.position||"Footballer"}</small></div>
      </section>
      <section className="gg-world-panel">
        <div className="gg-world-section-title"><span>ORIGINAL GG AVATAR STUDIO</span><h2>Design your footballer</h2><p>This character represents you around the GG website and shared football city.</p></div>
        <div className="gg-world-avatar-card">
          <div className="gg-world-avatar-preview"><PlayerSprite appearance={appearance}/><strong>{avatar.displayName||player?.name||"Your player"}</strong><small>YOUR GG CHARACTER</small></div>
          <form className="gg-world-form" onSubmit={save}>
            <label>Character name<input maxLength="24" value={avatar.displayName||""} onChange={(event)=>setAvatar((v)=>({...v,displayName:event.target.value}))} placeholder={player?.name||"Name your footballer"}/></label>
            <div className="gg-world-select-grid">{Object.entries(editableChoices).map(([key,values])=><label key={key}>{labels[key]}<select value={appearance[key]||defaults.appearance[key]} onChange={(event)=>updateAppearance(key,event.target.value)}>{values.map((value)=><option key={value}>{value}</option>)}</select></label>)}</div>
            <button className="gg-world-primary" disabled={saving||!linked}>{!linked?"Link your player profile first":saving?"Saving…":"Save character"}</button>
          </form>
        </div>
      </section>
      <section className="gg-profile-notes"><div><span>YOUR MATCHDAY</span><strong>History that stays yours</strong><small>Your existing player profile, match records and statistics remain part of your account.</small></div><div><span>YOUR ORIGINAL GG</span><strong>A character that follows you</strong><small>Your saved look is shared by your profile and the football city.</small></div></section>
    </>}
    {message&&<p className="gg-world-notice" role="status">{message}</p>}
    <footer className="gg-world-footer">GG MATCHDAY · MY PLAYER PROFILE <span>YOUR FOOTBALL STORY.</span></footer>
  </main>;
}
