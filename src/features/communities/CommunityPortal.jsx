import { lazy, Suspense, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../../firebase";
import { invalidateResources } from "../../lib/api";
import CommunityForm from "./CommunityForm";
import CommunityAccess from "./CommunityAccess";
import { communityPages, communityRequest, submitCommunity, validCommunityCode } from "./communityApi";
import "./communities.css";

const CommunityWorkspace = lazy(() => import("./CommunityWorkspace"));
const testIdentity = import.meta.env.VITE_E2E_TEST_AUTH_SECRET &&
  new URLSearchParams(window.location.search).get("e2eRole") !== "guest";

function initialTheme() {
  try { return localStorage.getItem("gg-theme") === "golden" ? "golden" : "dark"; }
  catch { return "dark"; }
}

function visibleRequest() {
  const id = new URLSearchParams(window.location.search).get("joinCommunity") || "";
  return validCommunityCode(id) ? id : "";
}

function CommunityHeader({ title, theme, setTheme, actions }) {
  return <header className="topbar community-topbar">
    <div><span className="eyebrow">Football communities</span><h1>{title}</h1></div>
    <div className="community-actions">
      <div className="gg-theme" role="group" aria-label="Theme">
        <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Dark</button>
        <button type="button" aria-pressed={theme === "golden"} onClick={() => setTheme("golden")}>Gold</button>
      </div>
      {actions}
    </div>
  </header>;
}

function FootballIdentity({ identity, onSaved }) {
  const profile = identity.profile;
  return <section className="card community-panel">
    <h2>Your football profile</h2>
    <div className="community-identity"><span>{identity.email}</span><label>Global player ID<input readOnly value={profile._id}
      onFocus={event => event.target.select()} /></label></div>
    {identity.linkNeedsReview && <p role="status">Your existing GG Matchday link needs an administrator to confirm it.</p>}
    <CommunityForm label="Save profile" save={async data => {
      const number = data.get("number");
      const username = String(data.get("username")).trim();
      const foot = data.get("foot");
      const result = await submitCommunity("/me", {
        displayName: data.get("name"),
        ...(username && { username }),
        ...(foot && { preferredFoot: foot }),
        bio: data.get("bio"),
        shirtNumber: number ? Number(number) : null,
        preferredPositions: String(data.get("positions")).split(",").map(item => item.trim()).filter(Boolean),
      }, null, "PATCH");
      onSaved(result);
    }}>
      <div className="community-fields">
        <label>Display name<input required name="name" maxLength={80} defaultValue={profile.displayName} /></label>
        <label>Username<input name="username" autoComplete="off" minLength={3} maxLength={30} defaultValue={profile.username} /></label>
        <label>Preferred positions<input name="positions" placeholder="ST, CM" defaultValue={profile.preferredPositions?.join(", ")} /></label>
        <label>Preferred foot<select name="foot" defaultValue={profile.preferredFoot || ""}>
          <option value="">Unspecified</option><option value="left">Left</option><option value="right">Right</option>
          <option value="both">Both</option></select></label>
        <label>Shirt number<input name="number" type="number" min={1} max={99} defaultValue={profile.shirtNumber ?? ""} /></label>
        <label>Bio<textarea name="bio" maxLength={400} defaultValue={profile.bio} /></label>
      </div>
    </CommunityForm>
  </section>;
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
  const [requestId] = useState(visibleRequest);
  const [initialId, setInitialId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("community") || (params.has("tab") || params.has("view") ? "founding" : null);
  });
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
    setSelected(community);
    setTheme(initialTheme());
  }

  const founding = selected?.id === identity?.foundingCommunityId && identity?.foundingAccess;
  if (founding) return <Matchday onCommunities={() => select(null)} globalPlayerId={identity.profile._id} />;

  const actions = <>
    {selected && <button className="secondary-button" type="button" onClick={() => select(null)}>Communities</button>}
    <button className="secondary-button" type="button" onClick={logout}>Sign out</button>
  </>;
  return <main className="app community-shell">
    <CommunityHeader title={selected?.brand.name || "Communities"} theme={theme} setTheme={setTheme} actions={actions} />
    {error && <p className="card community-panel" role="alert">{error} <button type="button" onClick={refresh}>Retry</button></p>}
    {!identity && !error && <p role="status">Loading your communities…</p>}
    {selected && <Suspense fallback={<p role="status">Opening community…</p>}>
      <CommunityWorkspace key={selected.id} community={selected} />
    </Suspense>}
    {identity && !selected && <>
      <section className="home-hero community-hero">
        <h2>Your football communities</h2>
        <p className="home-intro">Play with your group, record matches, and build your football profile.</p>
      </section>
      <section className="community-grid" aria-label="Your communities">
        {!communities.length && <p className="muted">Your communities will appear here after you create or join one.</p>}
        {communities.map(community => <section key={community.id} className="card community-panel community-card">
          <div>
            <span className="eyebrow">{community.role}</span>
            <h2>{community.brand.name}</h2>
          </div>
          <button type="button" className="secondary-button" onClick={() => select(community)}>Open {community.brand.name}</button>
        </section>)}
      </section>
      <MembershipForms identity={identity} requestId={requestId} refresh={refresh} enter={select} />
      {communities.filter(community => community.id === identity.foundingCommunityId && community.role === "admin").map(community =>
        <CommunityAccess key={community.id} community={community} />)}
      <FootballIdentity key={identity.profile._id} identity={identity}
        onSaved={profile => setIdentity(current => ({ ...current, profile }))} />
    </>}
  </main>;
}

export default function CommunityPortal({ Matchday }) {
  const [theme, setTheme] = useState(initialTheme);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth || testIdentity) return;
    return onAuthStateChanged(auth, value => {
      invalidateResources();
      setUser(value);
      setLoading(false);
    }, () => {
      setError("Sign-in could not load. Refresh and try again.");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("gg-theme", theme); } catch { /* Session-only preference. */ }
  }, [theme]);

  async function login() {
    setBusy(true);
    setError("");
    try { await signInWithPopup(auth, googleProvider); }
    catch { setError("Sign-in was interrupted. Try again."); }
    finally { setBusy(false); }
  }

  async function logout() {
    try {
      if (testIdentity) {
        const url = new URL(window.location.href);
        url.searchParams.set("e2eRole", "guest");
        window.location.assign(url);
      } else await signOut(auth);
    } catch { setError("Sign-out was interrupted. Try again."); }
  }

  if (user || testIdentity) return <><CommunityHub key={user?.uid || "test-account"}
    theme={theme} setTheme={setTheme} logout={logout} Matchday={Matchday} />{error && <p role="alert">{error}</p>}</>;
  return <main className="app community-shell">
    <CommunityHeader title="Football Stats" theme={theme} setTheme={setTheme} />
    <section className="home-hero community-hero">
      <h2>Your football starts here.</h2>
      <p className="home-intro">Create a community for your group or join one and start recording matches.</p>
      {auth ? <button type="button" className="secondary-button" onClick={login} disabled={loading || busy}>
        {loading || busy ? "Connecting…" : "Continue with Google"}</button> :
        <p role="status">Sign-in is unavailable in this environment.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  </main>;
}
