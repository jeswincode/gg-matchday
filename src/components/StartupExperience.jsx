import {useEffect,useState} from "react";

function GGMark({ monogram = "GG" }){
  return <div className="gg-refined-mark" aria-hidden="true">
    <span className="gg-refined-mark-ring"/>
    <span className="gg-refined-mark-core">{monogram}</span>
  </div>;
}

export function StartupScreen({authLoading,onComplete,brand}){
  const [minimumReady,setMinimumReady]=useState(false);
  const [sessionWaitElapsed,setSessionWaitElapsed]=useState(false);

  useEffect(()=>{
    const introTimer=setTimeout(()=>setMinimumReady(true),550);
    const sessionTimer=setTimeout(()=>setSessionWaitElapsed(true),1800);
    return ()=>{clearTimeout(introTimer);clearTimeout(sessionTimer);};
  },[]);

  const ready=minimumReady && (!authLoading || sessionWaitElapsed);
  useEffect(()=>{
    if(ready) onComplete();
  },[ready,onComplete]);

  const label=ready ? "Matchday ready" : "Preparing your Matchday";

  return <main className="gg-startup" aria-live="polite">
    <div className="gg-startup-field" aria-hidden="true">
      <span className="gg-startup-pitch-line gg-startup-pitch-line-a"/>
      <span className="gg-startup-pitch-line gg-startup-pitch-line-b"/>
      <span className="gg-startup-ball">⚽</span>
    </div>

    <div className="gg-startup-content">
      <GGMark monogram={brand?.monogram}/>
      <p className="gg-refined-eyebrow">{brand?.name || "GG MATCHDAY"}</p>
      <h1>Football. Numbers. Rivalry.</h1>
      <p className="gg-startup-status">{label}<span className="gg-loading-dots" aria-hidden="true"><i/> <i/> <i/></span></p>
      <div className="gg-startup-meter" aria-hidden="true"><span className={ready?"ready":""}/></div>
    </div>
  </main>;
}

export function LoginDashboard({onSignIn,onGuest,busy,signingIn,message}){
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
          {signingIn ? "Opening Google…" : busy ? "Checking your session…" : "Continue with Google"}
        </button>
        <button type="button" className="gg-entry-guest" onClick={onGuest} disabled={signingIn}>
          {busy && !signingIn ? "Open Matchday" : "Explore as Guest"}
        </button>
      </div>

      <p className="gg-entry-note">{busy && !signingIn
        ? "You can browse while we finish checking your account."
        : "Guest mode is read-only. Sign in to access your Matchday account."}</p>
    </section>
  </main>;
}

const introVideo = import.meta.env.VITE_MATCHDAY_INTRO_VIDEO;

function IntroBackground({ fallback }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [reduceMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const source = introVideo || fallback;
  if (!source || videoFailed || reduceMotion) return null;
  return (
    <video
      className="gg-intro-video"
      src={source}
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
      onError={() => setVideoFailed(true)}
    />
  );
}

export function WelcomeScreen({ onEnter, background = false, brand }) {
  useEffect(() => {
    if (background) return;
    function handleGlobalEnter(event) {
      if (event.key !== "Enter" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target !== document.body && event.target !== document.documentElement) return;

      event.preventDefault();
      onEnter();
    }

    window.addEventListener("keydown", handleGlobalEnter);
    return () => window.removeEventListener("keydown", handleGlobalEnter);
  }, [onEnter, background]);

  return (
    <main className="gg-matchday-intro" aria-hidden={background || undefined} inert={background}>
      <IntroBackground fallback={brand && "/ggmatchdaybg.mp4"} />
      {brand && <span className="ballers-intro-wordmark">{brand.name}</span>}
      <button type="button" className="gg-intro-desktop-button" onClick={onEnter}>
        <span>PRESS TO CONTINUE</span>
      </button>
    </main>
  );
}

export function MobileFullscreenScreen({ onContinue }) {
  const [status, setStatus] = useState("ready");

  async function enterFullscreen() {
    setStatus("opening");
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setStatus("unavailable");
      return;
    }
    onContinue();
  }

  const unavailable = status === "unavailable";
  const opening = status === "opening";

  return (
    <main className="gg-matchday-intro gg-matchday-intro--mobile">
      <IntroBackground />
      <section className="gg-fullscreen-prompt" aria-label="Matchday display mode">
        <p id="gg-fullscreen-description">
          For the best Matchday experience, go fullscreen to give the pitch and match tools more room.
        </p>
        <button
          type="button"
          className="gg-fullscreen-button"
          onClick={unavailable ? onContinue : enterFullscreen}
          disabled={opening}
          aria-describedby={unavailable ? "gg-fullscreen-status" : "gg-fullscreen-description"}
        >
          {unavailable ? "Continue in browser" : opening ? "Opening fullscreen…" : "Enter Fullscreen"}
        </button>
        {unavailable && (
          <p id="gg-fullscreen-status" role="status">Fullscreen is unavailable here. You can still use all Matchday features.</p>
        )}
      </section>
    </main>
  );
}
