import { useEffect, useState } from "react";
import { api } from "../lib/api";
import "./original-gg.css";

const places = [
  { id:"gg-hq", name:"GG Headquarters", kind:"hq", x:900, y:300, desc:"The golden heart of Original GG. Meet the community and explore the trophy hall." },
  { id:"grand-stadium", name:"Grand Stadium", kind:"stadium", x:460, y:570, desc:"The home of matchday nights, club showcases and unforgettable football moments." },
  { id:"training-centre", name:"Training Centre", kind:"training", x:1320, y:540, desc:"Build your routine, log workout counters and chase personal bests." },
  { id:"club-district", name:"Club District", kind:"club", x:390, y:920, desc:"A neighbourhood of club grounds and football homes." },
  { id:"residence-gardens", name:"Residence Gardens", kind:"home", x:1120, y:920, desc:"A home district for GG players, with private interiors." },
  { id:"academy-square", name:"Football Academy", kind:"academy", x:850, y:750, desc:"A place for skill challenges and guided tours." },
  { id:"market-square", name:"Market Square", kind:"market", x:1510, y:840, desc:"The future home of the GG shop and player cosmetics." },
  { id:"garden-park", name:"Garden Park", kind:"park", x:1450, y:280, desc:"A green pocket of the city with paths and benches." }
];
const exercises = [["pushups","Push-ups"],["pullups","Pull-ups"],["squats","Squats"],["planks","Plank holds"]];
const emptyTraining = { pushups:"", pullups:"", squats:"", planks:"" };

function PlayerSprite({ appearance = {} }) {
  const skin = ({deep:"#75432f",dark:"#965c42",medium:"#c1835c",tan:"#d49a70",light:"#e5b891",fair:"#f0c9a8"})[appearance.skinTone] || "#c1835c";
  const hair = ({black:"#171717",brown:"#51301f",blonde:"#e1bd62",red:"#9d3d2e",silver:"#aaaeb9",blue:"#4167b6"})[appearance.hairColor] || "#171717";
  const kit = ({black:"#17191e",white:"#f3f1e8",gold:"#d7ad52",red:"#b6383d",blue:"#2864a2",green:"#34784f",purple:"#71499c",orange:"#c96b32"})[appearance.kitPrimary] || "#17191e";
  return <svg viewBox="0 0 80 118" className="gg-player-sprite" role="img" aria-label="Your pixel footballer">
    <ellipse cx="40" cy="112" rx="22" ry="4" fill="#07100c" opacity=".35"/>
    <path d="M31 76 L29 103 L23 110 L36 112 L42 84 L47 112 L60 110 L51 101 L50 76Z" fill={skin}/>
    <path d="M20 108 L38 108 L38 115 L19 115Z M45 108 L61 108 L65 115 L46 115Z" fill={appearance.bootColor==="gold"?"#d7ad52":appearance.bootColor==="black"?"#171717":"#f5f3eb"}/>
    <path d="M24 39 L17 46 L21 74 L29 75 L30 60 L31 84 L50 84 L51 60 L54 75 L62 73 L64 46 L55 39 L49 36 L31 36Z" fill={kit}/>
    <path d="M31 39 L40 49 L49 39 L46 36 L34 36Z" fill={appearance.kitSecondary==="white"?"#f3f1e8":"#d7ad52"}/>
    <rect x="33" y="22" width="14" height="18" rx="5" fill={skin}/><ellipse cx="40" cy="21" rx="16" ry="18" fill={skin}/>
    <path d="M22 23 Q24 7 40 8 Q56 7 58 23 L54 20 Q40 14 26 21Z" fill={hair}/>
    <rect x="32" y="23" width="3" height="3" fill="#241a16"/><rect x="45" y="23" width="3" height="3" fill="#241a16"/>
    <path d="M36 32 Q40 35 44 32" fill="none" stroke="#71402f" strokeWidth="1.6"/>
  </svg>;
}

function Building({ kind }) {
  const colors = {hq:"#c69a45",stadium:"#758b83",training:"#668b69",market:"#b78b59",park:"#4d8057",club:"#788477",home:"#a68b70",academy:"#7b8f76"};
  return <svg viewBox="0 0 180 125" aria-hidden="true">
    <path d="M12 91 L89 117 L168 87 L89 60Z" fill="#1b2923" opacity=".3"/>
    <path d="M25 57 L89 25 L155 54 L90 86Z" fill={colors[kind]||"#788477"} stroke="#1b3027" strokeWidth="3"/>
    <path d="M25 57 L90 86 L90 111 L25 82Z" fill="#34483e" stroke="#1b3027" strokeWidth="2"/>
    <path d="M90 86 L155 54 L155 79 L90 111Z" fill="#253a31" stroke="#1b3027" strokeWidth="2"/>
    <path d="M49 53 L89 33 L132 53 L90 73Z" fill="#d4b36a" opacity=".42"/>
    <path d="M79 82 L101 73 L101 108 L79 117Z" fill="#17251f"/>
    {kind==="hq" && <path d="M74 28 L89 7 L105 29Z" fill="#e1bd68" stroke="#694f28" strokeWidth="2"/>}
    {kind==="stadium" && <path d="M37 53 Q89 4 143 49" fill="none" stroke="#e4e8dc" strokeWidth="8"/>}
  </svg>;
}

export default function OriginalGGWorld({ onExit }) {
  const [data,setData] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [selected,setSelected] = useState(null);
  const [avatar,setAvatar] = useState({displayName:"",appearance:{skinTone:"medium",hairStyle:"short",hairColor:"black",kitPrimary:"black",kitSecondary:"gold",bootColor:"white"}});
  const [training,setTraining] = useState(emptyTraining);
  const [duration,setDuration] = useState("900");
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState("");
  const [scale,setScale] = useState(.72);
  const [offset,setOffset] = useState({x:0,y:0});
  const [drag,setDrag] = useState(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const result = await api("/world/bootstrap");
      setData(result);
      if (result.avatar) setAvatar(result.avatar);
    } catch (cause) { setError(cause.message || "The city could not load."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const hasAvatar = Boolean(data?.avatar);
  useEffect(() => {
    if (!hasAvatar) return;
    const heartbeat = () => api("/world/presence",{method:"POST",body:{locationId:"city-plaza",x:900,y:600}}).catch(()=>{});
    heartbeat();
    const timer = window.setInterval(heartbeat,30000);
    return () => window.clearInterval(timer);
  },[hasAvatar]);
  const appearance = avatar.appearance || {};
  const mapPlaces = (data?.world?.layout?.locations?.length ? data.world.layout.locations : places).map((p)=>({...p,kind:({headquarters:"hq","club-district":"club",residences:"home"}[p.kind]||p.kind),desc:p.desc||p.description||""}));
  const selectedPlace = mapPlaces.find((p)=>p.id===selected);
  function startPan(event) {
    if (event.button!==undefined && event.button!==0) return;
    setDrag({x:event.clientX,y:event.clientY,ox:offset.x,oy:offset.y});
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePan(event) {
    if (!drag) return;
    setOffset({x:drag.ox+event.clientX-drag.x,y:drag.oy+event.clientY-drag.y});
  }
  function stopPan(){setDrag(null);}
  function changeAppearance(key,value){setAvatar((v)=>({...v,appearance:{...v.appearance,[key]:value}}));}
  async function saveAvatar(event) {
    event.preventDefault(); setSaving(true); setNotice("");
    try { const result=await api("/world/avatar",{method:"PUT",body:avatar}); setAvatar(result.avatar); setNotice("Your player character has been saved."); }
    catch(cause){setNotice(cause.message||"Could not save character.");}
    finally{setSaving(false);}
  }
  async function saveWorkout(event) {
    event.preventDefault(); setSaving(true); setNotice("");
    try {
      const counts=Object.fromEntries(exercises.map(([key])=>[key,Number(training[key]||0)]));
      const result=await api("/world/training/sessions",{method:"POST",body:{sessionId:crypto.randomUUID(),counts,durationSeconds:Number(duration)}});
      setData((v)=>({...v,training:result.profile}));
      setTraining(emptyTraining); setNotice("Workout saved to your training record.");
    } catch(cause){setNotice(cause.message||"Could not save workout.");}
    finally{setSaving(false);}
  }
  function zoom(amount){setScale((v)=>Math.min(1.45,Math.max(.42,Number((v+amount).toFixed(2)))));}
  const liveCount=data && data.presence ? data.presence.length : 0;
  return <main className="gg-world">
    <header className="gg-world-header"><div className="gg-world-brand"><span className="gg-world-crest">GG</span><div><p>THE ORIGINAL GG WORLD</p><h1>Football City</h1></div></div><button className="gg-world-back" onClick={onExit}>← Matchday</button></header>
    <section className="gg-world-intro"><div><span className="gg-world-kicker">ONE CITY. EVERY PLAYER. ONE FOOTBALL COMMUNITY.</span><h2>Welcome to your football kingdom.</h2><p>Explore the city, visit its landmarks and build your place in Original GG.</p></div><div className="gg-world-live"><i/> {liveCount} players in the city</div></section>
    {error && <div className="gg-world-error" role="alert">{error}<button onClick={load}>Try again</button></div>}
    {loading ? <div className="gg-world-loading">Opening the city gates…</div> : <>
      <section className="gg-world-map-shell">
        <div className="gg-world-map-topline"><div><span>THE CITY MAP</span><strong>Original GG · 1800 × 1200</strong></div><div className="gg-world-map-tools"><button onClick={()=>zoom(-.12)} aria-label="Zoom out">−</button><span>{Math.round(scale*100)}%</span><button onClick={()=>zoom(.12)} aria-label="Zoom in">+</button><button onClick={()=>{setScale(.72);setOffset({x:0,y:0});}}>Reset</button></div></div>
        <div className="gg-world-map-viewport" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onWheel={(e)=>{e.preventDefault();zoom(e.deltaY<0?.06:-.06);}} style={{cursor:drag?"grabbing":"grab"}}>
          <svg viewBox="0 0 1800 1200" role="img" aria-label="Interactive isometric football city map">
            <defs><pattern id="gg-grid" width="120" height="60" patternUnits="userSpaceOnUse"><path d="M60 0 L120 30 L60 60 L0 30Z" fill="none" stroke="#d3e0bf" strokeOpacity=".1"/></pattern><linearGradient id="gg-ground" x2="0" y2="1"><stop stopColor="#315c43"/><stop offset="1" stopColor="#1d3e30"/></linearGradient></defs>
            <g transform={"translate("+offset.x+" "+offset.y+") translate(900 600) scale("+scale+") translate(-900 -600)"}>
              <rect width="1800" height="1200" fill="url(#gg-ground)"/><rect width="1800" height="1200" fill="url(#gg-grid)"/>
              <path d="M-80 570 L470 320 L930 540 L1420 290 L1900 510 M-100 900 L420 660 L900 890 L1370 650 L1900 900 M620 -80 L900 240 L1180 390 L1480 610 L1780 790" fill="none" stroke="#172f24" strokeWidth="100" opacity=".8"/>
              <path d="M-80 570 L470 320 L930 540 L1420 290 L1900 510 M-100 900 L420 660 L900 890 L1370 650 L1900 900 M620 -80 L900 240 L1180 390 L1480 610 L1780 790" fill="none" stroke="#938a70" strokeWidth="68" strokeLinecap="round" strokeDasharray="5 8"/>
              <path d="M-80 570 L470 320 L930 540 L1420 290 L1900 510 M-100 900 L420 660 L900 890 L1370 650 L1900 900 M620 -80 L900 240 L1180 390 L1480 610 L1780 790" fill="none" stroke="#e6d8b4" strokeWidth="2" strokeDasharray="18 20" opacity=".65"/>
              {Array.from({length:30},(_,i)=><g key={i} transform={"translate("+(80+(i*197)%1640)+" "+(100+(i*137)%970)+")"}><path d="M0 0 L27 -14 L54 0 L27 15Z" fill="#47784f"/><path d="M27 14 L27 36" stroke="#765b3d" strokeWidth="7"/><circle cx="27" cy="-5" r="22" fill="#3f8050"/><circle cx="17" cy="-12" r="12" fill="#55925b"/></g>)}
              <g transform="translate(460 570)"><path d="M-195 -105 L0 -195 L195 -105 L0 -15Z" fill="#1d362b" stroke="#c5aa70" strokeWidth="5"/><path d="M-145 -107 L0 -174 L145 -107 L0 -40Z" fill="#39814c" stroke="#d6d4b8" strokeWidth="4"/><path d="M-110 -108 L0 -158 L110 -108 L0 -58Z" fill="none" stroke="#e5e8ce" strokeWidth="3"/><path d="M0 -158 L0 -58 M-110 -108 L110 -108" fill="none" stroke="#e5e8ce" strokeWidth="2"/></g>
              {mapPlaces.map((place)=><g key={place.id} transform={"translate("+place.x+" "+place.y+")"} className="gg-map-place" onPointerDown={(e)=>e.stopPropagation()} onClick={()=>setSelected(place.id)} role="button" tabIndex="0" aria-label={"Open "+place.name} onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(place.id);}}}><ellipse cy="45" rx={place.kind==="stadium"?190:125} ry="40" fill="#10291d" opacity=".35"/><g transform="translate(-90 -85)"><Building kind={place.kind}/></g><rect x="-116" y="54" width="232" height="38" rx="19" fill="#12281e" stroke="#d5b76b" strokeOpacity=".65"/><text y="79" textAnchor="middle" fill="#f7f0db" fontSize="19" fontWeight="700">{place.name}</text><circle cy="-84" r="12" fill="#e7c16a" stroke="#263c2b" strokeWidth="5"/></g>)}
              {(data.presence||[]).map((p)=><g key={p.playerId} transform={"translate("+p.x+" "+p.y+")"} pointerEvents="none"><circle cy="-24" r="17" fill="#e5bf68" opacity=".5"/><text y="10" textAnchor="middle" fill="#fff5dd" fontSize="14" stroke="#1b3326" strokeWidth="4" paintOrder="stroke">{p.displayName.slice(0,12)}</text></g>)}
            </g>
          </svg>
        </div>
        <div className="gg-world-map-footer"><span>↔ Drag to explore</span><span>Scroll or + / − to zoom</span><span>Tap a landmark to enter</span></div>
      </section>
      <section className="gg-world-districts"><div className="gg-world-section-title"><span>EXPLORE THE KINGDOM</span><h2>Choose your next stop</h2></div><div className="gg-world-location-grid">{mapPlaces.map((p)=><button key={p.id} className="gg-world-location-card" onClick={()=>setSelected(p.id)}><span className="gg-world-location-icon">{({hq:"♛",stadium:"⚽",training:"✦",club:"♜",home:"⌂",academy:"⚑",market:"◇",park:"♧"})[p.kind]}</span><span><strong>{p.name}</strong><small>{p.desc}</small></span><b>→</b></button>)}</div></section>
      <section className="gg-world-panel"><div className="gg-world-section-title"><span>YOUR FOOTBALL IDENTITY</span><h2>Build your player character</h2><p>A pixel footballer that represents you around the city.</p></div><div className="gg-world-avatar-card"><div className="gg-world-avatar-preview"><PlayerSprite appearance={appearance}/><strong>{avatar.displayName||"Your player"}</strong><small>ORIGINAL GG PLAYER</small></div><form className="gg-world-form" onSubmit={saveAvatar}><label>Character name<input maxLength="24" value={avatar.displayName||""} onChange={(e)=>setAvatar((v)=>({...v,displayName:e.target.value}))} placeholder="Name your footballer"/></label><div className="gg-world-select-grid">
        <label>Skin tone<select value={appearance.skinTone||"medium"} onChange={(e)=>changeAppearance("skinTone",e.target.value)}>{["deep","dark","medium","tan","light","fair"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Hair style<select value={appearance.hairStyle||"short"} onChange={(e)=>changeAppearance("hairStyle",e.target.value)}>{["short","fade","curly","long","afro","mohawk","bald"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Hair colour<select value={appearance.hairColor||"black"} onChange={(e)=>changeAppearance("hairColor",e.target.value)}>{["black","brown","blonde","red","silver","blue"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Kit colour<select value={appearance.kitPrimary||"black"} onChange={(e)=>changeAppearance("kitPrimary",e.target.value)}>{["black","white","gold","red","blue","green","purple","orange"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Kit trim<select value={appearance.kitSecondary||"gold"} onChange={(e)=>changeAppearance("kitSecondary",e.target.value)}>{["black","white","gold","red","blue","green","purple","orange"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Boots<select value={appearance.bootColor||"white"} onChange={(e)=>changeAppearance("bootColor",e.target.value)}>{["black","white","gold","red","blue","green","orange"].map(v=><option key={v}>{v}</option>)}</select></label>
      </div><button className="gg-world-primary" disabled={saving}>{saving?"Saving…":"Save player character"}</button></form></div></section>
      <section className="gg-world-panel"><div className="gg-world-section-title"><span>TRAINING GROUNDS</span><h2>Your training record</h2><p>Log completed sets and track your totals. Entries are validated and saved by the server.</p></div><div className="gg-world-training-grid"><form className="gg-world-training-form" onSubmit={saveWorkout}><h3>Record a workout</h3><div className="gg-world-counter-grid">{exercises.map(([key,label])=><label key={key}>{label}<input type="number" min="0" max="1000" step="1" value={training[key]} onChange={(e)=>setTraining((v)=>({...v,[key]:e.target.value}))} placeholder="0"/></label>)}</div><label className="gg-world-duration">Duration (seconds)<input type="number" min="1" max="28800" value={duration} onChange={(e)=>setDuration(e.target.value)}/></label><button className="gg-world-primary" disabled={saving}>{saving?"Saving…":"Save workout"}</button></form><div className="gg-world-training-stats"><h3>All-time counters</h3><div className="gg-world-stat-grid">{exercises.map(([key,label])=><div key={key}><span>{label}</span><strong>{data.training?.totals?.[key]||0}</strong><small>Best {data.training?.personalBests?.[key]||0}</small></div>)}</div><div className="gg-world-total"><span>TOTAL REPS</span><strong>{data.training?.totals?.totalReps||0}</strong><small>{data.training?.totals?.sessions||0} workouts logged</small></div></div></div></section>
      {notice && <p className="gg-world-notice" role="status">{notice}</p>}
    </>}
    {selectedPlace && <div className="gg-world-modal-backdrop" onClick={()=>setSelected(null)}><section className="gg-world-building-modal" role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()}><button className="gg-world-modal-close" onClick={()=>setSelected(null)} aria-label="Close">×</button><span>ORIGINAL GG LANDMARK</span><div className="gg-world-modal-art"><Building kind={selectedPlace.kind}/></div><h2>{selectedPlace.name}</h2><p>{selectedPlace.desc}</p>{selectedPlace.kind==="training" ? <button className="gg-world-primary" onClick={()=>{setSelected(null);document.querySelector(".gg-world-training-form")?.scrollIntoView({behavior:"smooth"});}}>Open training counters</button> : <p className="gg-world-coming">Detailed building interiors are in the next build phase.</p>}</section></div>}
    <footer className="gg-world-footer">GG MATCHDAY · ORIGINAL GG WORLD <span>Built for the players, by the players.</span></footer>
  </main>;
}
