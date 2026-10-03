import {useEffect,useState} from "react";

function GGMark(){
  return <div className="gg-refined-mark" aria-hidden="true">
    <span className="gg-refined-mark-ring"/>
    <span className="gg-refined-mark-core">GG</span>
  </div>;
}

function GGWelcomeEmblem(){
  return <div className="gg-welcome-emblem" aria-hidden="true">
    <svg viewBox="0 0 920 760" role="presentation" focusable="false">
      <defs>
        <linearGradient id="ggWelcomeGold" x1="8%" y1="2%" x2="92%" y2="98%">
          <stop offset="0%" stopColor="#fff2ad"/>
          <stop offset="18%" stopColor="#f8d76d"/>
          <stop offset="46%" stopColor="#dcae3f"/>
          <stop offset="74%" stopColor="#b57a21"/>
          <stop offset="100%" stopColor="#f5d36b"/>
        </linearGradient>
        <linearGradient id="ggWelcomeEdge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff9cf"/>
          <stop offset="48%" stopColor="#f1c64f"/>
          <stop offset="100%" stopColor="#9f6820"/>
        </linearGradient>
        <radialGradient id="ggWelcomeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f7d36a" stopOpacity=".10"/>
          <stop offset="60%" stopColor="#f7d36a" stopOpacity=".025"/>
          <stop offset="100%" stopColor="#f7d36a" stopOpacity="0"/>
        </radialGradient>
      </defs>

      <circle cx="460" cy="380" r="318" fill="url(#ggWelcomeGlow)"/>
      <circle className="gg-emblem-ring-soft" cx="460" cy="380" r="338"/>
      <circle className="gg-emblem-ring" cx="460" cy="380" r="306"/>
      <circle className="gg-emblem-ring-inner" cx="460" cy="380" r="270"/>

      <path
        className="gg-emblem-logo-shadow"
        d="M436 270 H302 C198 270 126 344 126 449 C126 555 199 630 302 630 H421 V515 H307 C261 515 232 489 232 450 C232 410 263 380 307 380 H363"
      />
      <path
        className="gg-emblem-logo-shadow"
        d="M484 270 H618 C722 270 794 344 794 449 C794 555 721 630 618 630 H499 V515 H613 C659 515 688 489 688 450 C688 410 657 380 613 380 H557"
      />

      <path
        className="gg-emblem-logo"
        d="M436 270 H302 C198 270 126 344 126 449 C126 555 199 630 302 630 H421 V515 H307 C261 515 232 489 232 450 C232 410 263 380 307 380 H363"
      />
      <path
        className="gg-emblem-logo"
        d="M484 270 H618 C722 270 794 344 794 449 C794 555 721 630 618 630 H499 V515 H613 C659 515 688 489 688 450 C688 410 657 380 613 380 H557"
      />

      <path className="gg-emblem-accent" d="M606 126 L720 240 L797 163 L752 323 L681 260 Z"/>
      <path className="gg-emblem-accent" d="M314 634 L200 520 L123 597 L168 437 L239 500 Z"/>
      <path className="gg-emblem-accent-line" d="M596 108 L709 222 L786 148"/>
      <path className="gg-emblem-accent-line" d="M324 651 L211 538 L134 612"/>

      <circle className="gg-emblem-node" cx="735" cy="198" r="7"/>
      <circle className="gg-emblem-node" cx="182" cy="566" r="7"/>
      <circle className="gg-emblem-node" cx="710" cy="148" r="4"/>
      <circle className="gg-emblem-node" cx="205" cy="622" r="4"/>
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
