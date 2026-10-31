import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import GlobalMapScene from "./GlobalMapScene";

async function fetchWorldData(isSignedIn) {
  const publicResult = await api("/worlds/map");
  const worlds = Array.isArray(publicResult?.worlds) ? publicResult.worlds : [];
  let membershipStates = {};

  if (isSignedIn) {
    const ownResult = await api("/worlds/me");
    const ownWorlds = Array.isArray(ownResult?.worlds) ? ownResult.worlds : [];
    membershipStates = {};
    for (const item of ownWorlds) {
      const status = item?.membership?.status;
      if (item?.slug && status) membershipStates[item.slug] = status;
    }
  }

  return { worlds, membershipStates };
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

export default function GlobalMapPage({ isSignedIn = false, onMessage, onSignIn }) {
  const [worlds, setWorlds] = useState([]);
  const [membershipStates, setMembershipStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadMap = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);

    try {
      const result = await fetchWorldData(isSignedIn);
      setWorlds(result.worlds);
      setMembershipStates(result.membershipStates);
      setLoadError("");
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
        if (cancelled) return;
        setWorlds(result.worlds);
        setMembershipStates(result.membershipStates);
        setLoadError("");
      })
      .catch(error => {
        if (cancelled) return;
        setLoadError(error?.message || "Could not load the Global Map.");
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

  const handleWorldCreated = async result => {
    const slug = result?.world?.slug;
    if (slug) {
      setMembershipStates(current => ({ ...current, [slug]: "active" }));
    }
    await loadMap({ silent: true });
  };

  return (
    <section className="tab-content gg-global-map-page">
      <CreateWorldPanel
        isSignedIn={isSignedIn}
        onSignIn={onSignIn}
        onCreated={handleWorldCreated}
        onMessage={onMessage}
      />
      <GlobalMapScene
        worlds={worlds}
        membershipStates={membershipStates}
        onRequestMembership={requestMembership}
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
