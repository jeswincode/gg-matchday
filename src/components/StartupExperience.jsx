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

export function LoginDashboard({
  onSignIn,
  onEmailSignIn,
  onCreateAccount,
  onPasswordReset,
  onGuest,
  busy,
  message,
}) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const createAccount = mode === "create";

  async function submit(event) {
    event.preventDefault();
    setFormMessage("");
    if (!email.trim() || !password) return;
    if (password.length < 6) {
      setFormMessage("Use a password with at least 6 characters.");
      return;
    }
    await (createAccount ? onCreateAccount : onEmailSignIn)?.(email.trim(), password);
  }

  async function resetPassword() {
    setFormMessage("");
    if (!email.trim()) {
      setFormMessage("Enter your email address first, then choose Forgot password.");
      return;
    }
    const result = await onPasswordReset?.(email.trim());
    if (result !== false) setFormMessage("Password reset instructions have been sent if the account exists.");
  }

  return <main className="gg-entry-screen">
    <section className="gg-entry-shell">
      <div className="gg-entry-visual" aria-hidden="true">
        <div className="gg-entry-glow"/>
        <GGMark/>
        <span className="gg-entry-orbit gg-entry-orbit-a"/>
        <span className="gg-entry-orbit gg-entry-orbit-b"/>
      </div>

      <div className="gg-entry-copy">
        <p className="gg-refined-eyebrow">THE FOOTBALL UNIVERSE</p>
        <h1>Your football journey starts here.</h1>
        <p>One GG account. Multiple football Worlds. Your own player identity and football history in every community you join.</p>
      </div>

      {(message || formMessage) && (
        <div className="gg-entry-error" role="alert">{formMessage || message}</div>
      )}

      <div className="gg-entry-auth-mode" role="tablist" aria-label="Account access">
        <button
          type="button"
          role="tab"
          aria-selected={!createAccount}
          className={!createAccount ? "active" : ""}
          onClick={() => { setMode("signin"); setFormMessage(""); }}
        >Sign in</button>
        <button
          type="button"
          role="tab"
          aria-selected={createAccount}
          className={createAccount ? "active" : ""}
          onClick={() => { setMode("create"); setFormMessage(""); }}
        >Create account</button>
      </div>

      <form className="gg-entry-email-form" onSubmit={submit}>
        <label>
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete={createAccount ? "new-password" : "current-password"}
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </label>
        {!createAccount && (
          <button type="button" className="gg-entry-forgot" onClick={resetPassword} disabled={busy}>
            Forgot password?
          </button>
        )}
        <button type="submit" className="gg-entry-email-submit" disabled={busy || !email.trim() || password.length < 6}>
          {busy ? "Please wait…" : createAccount ? "Create your GG account" : "Sign in with email"}
        </button>
      </form>

      <div className="gg-entry-divider"><span>OR</span></div>
      <div className="gg-entry-actions">
        <button type="button" className="gg-entry-google" onClick={onSignIn} disabled={busy}>
          <span className="gg-google-g" aria-hidden="true">G</span>
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        <button type="button" className="gg-entry-guest" onClick={onGuest} disabled={busy}>
          Explore the Global Map as Guest
        </button>
      </div>

      <p className="gg-entry-note">Guests can explore public Worlds. Sign in to request membership, create a World and build your player profile.</p>
    </section>
  </main>;
}

export function WelcomeScreen({ onEnter }) {
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    function handleGlobalEnter(event) {
      if (event.key !== "Enter" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )) return;

      event.preventDefault();
      onEnter();
    }

    window.addEventListener("keydown", handleGlobalEnter);
    return () => window.removeEventListener("keydown", handleGlobalEnter);
  }, [onEnter]);

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
          className="gg-welcome-image-button"
          onClick={onEnter}
          aria-label="Enter Matchday"
        >
          <span className="gg-welcome-sr-only">
            Enter Matchday. Click anywhere on the poster or press Enter to continue.
          </span>
        </button>
      </div>
    </main>
  );
}
