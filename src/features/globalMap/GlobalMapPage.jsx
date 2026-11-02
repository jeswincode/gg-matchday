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

  useEffect(() => {
    if (!open) {
      setName("");
      setPosition("");
      setPreferredFoot("");
      setBio("");
    }
  }, [open]);

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

function AccountChip({ authUser, backendUser, isSignedIn, isAdmin, onSignIn, onSignOut, onNavigateAdmin, theme, onThemeChange, onOpenClubs }) {
  return (
    <div className="gg-world-account-hud">
      <button type="button" className="gg-world-clubs-link" onClick={onOpenClubs}>Clubs</button>
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
          <button type="button" className="gg-world-signout" onClick={onSignOut}>Sign out</button>
        </>
      ) : (
        <button type="button" className="gg-world-signin" onClick={onSignIn}>Sign in</button>
      )}
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
  const [myWorlds, setMyWorlds] = useState([]);
  const [availablePlots, setAvailablePlots] = useState([]);
  const [membershipStates, setMembershipStates] = useState({});
  const [reviewQueues, setReviewQueues] = useState([]);
  const [busyRequestId, setBusyRequestId] = useState("");
  const [enteredWorld, setEnteredWorld] = useState(null);
  const [enteredMap, setEnteredMap] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileCreating, setProfileCreating] = useState(false);
  const [worldSwitcherOpen, setWorldSwitcherOpen] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [reviewInboxOpen, setReviewInboxOpen] = useState(false);
  const [enteringWorld, setEnteringWorld] = useState(false);
  const [interiorError, setInteriorError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const applyWorldData = result => {
    setWorlds(result.worlds);
    setAvailablePlots(result.availablePlots);
    setMembershipStates(result.membershipStates);
    setMyWorlds(result.myWorlds || []);
    setReviewQueues(result.reviewQueues);
    setLoadError("");
  };

  const loadMap = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    try {
      applyWorldData(await fetchWorldData(isSignedIn));
    } catch (error) {
      setLoadError(error?.message || "Could not load the Global Map.");
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

        // Restore the active World when returning to Home after using another
        // Matchday destination or reloading the tab. The explicit Global Map
        // action clears this selector and therefore prevents auto-entry.
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
            setInteriorError("Could not restore this World. Choose it again from the Global Map.");
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

  const requestMembership = async world => {
    if (!isSignedIn) {
      onMessage?.("Sign in to request membership in " + world.name + ".");
      onSignIn?.();
      return;
    }
    try {
      const result = await api("/worlds/" + encodeURIComponent(world.slug) + "/join-requests", {
        method: "POST",
        body: {},
      });
      setMembershipStates(current => ({
        ...current,
        [world.slug]: result?.membership?.status || current[world.slug] || "pending",
      }));
      onMessage?.(result?.message || "Membership request submitted.");
      await loadMap({ silent: true });
    } catch (error) {
      onMessage?.(error?.message || "Could not submit the membership request.");
    }
  };

  const decideJoinRequest = async (worldSlug, membershipId, decision) => {
    setBusyRequestId(membershipId);
    try {
      const result = await api(
        "/worlds/" + encodeURIComponent(worldSlug) +
        "/join-requests/" + encodeURIComponent(membershipId) + "/" + decision,
        { method: "POST", body: {} },
      );
      onMessage?.(result?.message || "Membership request updated.");
      await loadMap({ silent: true });
    } catch (error) {
      onMessage?.(error?.message || "Could not update this membership request.");
    } finally {
      setBusyRequestId("");
    }
  };

  const enterWorld = async world => {
    if (!isSignedIn) {
      onSignIn?.();
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
      setWorldSwitcherOpen(false);
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

  const claimPlot = plot => {
    if (!isSignedIn) {
      setSelectedPlot(plot);
      onSignIn?.();
      return;
    }
    setSelectedPlot(plot);
    setCreateModalOpen(true);
  };

  const handleWorldCreated = async result => {
    const createdWorld = result?.world;
    if (createdWorld?.slug) {
      setMembershipStates(current => ({ ...current, [createdWorld.slug]: "active" }));
      await loadMap({ silent: true });
      await enterWorld(createdWorld);
    } else {
      await loadMap({ silent: true });
    }
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
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          theme={theme}
          onThemeChange={onThemeChange}
          onOpenClubs={onOpenClubs}
        />
      </header>
      {isSignedIn && (
        <div className="gg-world-switcher-position">
          <WorldSwitcher
            worlds={myWorlds}
            currentWorld={enteredWorld}
            isOpen={worldSwitcherOpen}
            onToggle={() => setWorldSwitcherOpen(value => !value)}
            onSelect={enterWorld}
          />
        </div>
      )}

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
              <span className="gg-world-create-eyebrow">THE FOOTBALL UNIVERSE</span>
              <h1>Every World starts somewhere.</h1>
              <p>Explore existing football communities or claim untouched territory to found your own.</p>
            </div>
            <div className="gg-world-global-stats">
              <strong>{worlds.length}</strong>
              <span>WORLD{worlds.length === 1 ? "" : "S"}</span>
              <small>{availablePlots.length} open plots</small>
            </div>
          </div>

          <section className="gg-world-map-canvas" aria-label="Global World map">
            <GlobalMapScene
              worlds={worlds}
              membershipStates={membershipStates}
              availablePlots={availablePlots}
              onClaimPlot={claimPlot}
              onRequestMembership={requestMembership}
              onEnterWorld={enterWorld}
            />
            {loading && <div className="gg-world-map-toast" role="status">Charting the football universe…</div>}
            {refreshing && <div className="gg-world-map-toast gg-world-map-toast-refresh" role="status">Updating territories…</div>}
            {!loading && !worlds.length && !loadError && (
              <div className="gg-world-empty-hint">
                <strong>The first kingdom is waiting to be founded.</strong>
                <span>Choose any highlighted open plot to claim your land.</span>
              </div>
            )}
            {loadError && (
              <div className="gg-world-map-error" role="alert">
                <span>{loadError}</span>
                <button type="button" onClick={() => loadMap()}>Retry</button>
              </div>
            )}
          </section>

          <div className="gg-world-global-tools">
            <button
              type="button"
              className="gg-world-found-button"
              disabled={availablePlots.length === 0}
              onClick={() => availablePlots[0] && claimPlot(availablePlots[0])}
            >
              ＋ Found a World
            </button>
            {availablePlots.length === 0 && (
              <span className="gg-world-no-plots">All mapped territory is currently claimed.</span>
            )}
            {isSignedIn && reviewQueues.length > 0 && (
              <button type="button" className="gg-world-inbox-toggle" onClick={() => setReviewInboxOpen(value => !value)}>
                Membership requests <span>{reviewQueues.reduce((sum, queue) => sum + queue.requests.length, 0)}</span>
              </button>
            )}
            {reviewInboxOpen && (
              <JoinRequestInbox
                queues={reviewQueues}
                busyId={busyRequestId}
                onDecide={decideJoinRequest}
                onClose={() => setReviewInboxOpen(false)}
              />
            )}
          </div>
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
          {!playerProfile && (
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
        open={profileModalOpen}
        world={enteredWorld}
        existingProfile={playerProfile}
        busy={profileCreating}
        onClose={() => setProfileModalOpen(false)}
        onCreate={createPlayerProfile}
      />

      <CreateWorldModal
        isOpen={createModalOpen}
        plot={selectedPlot}
        isSignedIn={isSignedIn}
        onSignIn={onSignIn}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleWorldCreated}
        onMessage={onMessage}
      />
    </main>
  );
}
