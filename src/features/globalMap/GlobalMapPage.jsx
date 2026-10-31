import { useCallback, useEffect, useState } from "react";
import { api, setApiActiveWorld } from "../../lib/api";
import GlobalMapScene from "./GlobalMapScene";
import WorldMapView from "./WorldMapView";

async function fetchWorldData(isSignedIn) {
  const publicResult = await api("/worlds/map");
  const worlds = Array.isArray(publicResult?.worlds) ? publicResult.worlds : [];
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

  return { worlds, membershipStates, reviewQueues };
}

function CreateWorldPanel({ isSignedIn, onSignIn, onCreated, onMessage }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const submit = async event => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      onMessage?.("Give your World a name with at least two characters.");
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
        body: { name: normalizedName, description: description.trim() },
      });
      setName("");
      setDescription("");
      onCreated?.(result);
      onMessage?.(result?.world?.name
        ? result.world.name + " has been created. You are its owner."
        : "Your World has been created.");
    } catch (error) {
      onMessage?.(error?.message || "Could not create this World.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="gg-world-create-panel" aria-labelledby="gg-world-create-title">
      <div className="gg-world-create-copy">
        <span className="gg-world-create-eyebrow">START A COMMUNITY</span>
        <h2 id="gg-world-create-title">Build your own football World</h2>
        <p>Create a public kingdom, invite players and shape its map. New members join after owner/admin approval.</p>
      </div>
      {isSignedIn ? (
        <form className="gg-world-create-form" onSubmit={submit}>
          <label>
            World name
            <input
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
            {creating ? "Creating your World…" : "＋ Create World"}
          </button>
        </form>
      ) : (
        <button type="button" className="gg-world-create-button" onClick={onSignIn}>
          Sign in to create a World
        </button>
      )}
    </section>
  );
}

function JoinRequestInbox({ queues, onDecide, busyId }) {
  if (!queues.length) return null;

  return (
    <section className="gg-world-requests" aria-labelledby="gg-world-requests-title">
      <div className="gg-world-requests-heading">
        <div>
          <span className="gg-world-create-eyebrow">WORLD ADMINISTRATION</span>
          <h2 id="gg-world-requests-title">Membership requests</h2>
        </div>
        <span className="gg-world-request-count">
          {queues.reduce((total, queue) => total + queue.requests.length, 0)} awaiting review
        </span>
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

export default function GlobalMapPage({ isSignedIn = false, onMessage, onSignIn }) {
  const [worlds, setWorlds] = useState([]);
  const [membershipStates, setMembershipStates] = useState({});
  const [reviewQueues, setReviewQueues] = useState([]);
  const [busyRequestId, setBusyRequestId] = useState("");
  const [enteredWorld, setEnteredWorld] = useState(null);
  const [enteredMap, setEnteredMap] = useState(null);
  const [enteringWorld, setEnteringWorld] = useState(false);
  const [interiorError, setInteriorError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const applyWorldData = result => {
    setWorlds(result.worlds);
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

    return () => {
      cancelled = true;
    };
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

  const handleWorldCreated = async result => {
    const slug = result?.world?.slug;
    if (slug) {
      setMembershipStates(current => ({ ...current, [slug]: "active" }));
    }
    await loadMap({ silent: true });
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
      // The selected World becomes the context for all subsequent Matchday,
      // Clubs and other World-scoped API calls in the main application shell.
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

  if (enteredWorld) {
    return (
      <section className="tab-content gg-world-interior">
        <header className="gg-world-interior-header">
          <button
            type="button"
            className="gg-world-back-button"
            onClick={() => {
              setEnteredWorld(null);
              setEnteredMap(null);
              setInteriorError("");
            }}
          >
            ← Global Map
          </button>
          <div>
            <span className="gg-global-map-eyebrow">WELCOME TO YOUR WORLD</span>
            <h1>{enteredWorld.name}</h1>
          </div>
        </header>
        {enteringWorld && <p className="muted" role="status">Entering your World…</p>}
        {interiorError && (
          <div className="global-message" role="alert">
            <span>{interiorError}</span>
            <button type="button" onClick={() => enterWorld(enteredWorld)}>Retry</button>
          </div>
        )}
        {enteredMap && (
          <WorldMapView
            world={enteredWorld}
            data={enteredMap}
            onUpdated={refreshEnteredMap}
            onMessage={onMessage}
          />
        )}
      </section>
    );
  }

  return (
    <section className="tab-content gg-global-map-page">
      <CreateWorldPanel
        isSignedIn={isSignedIn}
        onSignIn={onSignIn}
        onCreated={handleWorldCreated}
        onMessage={onMessage}
      />
      <JoinRequestInbox
        queues={reviewQueues}
        busyId={busyRequestId}
        onDecide={decideJoinRequest}
      />
      <GlobalMapScene
        worlds={worlds}
        membershipStates={membershipStates}
        onRequestMembership={requestMembership}
        onEnterWorld={enterWorld}
      />
      {loading && <p className="muted" role="status">Discovering football kingdoms…</p>}
      {!loading && !worlds.length && !loadError && (
        <div className="empty-state">
          <strong>The Global Map is taking shape.</strong>
          <p>No public kingdoms have been published yet.</p>
        </div>
      )}
      {loadError && (
        <div className="global-message" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => loadMap()}>Retry</button>
        </div>
      )}
      {refreshing && <p className="muted" role="status">Updating World access…</p>}
    </section>
  );
}
