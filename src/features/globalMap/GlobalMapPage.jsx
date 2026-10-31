import { useCallback, useEffect, useState } from "react";
import { api, setApiActiveWorld } from "../../lib/api";
import GlobalMapScene from "./GlobalMapScene";
import WorldMapView from "./WorldMapView";
import "./immersive-world-map.css";

async function fetchWorldData(isSignedIn) {
  const publicResult = await api("/worlds/map");
  const worlds = Array.isArray(publicResult?.worlds) ? publicResult.worlds : [];
  const availablePlots = Array.isArray(publicResult?.availablePlots) ? publicResult.availablePlots : [];
  let membershipStates = {};
  let reviewQueues = [];

  if (isSignedIn) {
    const ownResult = await api("/worlds/me");
    const ownWorlds = Array.isArray(ownResult?.worlds) ? ownResult.worlds : [];
    membershipStates = {};
    for (const item of ownWorlds) {
      const status = item?.membership?.status;
      if (item?.slug && status) membershipStates[item.slug] = status;
    }

    const reviewableWorlds = ownWorlds.filter(item =>
      item?.membership?.status === "active" &&
      ["owner", "admin"].includes(item?.membership?.role),
    );
    const queues = await Promise.allSettled(reviewableWorlds.map(async world => {
      const result = await api("/worlds/" + encodeURIComponent(world.slug) + "/join-requests");
      return {
        slug: world.slug,
        name: world.name,
        requests: Array.isArray(result?.requests) ? result.requests : [],
      };
    }));
    reviewQueues = queues
      .filter(item => item.status === "fulfilled" && item.value.requests.length > 0)
      .map(item => item.value);
  }

  return { worlds, availablePlots, membershipStates, reviewQueues };
}

function CreateWorldModal({ isOpen, plot, isSignedIn, onSignIn, onClose, onCreated, onMessage }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
    }
  }, [isOpen]);

  if (!isOpen || !plot) return null;

  const submit = async event => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      onMessage?.("World name must contain between 2 and 80 characters.");
      return;
    }
    if (!isSignedIn) {
      onSignIn?.();
      return;
    }

    setCreating(true);
    try {
      const result = await api("/worlds", {
        method: "POST",
        body: {
          name: normalizedName,
          description: description.trim(),
          globalMapSlotIndex: plot.slotIndex,
        },
      });
      await onCreated?.(result);
      onClose?.();
      onMessage?.(result?.world?.name
        ? result.world.name + " has been founded. Your kingdom is ready."
        : "Your World has been founded.");
    } catch (error) {
      onMessage?.(error?.message || "Could not claim this plot.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="gg-world-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !creating) onClose?.();
    }}>
      <section
        className="gg-world-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gg-world-create-title"
      >
        <button type="button" className="gg-world-modal-close" onClick={onClose} disabled={creating} aria-label="Close World creation">×</button>
        <div className="gg-world-modal-art" aria-hidden="true">
          <span className="gg-world-modal-castle">♜</span>
          <span className="gg-world-modal-land">OPEN TERRITORY · PLOT {plot.slotIndex + 1}</span>
        </div>
        <div className="gg-world-modal-copy">
          <span className="gg-global-map-eyebrow">FOUND A FOOTBALL COMMUNITY</span>
          <h2 id="gg-world-create-title">Build your own World</h2>
          <p>Name your kingdom. This land will become its home, and you will be its first owner.</p>
        </div>
        {isSignedIn ? (
          <form className="gg-world-create-form" onSubmit={submit}>
            <label>
              World name
              <input
                autoFocus
                value={name}
                onChange={event => setName(event.target.value)}
                maxLength={80}
                minLength={2}
                placeholder="e.g. Bengaluru Sunday League"
                required
              />
            </label>
            <label>
              Description <span className="gg-world-optional">(optional)</span>
              <textarea
                value={description}
                onChange={event => setDescription(event.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="What makes your football community different?"
              />
            </label>
            <button type="submit" className="gg-world-create-button" disabled={creating || name.trim().length < 2}>
              {creating ? "Founding your World…" : "Claim land and create World"}
            </button>
          </form>
        ) : (
          <div className="gg-world-signin-prompt">
            <p>Sign in to claim this plot and become its owner.</p>
            <button type="button" className="gg-world-create-button" onClick={onSignIn}>Sign in to continue</button>
          </div>
        )}
      </section>
    </div>
  );
}

function JoinRequestInbox({ queues, onDecide, busyId, onClose }) {
  if (!queues.length) {
    return (
      <div className="gg-world-inbox-empty">
        <strong>No requests waiting.</strong>
        <span>New membership applications will appear here.</span>
      </div>
    );
  }

  return (
    <section className="gg-world-requests gg-world-requests-overlay" aria-labelledby="gg-world-requests-title">
      <div className="gg-world-requests-heading">
        <div>
          <span className="gg-world-create-eyebrow">WORLD ADMINISTRATION</span>
          <h2 id="gg-world-requests-title">Membership requests</h2>
        </div>
        <button type="button" className="gg-world-inbox-close" onClick={onClose} aria-label="Close membership requests">×</button>
      </div>
      {queues.map(queue => (
        <div className="gg-world-request-group" key={queue.slug}>
          <h3>{queue.name}</h3>
          {queue.requests.map(request => {
            const busy = busyId === request.id;
            const applicantName = request.user?.name || "GG member";
            return (
              <article className="gg-world-request-item" key={request.id}>
                <div className="gg-world-request-person">
                  {request.user?.profileImage ? (
                    <img src={request.user.profileImage} alt="" />
                  ) : (
                    <span aria-hidden="true">{applicantName.charAt(0).toUpperCase()}</span>
                  )}
                  <div>
                    <strong>{applicantName}</strong>
                    <small>Requested to join {queue.name}</small>
                  </div>
                </div>
                <div className="gg-world-request-actions">
                  <button
                    type="button"
                    className="gg-world-approve"
                    disabled={busy}
                    aria-label={"Approve " + applicantName}
                    onClick={() => onDecide(queue.slug, request.id, "approve")}
                  >
                    {busy ? "Saving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="gg-world-reject"
                    disabled={busy}
                    aria-label={"Reject " + applicantName}
                    onClick={() => onDecide(queue.slug, request.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ))}
    </section>
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

function AccountChip({ authUser, backendUser, isSignedIn, onSignIn, onSignOut, theme, onThemeChange, onOpenClubs }) {
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
  onMessage,
  onSignIn,
  onSignOut,
  onNavigateTab,
  onOpenClubs,
  theme = "dark",
  onThemeChange,
}) {
  const [worlds, setWorlds] = useState([]);
  const [availablePlots, setAvailablePlots] = useState([]);
  const [membershipStates, setMembershipStates] = useState({});
  const [reviewQueues, setReviewQueues] = useState([]);
  const [busyRequestId, setBusyRequestId] = useState("");
  const [enteredWorld, setEnteredWorld] = useState(null);
  const [enteredMap, setEnteredMap] = useState(null);
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
      .then(result => {
        if (!cancelled) applyWorldData(result);
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
    } catch (error) {
      setInteriorError(error?.message || "Could not enter this World.");
    } finally {
      setEnteringWorld(false);
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
    setEnteredWorld(null);
    setEnteredMap(null);
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
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          theme={theme}
          onThemeChange={onThemeChange}
          onOpenClubs={onOpenClubs}
        />
      </header>

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
            <button type="button" className="gg-world-found-button" onClick={() => claimPlot(availablePlots[0] || { slotIndex: 0, x: 0, y: 0 })}>
              ＋ Found a World
            </button>
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
