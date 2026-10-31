import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import GlobalMapScene from "./GlobalMapScene";

export default function GlobalMapPage({ isSignedIn = false, onMessage }) {
  const [worlds, setWorlds] = useState([]);
  const [membershipStates, setMembershipStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadMap = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);

    try {
      const publicResult = await api("/worlds/map");
      const publicWorlds = Array.isArray(publicResult?.worlds) ? publicResult.worlds : [];
      let states = {};

      if (isSignedIn) {
        const ownResult = await api("/worlds/me");
        const ownWorlds = Array.isArray(ownResult?.worlds) ? ownResult.worlds : [];
        for (const item of ownWorlds) {
          const status = item?.membership?.status;
          if (item?.slug && status) states[item.slug] = status;
        }
      }

      setWorlds(publicWorlds);
      setMembershipStates(states);
      setLoadError("");
    } catch (error) {
      setLoadError(error?.message || "Could not load the Global Map.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    loadMap();
  }, [loadMap]);

  const requestMembership = async world => {
    if (!isSignedIn) {
      onMessage?.("Sign in to request membership in " + world.name + ".");
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

  return (
    <section className="tab-content gg-global-map-page">
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
