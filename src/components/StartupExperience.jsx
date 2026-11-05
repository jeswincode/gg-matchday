import {useEffect,useState} from "react";

function GGMark(){
  return <div className="gg-refined-mark" aria-hidden="true">
    <span className="gg-refined-mark-ring"/>
    <span className="gg-refined-mark-core">GG</span>
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

export function WelcomeScreen({ onEnter }) {
  useEffect(() => {
    function handleGlobalEnter(event) {
      if (event.key !== "Enter" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)
      )) return;
      event.preventDefault();
      onEnter();
    }
    window.addEventListener("keydown", handleGlobalEnter);
    return () => window.removeEventListener("keydown", handleGlobalEnter);
  }, [onEnter]);

  return <main className="gg-welcome-screen gg-welcome-coded-screen">
    <div className="gg-welcome-scene" aria-hidden="true">
      <div className="gg-welcome-lights gg-welcome-lights-left"/>
      <div className="gg-welcome-lights gg-welcome-lights-right"/>
      <svg className="gg-welcome-stadium-art" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="gg-welcome-sky" x2="0" y2="1"><stop stopColor="#101711"/><stop offset=".55" stopColor="#20382a"/><stop offset="1" stopColor="#0a120d"/></linearGradient>
          <linearGradient id="gg-welcome-pitch" x2="0" y2="1"><stop stopColor="#285c3b"/><stop offset="1" stopColor="#0e281a"/></linearGradient>
          <radialGradient id="gg-welcome-glow"><stop stopColor="#f2d58b" stopOpacity=".3"/><stop offset="1" stopColor="#f2d58b" stopOpacity="0"/></radialGradient>
        </defs>
        <rect width="1600" height="1000" fill="url(#gg-welcome-sky)"/>
        <ellipse cx="800" cy="470" rx="820" ry="410" fill="url(#gg-welcome-glow)"/>
        <path d="M-100 490 Q800 -80 1700 490 L1700 690 Q800 270 -100 690Z" fill="#17261d" stroke="#a98746" strokeOpacity=".45" strokeWidth="5"/>
        <path d="M-100 530 Q800 80 1700 530 L1700 610 Q800 180 -100 610Z" fill="#263d2d"/>
        {Array.from({length:34},(_,i)=><path key={i} d={"M"+(i*50-30)+" 390 L"+(i*50+5)+" 525"} stroke={i%2?"#d7bd7a":"#dce5d3"} strokeOpacity=".13" strokeWidth="9"/>)}
        <path d="M0 650 Q800 420 1600 650 L1600 1000 L0 1000Z" fill="url(#gg-welcome-pitch)"/>
        <path d="M0 650 Q800 420 1600 650" fill="none" stroke="#d9e3ca" strokeOpacity=".42" strokeWidth="4"/>
        <path d="M800 570 L800 1000 M0 790 Q800 650 1600 790" fill="none" stroke="#e5e9d7" strokeOpacity=".28" strokeWidth="3"/>
        <ellipse cx="800" cy="790" rx="175" ry="72" fill="none" stroke="#e5e9d7" strokeOpacity=".32" strokeWidth="3"/>
        <path d="M540 675 L540 1000 M1060 675 L1060 1000" stroke="#e5e9d7" strokeOpacity=".15" strokeWidth="2"/>
        <g fill="#e9d6a1" opacity=".45"><circle cx="800" cy="740" r="5"/><circle cx="260" cy="700" r="4"/><circle cx="1340" cy="700" r="4"/></g>
        <g stroke="#d9c18b" strokeWidth="5" opacity=".35"><path d="M230 470 L230 650 M1370 470 L1370 650"/><path d="M200 470 L260 470 M1340 470 L1400 470"/></g>
        <g fill="#d9b96d" opacity=".8"><path d="M180 0 L245 0 L430 520 L360 520Z" opacity=".08"/><path d="M1350 0 L1415 0 L1240 520 L1170 520Z" opacity=".08"/></g>
      </svg>
      <div className="gg-welcome-ball">⚽</div>
      <div className="gg-welcome-silhouette gg-welcome-player-one"/>
      <div className="gg-welcome-silhouette gg-welcome-player-two"/>
    </div>
    <header className="gg-welcome-topbar">
      <div className="gg-welcome-brand"><GGMark/><span>GG MATCHDAY</span></div>
      <span className="gg-welcome-season">YOUR FOOTBALL STORY · V4</span>
    </header>
    <section className="gg-welcome-content">
      <p className="gg-welcome-kicker"><span/> THE PITCH IS YOURS</p>
      <h1>ENTER<br/><em>MATCHDAY.</em></h1>
      <p className="gg-welcome-lead">Your matches. Your players. Your legacy.</p>
      <p className="gg-welcome-description">Step into the home of your football story. Relive the big moments, follow the numbers, build your club and explore a world made for the GG community.</p>
      <button type="button" className="gg-welcome-enter" onClick={onEnter}><span>ENTER MATCHDAY</span><b>→</b></button>
      <div className="gg-welcome-quick-notes">
        <div><span>01</span><strong>THE ARCHIVE</strong><small>Matches, goals and history.</small></div>
        <div><span>02</span><strong>THE PLAYERS</strong><small>Profiles, rankings and rivalries.</small></div>
        <div><span>03</span><strong>THE CLUBS</strong><small>Squads, grounds and competition.</small></div>
      </div>
    </section>
    <aside className="gg-welcome-side-note"><span>THE ORIGINAL GG WORLD</span><strong>A new football city is taking shape.</strong><small>Explore the map, customise your player and make your mark.</small></aside>
    <footer className="gg-welcome-footer"><span>GG MATCHDAY</span><span>BUILT AROUND YOUR GAME.</span><span>YOUR V3 HISTORY STAYS WITH YOU.</span></footer>
  </main>;
}
