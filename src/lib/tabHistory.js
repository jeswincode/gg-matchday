import { useEffect, useEffectEvent, useLayoutEffect } from "react";

export function readWorkspace() {
  return new URLSearchParams(window.location.search).get("view") === "clubs" ? "clubs" : "matchday";
}

export function readTab() {
  return new URLSearchParams(window.location.search).get("tab");
}

export function pushTab(workspace, tab) {
  const url = new URL(window.location.href);
  if (workspace === "clubs") url.searchParams.set("view", workspace);
  else url.searchParams.delete("view");
  url.searchParams.set("tab", tab);
  if (url.href !== window.location.href) window.history.pushState(null, "", url);
}

export function useTabHistory(onBackForward, manageScroll = false) {
  const restore = useEffectEvent(onBackForward);
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    if (manageScroll) window.history.scrollRestoration = "manual";
    const onPop = () => restore(readWorkspace(), readTab());
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (manageScroll) window.history.scrollRestoration = previous;
    };
  }, [manageScroll]);
}

const positions = new Map();

export function useTabScroll(id, tab) {
  useLayoutEffect(() => {
    if (!id) return undefined;
    const key = id + ":" + tab;
    window.scrollTo({ top: positions.get(key) ?? 0, behavior: "instant" });
    const save = () => positions.set(key, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [id, tab]);
}
