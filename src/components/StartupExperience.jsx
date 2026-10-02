import {useEffect,useState} from "react";

function GGMark(){
  return <div className="gg-refined-mark" aria-hidden="true">
    <span className="gg-refined-mark-ring"/>
    <span className="gg-refined-mark-core">GG</span>
  </div>;
}

function GGWelcomeEmblem(){
  return <div className="gg-welcome-emblem" aria-hidden="true">
    <svg viewBox="0 0 1000 900" role="presentation" focusable="false">
      <defs>
        <linearGradient id="ggWelcomeGold" x1="12%" y1="4%" x2="88%" y2="96%">
          <stop offset="0%" stopColor="#fff1ad"/>
          <stop offset="18%" stopColor="#f7d56b"/>
          <stop offset="44%" stopColor="#dcae3f"/>
          <stop offset="70%" stopColor="#ae7420"/>
          <stop offset="100%" stopColor="#f6d46d"/>
        </linearGradient>
        <linearGradient id="ggWelcomeEdge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff7c9"/>
          <stop offset="42%" stopColor="#f4ca4e"/>
          <stop offset="100%" stopColor="#b8781f"/>
        </linearGradient>
        <radialGradient id="ggWelcomeCenterGlow" cx="50%" cy="48%" r="50%">
          <stop offset="0%" stopColor="#f7d36a" stopOpacity=".10"/>
          <stop offset="58%" stopColor="#f7d36a" stopOpacity=".025"/>
          <stop offset="100%" stopColor="#f7d36a" stopOpacity="0"/>
        </radialGradient>
      </defs>

      <circle cx="500" cy="450" r="348" fill="url(#ggWelcomeCenterGlow)"/>
      <circle className="gg-emblem-ring-soft" cx="500" cy="450" r="366"/>
      <circle className="gg-emblem-ring" cx="500" cy="450" r="330"/>
      <circle className="gg-emblem-ring-inner" cx="500" cy="450" r="292"/>

      <path
        className="gg-emblem-logo"
        d="M455 296 H293 C190 296 121 362 121 452 C121 547 191 615 294 615 H432 V514 H301 C260 514 232 492 232 453 C232 414 261 384 301 384 H365"
      />
      <path
        className="gg-emblem-logo"
        d="M545 296 H707 C810 296 879 362 879 452 C879 547 809 615 706 615 H568 V514 H699 C740 514 768 492 768 453 C768 414 739 384 699 384 H635"
      />

      <path className="gg-emblem-accent" d="M656 142 L780 258 L865 168 L816 347 L730 272 Z"/>
      <path className="gg-emblem-accent" d="M344 758 L220 642 L135 732 L184 553 L270 628 Z"/>

      <path className="gg-emblem-accent-line" d="M648 124 L767 241 L852 154"/>
      <path className="gg-emblem-accent-line" d="M352 776 L233 659 L148 744"/>

      <circle className="gg-emblem-node" cx="802" cy="213" r="8"/>
      <circle className="gg-emblem-node" cx="191" cy="683" r="8"/>
      <circle className="gg-emblem-node" cx="775" cy="160" r="4"/>
      <circle className="gg-emblem-node" cx="219" cy="742" r="4"/>
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
