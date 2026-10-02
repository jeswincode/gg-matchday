import {useEffect,useState} from "react";

function GGMark(){
  return <div className="gg-refined-mark" aria-hidden="true">
    <span className="gg-refined-mark-ring"/>
    <span className="gg-refined-mark-core">GG</span>
  </div>;
}

function GGWelcomeEmblem(){
  return <div className="gg-welcome-emblem" aria-hidden="true">
    <svg viewBox="0 0 920 700" role="presentation" focusable="false">
      <defs>
        <linearGradient id="ggWelcomeGold" x1="0%" y1="8%" x2="100%" y2="92%">
          <stop offset="0%" stopColor="#fff0a8"/>
          <stop offset="18%" stopColor="#f7d569"/>
          <stop offset="46%" stopColor="#dcae3d"/>
          <stop offset="72%" stopColor="#b77c22"/>
          <stop offset="100%" stopColor="#f6d36b"/>
        </linearGradient>
        <linearGradient id="ggWelcomeGoldBright" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff4b8"/>
          <stop offset="45%" stopColor="#f6cd4f"/>
          <stop offset="100%" stopColor="#c48927"/>
        </linearGradient>
        <radialGradient id="ggWelcomeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f7d36a" stopOpacity=".16"/>
          <stop offset="60%" stopColor="#f7d36a" stopOpacity=".04"/>
          <stop offset="100%" stopColor="#f7d36a" stopOpacity="0"/>
        </radialGradient>
      </defs>

      <circle cx="460" cy="350" r="290" fill="url(#ggWelcomeGlow)"/>
      <circle className="gg-emblem-ring-soft" cx="460" cy="350" r="318"/>
      <circle className="gg-emblem-ring" cx="460" cy="350" r="288"/>
      <circle className="gg-emblem-ring-inner" cx="460" cy="350" r="250"/>

      <path
        className="gg-emblem-logo"
        d="M424 252 H278 C179 252 113 322 113 418 C113 517 180 582 280 582 H411 V474 H282 C241 474 216 452 216 417 C216 382 242 356 281 356 H353 M496 252 H642 C741 252 807 322 807 418 C807 517 740 582 640 582 H509 V474 H638 C679 474 704 452 704 417 C704 382 678 356 639 356 H567"
      />

      <path
        className="gg-emblem-accent"
        d="M621 82 L742 197 L816 116 L779 284 L704 223 Z"
      />
      <path
        className="gg-emblem-accent"
        d="M299 618 L176 502 L102 583 L141 415 L215 477 Z"
      />

      <path className="gg-emblem-accent-line" d="M612 64 L732 182 L806 112"/>
      <path className="gg-emblem-accent-line" d="M307 636 L188 517 L113 589"/>

      <circle className="gg-emblem-node" cx="781" cy="175" r="8"/>
      <circle className="gg-emblem-node" cx="139" cy="554" r="7"/>
      <circle className="gg-emblem-node" cx="754" cy="122" r="4"/>
      <circle className="gg-emblem-node" cx="166" cy="610" r="4"/>
    </svg>
  </div>;
}

export function StartupScreen({authLoading,onComplete}){
  const [minimumReady,setMinimumReady]=useState(false);
  const [phase,setPhase]=useState(0);

  useEffect(()=>{
    const phaseTimer=setTimeout(()=>setPhase(1),420);
    const doneTimer=setTimeout(()=>setMinimumReady(true),1100);
    return ()=>{clearTimeout(phaseTimer);clearTimeout(doneTimer);};
  },[]);

  useEffect(()=>{
    if(minimumReady && !authLoading) onComplete();
  },[minimumReady,authLoading,onComplete]);

  const label=authLoading
    ? (phase===0 ? "Checking your session" : "Preparing your Matchday")
    : "Matchday ready";

  return <main className="gg-startup" aria-live="polite">
    <div className="gg-startup-field" aria-hidden="true">
      <span className="gg-startup-pitch-line gg-startup-pitch-line-a"/>
      <span className="gg-startup-pitch-line gg-startup-pitch-line-b"/>
      <span className="gg-startup-ball">⚽</span>
    </div>

    <div className="gg-startup-content">
      <GGMark/>
      <p className="gg-refined-eyebrow">GG MATCHDAY</p>
      <h1>Football. Numbers. Rivalry.</h1>
      <p className="gg-startup-status">{label}<span className="gg-loading-dots" aria-hidden="true"><i/> <i/> <i/></span></p>
      <div className="gg-startup-meter" aria-hidden="true"><span className={minimumReady&&!authLoading?"ready":""}/></div>
    </div>
  </main>;
}

export function LoginDashboard({onSignIn,onGuest,busy,message}){
  return <main className="gg-entry-screen">
    <section className="gg-entry-shell">
      <div className="gg-entry-visual" aria-hidden="true">
        <div className="gg-entry-glow"/>
        <GGMark/>
        <span className="gg-entry-orbit gg-entry-orbit-a"/>
        <span className="gg-entry-orbit gg-entry-orbit-b"/>
      </div>

      <div className="gg-entry-copy">
        <p className="gg-refined-eyebrow">WELCOME TO GG MATCHDAY</p>
        <h1>Your football journey starts here.</h1>
        <p>Track matches, build your record, compare players, and see where your game takes you.</p>
      </div>

      {message&&<div className="gg-entry-error" role="alert">{message}</div>}

      <div className="gg-entry-actions">
        <button type="button" className="gg-entry-google" onClick={onSignIn} disabled={busy}>
          <span className="gg-google-g" aria-hidden="true">G</span>
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        <button type="button" className="gg-entry-guest" onClick={onGuest} disabled={busy}>
          Explore as Guest
        </button>
      </div>

      <p className="gg-entry-note">Guest mode is read-only. Sign in to access your Matchday account.</p>
    </section>
  </main>;
}

export function WelcomeScreen({user,onEnter}){
  const name=user?.displayName||user?.email?.split("@")[0]||"Player";
  return <main className="gg-welcome-screen">
    <video
      className="gg-welcome-video"
      src="/ggmatchdaybg.mp4"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    />
    <div className="gg-welcome-video-overlay" aria-hidden="true"/>
    <section className="gg-welcome-shell">
      <GGWelcomeEmblem/>
      <div className="gg-welcome-content">
        <div className="gg-welcome-avatar">
          {user?.photoURL?<img src={user.photoURL} alt=""/>:<span>{name.charAt(0).toUpperCase()}</span>}
        </div>
        <p className="gg-refined-eyebrow">MATCHDAY READY</p>
        <h1>Welcome back, {name.split(" ")[0]} <span aria-hidden="true">👋</span></h1>
        <p>Your Matchday is ready. Step in and keep your football story moving.</p>
        <button type="button" className="gg-enter-button" onClick={onEnter}>
          ENTER MATCHDAY <span aria-hidden="true">→</span>
        </button>
        <div className="gg-welcome-lines" aria-hidden="true"><span/><span/><span/></div>
      </div>
    </section>
  </main>;
}
