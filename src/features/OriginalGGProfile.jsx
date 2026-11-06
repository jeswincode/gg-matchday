import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { PlayerSprite } from "./OriginalGGWorld";
import { WORLD_COSMETIC_CATALOG } from "../../shared/worldCustomization.js";
import { FREE_AVATAR_OPTIONS } from "../../shared/worldAvatarOptions.js";
import "./original-gg.css";

function formatProfileDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const defaults = { displayName:"", appearance:{skinTone:"medium",bodyType:"athletic",hairStyle:"short",hairColor:"black",kitPrimary:"black",kitSecondary:"gold",bootColor:"white",headAccessory:"none"} };
const labels = {skinTone:"Skin tone",bodyType:"Body build",hairStyle:"Hair style",hairColor:"Hair colour",kitPrimary:"Kit colour",kitSecondary:"Kit trim",bootColor:"Boots",headAccessory:"Headwear"};

function localAvatarKey(user) {
  return "gg-v4-local-avatar:"+(user?.uid||"visitor");
}
function localLookbookKey(user) {
  return "gg-v4-local-presets:"+(user?.uid||"visitor");
}
function readLocalAvatar(user) {
  try {
    const stored=JSON.parse(window.localStorage.getItem(localAvatarKey(user))||"null");
    if(stored&&typeof stored==="object")return {...defaults,...stored,appearance:{...defaults.appearance,...stored.appearance}};
  } catch { /* Fall back to a clean visitor character if local storage is unavailable. */ }
  return {...defaults,displayName:user?.displayName||user?.email?.split("@")[0]||""};
}
function readLocalLookbook(user) {
  try {
    const stored=JSON.parse(window.localStorage.getItem(localLookbookKey(user))||"[]");
    return Array.isArray(stored)?stored.slice(0,5):[];
  } catch { return []; }
}

function announceAvatarChange(avatar, local = false) {
  window.dispatchEvent(new CustomEvent("gg-avatar-updated", { detail: { avatar } }));
  // Only local visitor edits need the legacy localStorage refresh event.
  if (local) window.dispatchEvent(new Event("gg-local-avatar-changed"));
}

export default function OriginalGGProfile({ authUser, backendUser, onBack }) {
  const [avatar,setAvatar] = useState(()=>readLocalAvatar(authUser));
  const [player,setPlayer] = useState(null);
  const [linked,setLinked] = useState(false);
  const [ownedCosmetics,setOwnedCosmetics] = useState([]);
  const [presets,setPresets] = useState(()=>readLocalLookbook(authUser));
  const [presetName,setPresetName] = useState("");
  const [presetBusy,setPresetBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([api("/world/bootstrap"),api("/players")]).then(async ([world,players]) => {
      if (!active) return;
      const linkedPlayer = Array.isArray(players) ? players.find((item)=>String(item._id)===String(backendUser?.playerProfile)) : null;
      setPlayer(linkedPlayer||null);
      setLinked(Boolean(backendUser?.playerProfile));
      if (world.avatar) setAvatar(world.avatar);
      if (backendUser?.playerProfile) {
        const [economy,presetResult]=await Promise.all([api("/world/economy"),api("/world/avatar/presets")]);
        if (!active) return;
        setOwnedCosmetics((economy.inventory||[]).filter((entry)=>entry.quantity>0).map((entry)=>entry.itemId));
        setPresets(presetResult.presets||[]);
      } else {
        setOwnedCosmetics([]);
        setAvatar((current)=>{
          const local=readLocalAvatar(authUser);
          return {
            ...local,
            displayName:local.displayName||current.displayName||authUser?.displayName||authUser?.email?.split("@")[0]||"",
          };
        });
        setPresets(readLocalLookbook(authUser));
      }
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
      if(linked){
        const result=await api("/world/avatar",{method:"PUT",body:avatar});
        setAvatar(result.avatar);
        announceAvatarChange(result.avatar);
        setMessage("Your character changes have been saved to your GG player profile.");
      }else{
        window.localStorage.setItem(localAvatarKey(authUser),JSON.stringify(avatar));
        announceAvatarChange(avatar, true);
        setMessage("Your visitor character is saved on this device. Link a GG player profile to share it with the city and sync across devices.");
      }
    } catch(error) {
      setMessage(error.message||"Could not save your character.");
    } finally {
      setSaving(false);
    }
  }
  async function savePreset() {
    if (!presetName.trim()) { setMessage("Name your preset before saving."); return; }
    setPresetBusy(true);
    try {
      if(linked){
        const result=await api("/world/avatar/presets",{method:"POST",body:{name:presetName,appearance}});
        setPresets(result.presets||[]);
      }else{
        const next=[...presets,{_id:crypto.randomUUID(),name:presetName.trim(),appearance}].slice(0,5);
        window.localStorage.setItem(localLookbookKey(authUser),JSON.stringify(next));
        setPresets(next);
      }
      setPresetName("");setMessage(linked?"Character preset saved to your GG player profile.":"Local character preset saved on this device.");
    } catch(error) { setMessage(error.message||"Could not save this preset."); }
    finally { setPresetBusy(false); }
  }
  async function applyPreset(id) {
    setPresetBusy(true);
    try {
      if(linked){
        const result=await api("/world/avatar/presets/"+id+"/apply",{method:"POST",body:{}});
        setAvatar((current)=>({...current,...result.avatar}));
        announceAvatarChange(result.avatar);
      }else{
        const preset=presets.find((item)=>item._id===id);
        if(!preset)throw new Error("That lookbook entry could not be found.");
        const nextAvatar={...avatar,appearance:preset.appearance};
        setAvatar(nextAvatar);
        announceAvatarChange(nextAvatar, true);
        setMessage("Preset applied. Save your character to keep this look on this device.");
      }
      if(linked)setMessage("Character preset applied.");
    } catch(error) { setMessage(error.message||"Could not apply this preset."); }
    finally { setPresetBusy(false); }
  }
  async function deletePreset(id) {
    setPresetBusy(true);
    try {
      if(linked){
        const result=await api("/world/avatar/presets/"+id,{method:"DELETE"});
        setPresets(result.presets||[]);
      }else{
        const next=presets.filter((item)=>item._id!==id);
        window.localStorage.setItem(localLookbookKey(authUser),JSON.stringify(next));
        setPresets(next);
      }
      setMessage("Character preset deleted.");
    } catch(error) { setMessage(error.message||"Could not delete this preset."); }
    finally { setPresetBusy(false); }
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
      <section className="gg-world-panel gg-profile-player-details">
        <div className="gg-world-section-title"><span>YOUR MATCHDAY PLAYER PROFILE</span><h2>{player?.name||"Link your player profile"}</h2><p>Football details and profile information from your existing GG player record.</p></div>
        {player ? <>
          <div className="gg-profile-player-hero">
            {player.profileImage ? <img src={player.profileImage} alt={player.name+" profile"} /> : <div className="gg-profile-player-monogram">{player.name?.charAt(0)||"G"}</div>}
            <div><span>LINKED GG PLAYER</span><h3>{player.name}</h3><p>{player.bio||"Your football story starts here. Your player profile remains linked to your Matchday history."}</p></div>
          </div>
          <div className="gg-profile-player-grid">
            <article><span>PRIMARY POSITION</span><strong>{player.position||"Not set"}</strong></article>
            <article><span>PREFERRED POSITIONS</span><strong>{player.preferredPositions?.length?player.preferredPositions.join(" · "):"Not set"}</strong></article>
            <article><span>JERSEY NUMBER</span><strong>{player.jerseyNumber===null||player.jerseyNumber===undefined?"Not set":"#"+player.jerseyNumber}</strong></article>
            <article><span>PREFERRED FOOT</span><strong>{player.preferredFoot||"Not set"}</strong></article>
            <article><span>HEIGHT</span><strong>{player.height?player.height+" cm":"Not set"}</strong></article>
            <article><span>WEIGHT</span><strong>{player.weight?player.weight+" kg":"Not set"}</strong></article>
            <article><span>DATE OF BIRTH</span><strong>{formatProfileDate(player.dateOfBirth)}</strong></article>
            <article><span>PLAYER SINCE</span><strong>{formatProfileDate(player.createdAt)}</strong></article>
            {player.ovrSnapshot?.matchesPlayed!==undefined&&<article><span>MATCHES PLAYED</span><strong>{player.ovrSnapshot.matchesPlayed}</strong></article>}
            {player.ovrSnapshot?.currentOvr!==null&&player.ovrSnapshot?.currentOvr!==undefined&&<article><span>CURRENT OVR</span><strong>{player.ovrSnapshot.currentOvr}</strong></article>}
          </div>
        </> : <p className="gg-profile-player-empty">Your Matchday account is signed in, but no GG roster player is linked yet. You can still build a local visitor character now; linking a roster player will unlock shared city identity, multiplayer presence and cross-device character sync.</p>}
      </section>
      <section className="gg-world-panel">
        <div className="gg-world-section-title"><span>ORIGINAL GG AVATAR STUDIO</span><h2>Design your footballer</h2><p>This character represents you around the GG website and shared football city.</p></div>
        <div className="gg-world-avatar-card">
          <div className="gg-world-avatar-preview"><PlayerSprite appearance={appearance}/><strong>{avatar.displayName||player?.name||"Your player"}</strong><small>YOUR GG CHARACTER</small></div>
          <form className="gg-world-form" onSubmit={save}>
            <label>Character name<input maxLength="24" value={avatar.displayName||""} onChange={(event)=>setAvatar((v)=>({...v,displayName:event.target.value}))} placeholder={player?.name||"Name your footballer"}/></label>
            <div className="gg-world-select-grid">{Object.entries(editableChoices).map(([key,values])=><label key={key}>{labels[key]}<select value={appearance[key]||defaults.appearance[key]} onChange={(event)=>updateAppearance(key,event.target.value)}>{values.map((value)=><option key={value}>{value}</option>)}</select></label>)}</div>
            <button className="gg-world-primary" disabled={saving}>{saving?"Saving…":linked?"Save character":"Save visitor character"}</button>
          </form>
          <div className="gg-avatar-presets">
            <div><span>YOUR LOOKBOOK</span><strong>Saved character presets · {presets.length}/5</strong></div>
            <div className="gg-avatar-preset-save"><input aria-label="Preset name" maxLength="24" value={presetName} onChange={(event)=>setPresetName(event.target.value)} placeholder="Name this look"/><button type="button" className="gg-world-primary" disabled={presetBusy||presets.length>=5} onClick={savePreset}>Save current look</button></div>
            {presets.length>0?<div className="gg-avatar-preset-list">{presets.map((preset)=><article key={preset._id}><div><PlayerSprite appearance={preset.appearance}/><strong>{preset.name}</strong></div><button type="button" disabled={presetBusy} onClick={()=>applyPreset(preset._id)}>Apply</button><button type="button" disabled={presetBusy} onClick={()=>deletePreset(preset._id)} aria-label={"Delete "+preset.name}>×</button></article>)}</div>:<small className="gg-avatar-presets-empty">Save up to five favourite looks and switch between them whenever you like.</small>}
          </div>
        </div>
      </section>
      <section className="gg-profile-notes"><div><span>YOUR MATCHDAY</span><strong>History that stays yours</strong><small>Your existing player profile, match records and statistics remain part of your account.</small></div><div><span>YOUR ORIGINAL GG</span><strong>A character that follows you</strong><small>Your saved look is shared by your profile and the football city.</small></div></section>
    </>}
    {message&&<p className="gg-world-notice" role="status">{message}</p>}
    <footer className="gg-world-footer">GG MATCHDAY · MY PLAYER PROFILE <span>YOUR FOOTBALL STORY.</span></footer>
  </main>;
}
