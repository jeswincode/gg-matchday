import { useCallback, useEffect, useState } from "react";
import { api, setApiActiveWorld } from "../../lib/api";
import { getActiveWorldSlug } from "../../lib/worldContext.js";
import GlobalMapScene from "./GlobalMapScene";
import WorldMapView from "./WorldMapView";
import "./immersive-world-map.css";

async function fetchWorldData(isSignedIn) {
  const publicResult = await api("/worlds/map");
  const worlds = Array.isArray(publicResult?.worlds) ? publicResult.worlds.slice(0, 1) : [];
  const membershipStates = {};
  let myWorld = null;

  if (isSignedIn) {
    const ownResult = await api("/worlds/me");
    const ownWorlds = Array.isArray(ownResult?.worlds) ? ownResult.worlds : [];
    myWorld = ownWorlds[0] || null;
    if (myWorld?.slug && myWorld?.membership?.status) {
      membershipStates[myWorld.slug] = myWorld.membership.status;
    }
  }

  return { worlds, membershipStates, myWorld };
}

function PlayerProfileModal({ open, world, onClose, onCreate, busy, existingProfile }) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [preferredFoot, setPreferredFoot] = useState("");
  const [bio, setBio] = useState("");

  if (!open || !world) return null;

  return (
    <div className="gg-world-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) onClose?.();
    }}>
      <section className="gg-world-create-modal gg-world-player-profile-modal" role="dialog" aria-modal="true" aria-labelledby="gg-world-player-profile-title">
        <button type="button" className="gg-world-modal-close" onClick={onClose} disabled={busy} aria-label="Close player profile setup">×</button>
        <div className="gg-world-modal-art">
          <span className="gg-world-modal-castle">⚽</span>
          <span className="gg-world-modal-land">{world.name.toUpperCase()} · PLAYER IDENTITY</span>
        </div>
        <div className="gg-world-modal-copy">
          <span className="gg-world-create-eyebrow">YOUR PLACE IN THIS WORLD</span>
          <h2 id="gg-world-player-profile-title">{existingProfile ? "Your World Player" : "Create your player profile"}</h2>
          <p>This profile belongs only to {world.name}. Your other Worlds keep their own player identity and football record.</p>
        </div>
        {existingProfile ? (
          <div className="gg-world-profile-summary">
            <strong>{existingProfile.name}</strong>
            <span>{existingProfile.position || "Position not set"} · {existingProfile.preferredFoot || "Preferred foot not set"}</span>
          </div>
        ) : (
          <form className="gg-world-create-form" onSubmit={event => {
            event.preventDefault();
            onCreate?.({ name, position, preferredFoot, bio });
          }}>
            <label>
              Player name
              <input autoFocus value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={60} placeholder="Your name on the pitch" required/>
            </label>
            <label>
              Primary position
              <select value={position} onChange={event => setPosition(event.target.value)}>
                <option value="">Choose later</option>
                <option value="Goalkeeper">Goalkeeper</option>
                <option value="Defender">Defender</option>
                <option value="Midfielder">Midfielder</option>
                <option value="Attacker">Attacker</option>
              </select>
            </label>
            <label>
              Preferred foot
              <select value={preferredFoot} onChange={event => setPreferredFoot(event.target.value)}>
                <option value="">Choose later</option>
                <option value="Left">Left</option>
                <option value="Right">Right</option>
                <option value="Both">Both</option>
              </select>
            </label>
            <label>
              Short bio <span className="gg-world-optional">(optional)</span>
              <textarea rows={2} maxLength={500} value={bio} onChange={event => setBio(event.target.value)} placeholder="Tell this World a little about your game"/>
            </label>
            <button className="gg-world-create-button" type="submit" disabled={busy || name.trim().length < 2}>
              {busy ? "Creating your player…" : "Create player profile"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function WorldBottomNavigation({ onNavigateTab }) {
  const items = [
    { id: "home", icon: "🌍", label: "Home" },
    { id: "record", icon: "＋", label: "Record" },
    { id: "leaderboard", icon: "🏆", label: "Leaderboard" },
    { id: "calendar", icon: "📅", label: "Calendar" },
    { id: "players", icon: "👥", label: "Players" },
  ];

  return (
    <nav className="gg-world-bottom-nav" aria-label="Main navigation">
      {items.map(item => (
        <button
          type="button"
          key={item.id}
          className={item.id === "home" ? "active" : ""}
          aria-current={item.id === "home" ? "page" : undefined}
          onClick={() => onNavigateTab?.(item.id)}
        >
          <span>{item.icon}</span>
          <small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
}

function AccountChip({ authUser, backendUser, isSignedIn, isAdmin, onSignIn, onSignOut, onNavigateAdmin, onManageAccess, theme, onThemeChange, onOpenClubs }) {
  return (
    <div className="gg-world-account-hud">
      {onOpenClubs && <button type="button" className="gg-world-clubs-link" onClick={onOpenClubs}>Clubs</button>}
      <div className="gg-world-theme-switch" aria-label="Theme">
        <button type="button" aria-pressed={theme === "dark"} onClick={() => onThemeChange?.("dark")}>Dark</button>
        <button type="button" aria-pressed={theme === "golden"} onClick={() => onThemeChange?.("golden")}>Gold</button>
      </div>
      {isSignedIn ? (
        <>
          <div className="gg-world-account-chip">
            {authUser?.photoURL ? <img src={authUser.photoURL} alt="" /> : <span>{String(authUser?.displayName || authUser?.email || "U").charAt(0).toUpperCase()}</span>}
            <div>
              <strong>{authUser?.displayName || backendUser?.name || "GG member"}</strong>
              <small>{backendUser?.role || "member"}</small>
            </div>
          </div>
          {isAdmin && <button type="button" className="gg-world-admin-link" onClick={onNavigateAdmin}>Admin</button>}
          {isAdmin && <button type="button" className="gg-world-admin-link" onClick={onManageAccess}>Manage access</button>}
          <button type="button" className="gg-world-signout" onClick={onSignOut}>Sign out</button>
        </>
      ) : (
        <button type="button" className="gg-world-signin" onClick={onSignIn}>Sign in</button>
      )}
    </div>
  );
}

function WorldAccessManager({ open, onClose, onMessage }) {
  const [grants, setGrants] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const loadGrants = useCallback(async () => {
    try {
      const result = await api("/worlds/admin/access");
      setError("");
      setGrants(Array.isArray(result?.grants) ? result.grants : []);
    } catch (loadError) {
      setError(loadError?.message || "Could not load linked Gmail accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadGrants();
  }, [open, loadGrants]);

  if (!open) return null;

  const invite = async event => {
    event.preventDefault();
    setBusyId("invite");
    setError("");
    try {
      const result = await api("/worlds/admin/access", {
        method: "POST",
        body: { email: email.trim(), role },
      });
      setEmail("");
      onMessage?.(result?.message || "Gmail invitation created.");
      await loadGrants();
    } catch (inviteError) {
      setError(inviteError?.message || "Could not create this invitation.");
    } finally {
      setBusyId("");
    }
  };

  const revoke = async grant => {
    if (!window.confirm("Revoke GG World access for " + grant.email + "?")) return;
    setBusyId(grant.id);
    setError("");
    try {
      const result = await api("/worlds/admin/access/" + encodeURIComponent(grant.id), {
        method: "DELETE",
      });
      onMessage?.(result?.message || "World access revoked.");
      await loadGrants();
    } catch (revokeError) {
      setError(revokeError?.message || "Could not revoke this invitation.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="gg-world-modal-backdrop gg-world-access-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !busyId) onClose?.();
    }}>
      <section className="gg-world-create-modal gg-world-access-modal" role="dialog" aria-modal="true" aria-labelledby="gg-world-access-title">
        <button type="button" className="gg-world-modal-close" onClick={onClose} disabled={Boolean(busyId)} aria-label="Close access manager">×</button>
        <div className="gg-world-modal-copy">
          <span className="gg-world-create-eyebrow">GG PLATFORM ADMINISTRATION</span>
          <h2 id="gg-world-access-title">Football World access</h2>
          <p>Only Gmail addresses linked here can enter the shared football World. Access activates after Firebase verifies the exact account.</p>
        </div>
        <form className="gg-world-create-form gg-world-access-form" onSubmit={invite}>
          <label>
            Gmail address
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} placeholder="player@gmail.com" required/>
          </label>
          <label>
            World role
            <select value={role} onChange={event => setRole(event.target.value)}>
              <option value="member">Member</option>
              <option value="editor">Editor</option>
            </select>
          </label>
          <button className="gg-world-create-button" type="submit" disabled={busyId === "invite" || !email.trim()}>
            {busyId === "invite" ? "Linking Gmail…" : "Link Gmail account"}
          </button>
        </form>
        {error && <p className="gg-world-access-error" role="alert">{error}</p>}
        <div className="gg-world-access-list-heading">
          <strong>Linked accounts and invitations</strong>
          <button type="button" onClick={loadGrants} disabled={loading || Boolean(busyId)}>Refresh</button>
        </div>
        {loading ? (
          <p className="gg-world-access-empty" role="status">Loading access records…</p>
        ) : grants.length === 0 ? (
          <p className="gg-world-access-empty">No Gmail accounts have been linked yet.</p>
        ) : (
          <div className="gg-world-access-list">
            {grants.map(grant => (
              <article className="gg-world-access-item" key={grant.id}>
                <div className="gg-world-access-person">
                  <strong>{grant.email}</strong>
                  <small>{grant.role} · {grant.user?.name || (grant.status === "invited" ? "Awaiting verified sign-in" : "No account linked")}</small>
                </div>
                <span className={"gg-world-access-status is-" + grant.status}>{grant.status}</span>
                {grant.status !== "revoked" && (
                  <button type="button" className="gg-world-access-revoke" onClick={() => revoke(grant)} disabled={Boolean(busyId)}>
                    {busyId === grant.id ? "Revoking…" : "Revoke"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function GlobalMapPage({
  isSignedIn = false,
  authUser = null,
  backendUser = null,
  isAdmin = false,
  onMessage,
  message = "",
  onClearMessage,
  onSignIn,
  onSignOut,
  onNavigateTab,
  onOpenClubs,
  theme = "dark",
  onThemeChange,
}) {
  const [worlds, setWorlds] = useState([]);
  const [membershipStates, setMembershipStates] = useState({});
  const [enteredWorld, setEnteredWorld] = useState(null);
  const [enteredMap, setEnteredMap] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileCreating, setProfileCreating] = useState(false);
  const [accessManagerOpen, setAccessManagerOpen] = useState(false);
  const [enteringWorld, setEnteringWorld] = useState(false);
  const [interiorError, setInteriorError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const applyWorldData = result => {
    setWorlds(Array.isArray(result.worlds) ? result.worlds.slice(0, 1) : []);
    setMembershipStates(result.membershipStates || {});
    setLoadError("");
  };

  const loadMap = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    try {
      applyWorldData(await fetchWorldData(isSignedIn));
    } catch (error) {
      setLoadError(error?.message || "Could not load the GG Global Map.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    let cancelled = false;
    fetchWorldData(isSignedIn)
      .then(async result => {
        if (cancelled) return;
        applyWorldData(result);

        // Restore the one shared World after returning from Matchday pages.
        // The server revalidates the current Gmail grant on this request.
        const activeSlug = isSignedIn ? getActiveWorldSlug() : null;
        if (!activeSlug) return;

        const world = result.worlds.find(item => item.slug === activeSlug);
        if (!world || result.membershipStates[activeSlug] !== "active") {
          setApiActiveWorld(null);
          return;
        }

        try {
          const data = await api("/worlds/" + encodeURIComponent(activeSlug) + "/map");
          if (cancelled) return;
          setEnteredWorld(world);
          setEnteredMap(data);
          try {
            const profileResult = await api("/worlds/" + encodeURIComponent(activeSlug) + "/player-profile");
            if (!cancelled) setPlayerProfile(profileResult?.profile || null);
          } catch (profileError) {
            console.warn("World player profile could not be loaded:", profileError?.message || profileError);
            if (!cancelled) setPlayerProfile(null);
          }
        } catch {
          if (!cancelled) {
            setApiActiveWorld(null);
            setInteriorError("Could not restore the GG football World. Select it again from the Global Map.");
          }
        }
      })
      .catch(error => {
        if (!cancelled) setLoadError(error?.message || "Could not load the Global Map.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isSignedIn]);

  const enterWorld = async world => {
    if (!isSignedIn) {
      onMessage?.("Sign in with the Gmail address linked by the GG administrator.");
      onSignIn?.();
      return;
    }

    const accessStatus = membershipStates[world.slug] || "none";
    if (accessStatus !== "active") {
      const messageText = accessStatus === "invited"
        ? "This Gmail invitation has not activated. Sign in again with the exact invited Gmail account."
        : accessStatus === "revoked"
          ? "Access to the GG football World has been revoked. Contact the platform administrator."
          : "This Gmail account has not been linked by the GG platform administrator.";
      onMessage?.(messageText);
      return;
    }

    setEnteringWorld(true);
    setInteriorError("");
    try {
      const data = await api("/worlds/" + encodeURIComponent(world.slug) + "/map");
      setApiActiveWorld(world.slug);
      setEnteredWorld(world);
      setEnteredMap(data);
      setPlayerProfile(null);
      try {
        const profileResult = await api("/worlds/" + encodeURIComponent(world.slug) + "/player-profile");
        setPlayerProfile(profileResult?.profile || null);
      } catch (profileError) {
        console.warn("World player profile could not be loaded:", profileError?.message || profileError);
      }
    } catch (error) {
      setInteriorError(error?.message || "Could not enter this World.");
    } finally {
      setEnteringWorld(false);
    }
  };

  const createPlayerProfile = async profileData => {
    if (!enteredWorld) return;
    setProfileCreating(true);
    try {
      const result = await api("/worlds/" + encodeURIComponent(enteredWorld.slug) + "/player-profiles", {
        method: "POST",
        body: profileData,
      });
      setPlayerProfile(result.profile || null);
      setProfileModalOpen(false);
      onMessage?.(result.message || "Your player profile has been created.");
      await loadMap({ silent: true });
    } catch (error) {
      onMessage?.(error?.message || "Could not create your player profile.");
    } finally {
      setProfileCreating(false);
    }
  };

  const refreshEnteredMap = async () => {
    if (!enteredWorld) return;
    const data = await api("/worlds/" + encodeURIComponent(enteredWorld.slug) + "/map");
    setEnteredMap(data);
  };

  const goToGlobalMap = () => {
    setApiActiveWorld(null);
    setEnteredWorld(null);
    setEnteredMap(null);
    setPlayerProfile(null);
    setProfileModalOpen(false);
    setInteriorError("");
  };

  return (
    <main className={"gg-world-screen" + (enteredWorld ? " gg-world-screen-interior" : " gg-world-screen-global")}>
      <header className="gg-world-top-hud">
        <div className="gg-world-brand">
          <span className="gg-world-brand-mark">GG</span>
          <div>
            <strong>FOOTBALL UNIVERSE</strong>
            <small>{enteredWorld ? enteredWorld.name : "GLOBAL MAP"}</small>
          </div>
        </div>
        <AccountChip
          authUser={authUser}
          backendUser={backendUser}
          isSignedIn={isSignedIn}
          isAdmin={isAdmin}
          onNavigateAdmin={() => onNavigateTab?.("admin")}
          onManageAccess={() => setAccessManagerOpen(true)}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          theme={theme}
          onThemeChange={onThemeChange}
          onOpenClubs={membershipStates[worlds[0]?.slug] === "active" ? onOpenClubs : null}
        />
      </header>

      {message && (
        <div className="gg-world-feedback-toast" role="status">
          <span>{message}</span>
          <button type="button" onClick={onClearMessage} aria-label="Dismiss message">×</button>
        </div>
      )}

      {!enteredWorld ? (
        <>
          <div className="gg-world-map-title">
            <div>
              <span className="gg-world-create-eyebrow">THE GG FOOTBALL UNIVERSE</span>
              <h1>One World. One shared football home.</h1>
              <p>The Original GG football World, with its stadium, Clubs and training grounds. Entry is reserved for Gmail accounts linked by the platform administrator.</p>
            </div>
            <div className="gg-world-global-stats">
              <strong>{worlds.length ? "01" : "—"}</strong>
              <span>SHARED WORLD</span>
              <small>Administrator-linked access</small>
            </div>
          </div>

          <section className="gg-world-map-canvas" aria-label="Global World map">
            <GlobalMapScene
              worlds={worlds}
              membershipStates={membershipStates}
              onEnterWorld={enterWorld}
            />
            {loading && <div className="gg-world-map-toast" role="status">Charting the football universe…</div>}
            {refreshing && <div className="gg-world-map-toast gg-world-map-toast-refresh" role="status">Updating territories…</div>}
            {!loading && !worlds.length && !loadError && (
              <div className="gg-world-empty-hint">
                <strong>The GG football World is not available yet.</strong>
                <span>Ask the platform administrator to verify the primary World configuration.</span>
              </div>
            )}
            {loadError && (
              <div className="gg-world-map-error" role="alert">
                <span>{loadError}</span>
                <button type="button" onClick={() => loadMap()}>Retry</button>
              </div>
            )}
          </section>

          {isSignedIn && worlds[0] && membershipStates[worlds[0].slug] !== "active" && (
            <div className="gg-world-access-hint" role="status">
              <strong>Private football World</strong>
              <span>{membershipStates[worlds[0].slug] === "invited"
                ? "Sign in with the exact Gmail address linked by the administrator."
                : "Only administrator-linked Gmail accounts can enter the facilities and training grounds."}</span>
            </div>
          )}
        </>
      ) : (
        <>
          <header className="gg-world-interior-header">
            <button type="button" className="gg-world-back-button" onClick={goToGlobalMap}>
              ← Global Map
            </button>
            <div className="gg-world-interior-title">
              <span className="gg-world-create-eyebrow">WELCOME TO YOUR WORLD</span>
              <h1>{enteredWorld.name}</h1>
            </div>
            <span className="gg-world-interior-role">{enteredMap?.permissions?.canEditMap ? "OWNER / ADMIN" : "MEMBER"}</span>
          </header>
          {!playerProfile && !isAdmin && (
            <section className="gg-world-profile-setup-banner">
              <div>
                <strong>Set up your player identity in {enteredWorld.name}</strong>
                <span>Your player profile and football statistics are separate in every World.</span>
              </div>
              <button type="button" onClick={() => setProfileModalOpen(true)}>Create player profile</button>
            </section>
          )}
          {playerProfile && (
            <div className="gg-world-player-chip">
              <span>{playerProfile.name}</span>
              <small>{playerProfile.position || "Player"} · this World</small>
              <button type="button" onClick={() => setProfileModalOpen(true)}>View profile</button>
            </div>
          )}
          {enteringWorld && <p className="muted" role="status">Entering your World…</p>}
          {interiorError && (
            <div className="gg-world-map-error" role="alert">
              <span>{interiorError}</span>
              <button type="button" onClick={() => enterWorld(enteredWorld)}>Retry</button>
            </div>
          )}
          {enteredMap && (
            <div className="gg-world-local-map-stage">
              <WorldMapView
                world={enteredWorld}
                data={enteredMap}
                onUpdated={refreshEnteredMap}
                onMessage={onMessage}
              />
            </div>
          )}
        </>
      )}

      <WorldBottomNavigation onNavigateTab={onNavigateTab} />

      <PlayerProfileModal
        key={profileModalOpen ? "profile-open-" + (enteredWorld?.slug || "world") : "profile-closed"}
        open={!isAdmin && profileModalOpen}
        world={enteredWorld}
        existingProfile={playerProfile}
        busy={profileCreating}
        onClose={() => setProfileModalOpen(false)}
        onCreate={createPlayerProfile}
      />

      <WorldAccessManager
        open={isAdmin && accessManagerOpen}
        onClose={() => setAccessManagerOpen(false)}
        onMessage={onMessage}
      />
    </main>
  );
}
