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
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  return (
    <main className={`gg-welcome-screen gg-welcome-image-screen${posterLoaded || posterFailed ? " is-ready" : ""}`}>
      <div className={`gg-welcome-poster-frame${posterLoaded ? " is-loaded" : ""}${!posterLoaded && !posterFailed ? " is-loading" : ""}${posterFailed ? " has-error" : ""}`}>
        {!posterFailed && (
          <picture className="gg-welcome-poster-picture">
            <source
              media="(max-aspect-ratio: 3 / 4)"
              srcSet="/enter-matchday-mobile.png"
            />
            <img
              className="gg-welcome-poster"
              src="/enter-matchday.png"
              alt="GG Matchday cinematic football poster with players in a floodlit stadium."
              draggable={false}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onLoad={() => setPosterLoaded(true)}
              onError={() => {
                setPosterLoaded(false);
                setPosterFailed(true);
              }}
            />
          </picture>
        )}

        {posterFailed && (
          <div className="gg-welcome-poster-fallback" role="status">
            <p className="gg-welcome-poster-brand">GG MATCHDAY</p>
            <p className="gg-welcome-poster-help">
              Add <code>public/enter-matchday.png</code> and <code>public/enter-matchday-mobile.png</code> to display the desktop and mobile welcome artwork.
            </p>
          </div>
        )}

        <button
          type="button"
          className={`gg-welcome-image-button${posterLoaded ? " is-image-overlay" : ""}`}
          onClick={onEnter}
          aria-label="Enter Matchday"
          title="Enter Matchday"
        >
          {posterLoaded ? (
            <span className="gg-welcome-sr-only">Enter Matchday</span>
          ) : (
            <>ENTER MATCHDAY <span aria-hidden="true">→</span></>
          )}
        </button>
      </div>

    </main>
  );
}
