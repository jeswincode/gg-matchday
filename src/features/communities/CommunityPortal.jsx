import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { auth, googleProvider } from "../../firebase";
import { invalidateResources, setMatchdayWorkspace } from "../../lib/api";
import CommunityForm from "./CommunityForm";
import CommunityAccess from "./CommunityAccess";
import FootballIdentity from "./FootballIdentity";
import PreviousSubmissions from "./PreviousSubmissions";
import Modal from "../../components/Modal";
import { StartupScreen, WelcomeScreen } from "../../components/StartupExperience";
import { WorkspaceBrand, foundingBrand, platformBrand } from "./WorkspaceBrand.jsx";
import { communityPages, communityRequest, submitCommunity, validCommunityCode } from "./communityApi";
import "./communities.css";

const testIdentity = import.meta.env.VITE_E2E_TEST_AUTH_SECRET &&
  new URLSearchParams(window.location.search).get("e2eRole") !== "guest";
const redirectErrors = new Set(["auth/popup-blocked", "auth/popup-timeout",
  "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"]);

function initialTheme() {
  try { return localStorage.getItem("gg-theme") === "golden" ? "golden" : "dark"; }
  catch { return "dark"; }
}

function visibleRequest() {
  const id = new URLSearchParams(window.location.search).get("joinCommunity") || "";
  return validCommunityCode(id) ? id : "";
}

function requestedWorkspace() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("community");
  return validCommunityCode(id) ? id : (params.has("tab") || params.has("view") ? "founding" : null);
}

function ActiveWorkspace({ brand, community, children }) {
  useLayoutEffect(() => {
    setMatchdayWorkspace(brand.founding ? null : community.id);
    return () => { setMatchdayWorkspace(null); };
  }, [brand.founding, community.id]);
  return <WorkspaceBrand.Provider value={brand}>
    <div className="community-app-brand" style={{ "--workspace-monogram": JSON.stringify(brand.monogram) }}>{children}</div>
  </WorkspaceBrand.Provider>;
}

function CommunityHeader({ title, theme, setTheme, actions }) {
  return <header className="topbar community-topbar">
    <div><span className="ballers-wordmark">ballers.</span><h1>{title}</h1></div>
    <div className="community-actions">
      <div className="gg-theme" role="group" aria-label="Theme">
        <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Dark</button>
        <button type="button" aria-pressed={theme === "golden"} onClick={() => setTheme("golden")}>Gold</button>
      </div>
      {actions}
    </div>
  </header>;
}

function MembershipForms({ identity, requestId, refresh, enter }) {
  async function requestAccess(id) {
    if (!validCommunityCode(id)) throw new Error("Enter a valid community ID or join request link.");
    const result = await submitCommunity("/" + id + "/join", {});
    if (result.status === "approved") refresh();
    return {
      approved: "You already have access to " + result.name + ".",
      pending: "Request sent to " + result.name + ".",
      declined: "Your request was declined by " + result.name + ".",
    }[result.status];
  }

  return <div className="community-grid">
    <section className="card community-panel">
      <h2>Create a community</h2>
      <CommunityForm label="Create community" save={async (data, key) => {
        const created = await submitCommunity("/", { name: data.get("name") }, key);
        enter(created);
        refresh();
      }}>
        <label>Community name<input name="name" required maxLength={100} /></label>
      </CommunityForm>
    </section>
    <section className="card community-panel">
      <h2>Join a community</h2>
      <CommunityForm label="Join with code" save={async data => {
        const [id, token, extra] = String(data.get("code")).trim().split(".");
        if (!validCommunityCode(id) || !/^[A-Za-z0-9_-]{43}$/.test(token || "") || extra !== undefined) {
          throw new Error("Paste the complete invitation code.");
        }
        const joined = await submitCommunity("/" + id + "/redeem", { token });
        enter(joined);
        refresh();
      }}>
        <label>Invitation code<input name="code" required autoComplete="off" spellCheck={false} /></label>
      </CommunityForm>
      <CommunityForm label="Send join request" save={async data => {
        const value = String(data.get("request")).trim();
        const id = value.startsWith("https://") ? new URL(value).searchParams.get("joinCommunity") : value;
        return requestAccess(id);
      }}>
        <label>Join request link or community ID<input name="request" required defaultValue={requestId} autoComplete="off" /></label>
      </CommunityForm>
      {!identity.foundingAccess && <CommunityForm label="Request to join GG Matchday" save={() => requestAccess(identity.foundingCommunityId)} />}
    </section>
  </div>;
}

function CommunityHub({ theme, setTheme, logout, Matchday }) {
  const [identity, setIdentity] = useState(null);
  const [communities, setCommunities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState(null);
  const [requestId] = useState(visibleRequest);
  const [initialId, setInitialId] = useState(requestedWorkspace);
  const refresh = () => setRevision(value => value + 1);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    async function load() {
      try {
        const me = await communityRequest("/me", options);
        const memberships = await communityPages("/directory", controller.signal);
        if (controller.signal.aborted) return;
        setIdentity(me);
        setCommunities(memberships);
        setError("");
        setSelected(current => {
          const active = current?.id || (initialId === "founding" ? me.foundingCommunityId : initialId);
          return memberships.find(community => community.id === active) || null;
        });
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      }
    }
    void load();
    function check() { if (!document.hidden) void load(); }
    const timer = window.setInterval(check, 20_000);
    window.addEventListener("focus", check);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, [revision, initialId]);

  useEffect(() => {
    function restore() {
      const requested = requestedWorkspace();
      const id = requested === "founding" ? identity?.foundingCommunityId : requested;
      setSelected(communities.find(community => community.id === id) || null);
      setPanel(null);
      setInitialId(requested);
    }
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [communities, identity?.foundingCommunityId]);

  useEffect(() => {
    if (selected) return;
    const icon = document.getElementById("gg-favicon");
    if (icon) icon.href = "/ballers.svg";
  }, [selected]);

  function select(community) {
    invalidateResources();
    const url = new URL(window.location.href);
    url.searchParams.delete("tab");
    url.searchParams.delete("view");
    url.searchParams.delete("joinCommunity");
    if (community) url.searchParams.set("community", community.id);
    else url.searchParams.delete("community");
    window.history.replaceState(null, "", url);
    setInitialId(null);
    setPanel(null);
    setSelected(community);
    setTheme(initialTheme());
  }

  const saveProfile = profile => setIdentity(current => ({ ...current, profile }));
  if (identity && !identity.profile.username) return <WorkspaceBrand.Provider value={platformBrand}>
    <div className="ballers-entry-backdrop"><WelcomeScreen brand={platformBrand} background /></div>
    <Modal title="Set up your player profile" onClose={logout} className="ballers-entry-panel" closeLabel="Sign out">
      <FootballIdentity identity={identity} onSaved={saveProfile} setup />
    </Modal>
  </WorkspaceBrand.Provider>;

  if (selected && identity) {
    const brand = selected.id === identity.foundingCommunityId ? foundingBrand : {
      ...selected.brand, rating: "Matchday Rating", companion: "Companion", founding: false,
    };
    const canManage = ["admin", "owner"].includes(selected.role);
    return <ActiveWorkspace brand={brand} community={selected}>
        <Matchday key={selected.id} onCommunities={() => select(null)} onSignOut={logout}
          onCommunitySettings={canManage ? () => setPanel("membership") : null}
          identity={identity} onProfileSaved={saveProfile} />
      {panel === "membership" && <Modal title="Community settings" onClose={() => setPanel(null)}>
        <CommunityAccess community={selected} />
        {!brand.founding && <PreviousSubmissions communityId={selected.id} />}
      </Modal>}
    </ActiveWorkspace>;
  }

  const actions = <>
    {identity && <button className="secondary-button" type="button" onClick={() => setPanel("profile")}>Account profile settings</button>}
    <button className="secondary-button" type="button" onClick={logout}>Sign out</button>
  </>;
  return <WorkspaceBrand.Provider value={platformBrand}><main className="app community-shell">
    <CommunityHeader title="Communities" theme={theme} setTheme={setTheme} actions={actions} />
    {error && <p className="card community-panel" role="alert">{error} <button type="button" onClick={refresh}>Retry</button></p>}
    {!identity && !error && <p role="status">Loading your communities…</p>}
    {identity && <>
      <section className="home-hero community-hero ballers-community-hero">
        <h2>{communities.length ? "Choose your community" : "Start with your community"}</h2>
        <p className="home-intro">Play with your group, record matches, and build your football profile.</p>
      </section>
      <section className="community-grid" aria-label="Your communities">
        {!communities.length && <p className="muted">Your communities will appear here after you create or join one.</p>}
        {communities.map(community => <section key={community.id} className="card community-panel community-card">
          <span className="community-crest" aria-hidden="true">{community.brand.monogram}</span>
          <div className="community-card-name">
            <span className="eyebrow">{community.role}</span>
            <h2>{community.brand.name}</h2>
          </div>
          <button type="button" className="secondary-button" onClick={() => select(community)}>Open {community.brand.name}</button>
        </section>)}
      </section>
      <MembershipForms identity={identity} requestId={requestId} refresh={refresh} enter={select} />
      {panel === "profile" && <Modal title="Account profile settings" onClose={() => setPanel(null)} className="gg-account-settings">
        <FootballIdentity identity={identity} onSaved={saveProfile} />
      </Modal>}
    </>}
  </main></WorkspaceBrand.Provider>;
}

export default function CommunityPortal({ Matchday }) {
  const [theme, setTheme] = useState(initialTheme);
  const [stage, setStage] = useState("loading");
  const loaded = useCallback(() => setStage("intro"), []);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth || testIdentity) return;
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, value => {
      invalidateResources();
      setUser(value);
      setLoading(false);
    }, () => {
      setError("Sign-in could not load. Refresh and try again.");
      setLoading(false);
    });
    void getRedirectResult(auth).then(result => {
      if (active && result?.user) setStage("access");
    }).catch(() => {
      if (active) {
        setError("Sign-in was interrupted. Try again.");
        setStage("access");
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("gg-theme", theme); } catch { /* Session-only preference. */ }
  }, [theme]);

  useEffect(() => {
    document.title = "ballers. · Football communities";
    const icon = document.getElementById("gg-favicon");
    if (icon) icon.href = "/ballers.svg";
  }, []);

  async function login() {
    setBusy(true);
    setError("");
    try {
      try { await signInWithPopup(auth, googleProvider); }
      catch (failure) {
        if (!redirectErrors.has(failure?.code)) throw failure;
        await signInWithRedirect(auth, googleProvider);
      }
    }
    catch { setError("Sign-in was interrupted. Try again."); }
    finally { setBusy(false); }
  }

  async function logout() {
    try {
      if (testIdentity) {
        const url = new URL(window.location.href);
        url.searchParams.set("e2eRole", "guest");
        window.location.assign(url);
      } else {
        await signOut(auth);
        setStage("intro");
      }
    } catch { setError("Sign-out was interrupted. Try again."); }
  }

  if (stage === "loading") return <StartupScreen authLoading={loading && !testIdentity} onComplete={loaded} brand={platformBrand} />;
  if (stage === "intro") return <WelcomeScreen brand={platformBrand} onEnter={() => setStage("access")} />;
  if (user || testIdentity) return <>
    <CommunityHub key={user?.uid || "test-account"} theme={theme} setTheme={setTheme} logout={logout} Matchday={Matchday} />
    {error && <p role="alert">{error}</p>}
  </>;

  return <WorkspaceBrand.Provider value={platformBrand}>
    <div className="ballers-entry-backdrop"><WelcomeScreen brand={platformBrand} background /></div>
    <Modal title="Your football starts here." onClose={() => setStage("intro")} className="ballers-entry-panel">
      <p>Sign in or create an account to join your group and track the football you play.</p>
      {auth ? <button type="button" className="gg-entry-google" onClick={login} disabled={loading || busy}>
        <span className="gg-google-g" aria-hidden="true">G</span>
        {busy ? "Opening Google…" : loading ? "Checking your session…" : "Continue with Google"}
      </button> : <p role="status">Sign-in is unavailable in this environment.</p>}
      {error && <p role="alert">{error}</p>}
    </Modal>
  </WorkspaceBrand.Provider>;
}
