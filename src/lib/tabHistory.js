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

export function readTabScroll(id, tab) {
  return positions.get(id + ":" + tab) ?? 0;
}

export function saveTabScroll(id, tab) {
  if (id) positions.set(id + ":" + tab, window.scrollY);
}

export function useTabScroll(id, tab) {
  useLayoutEffect(() => {
    if (!id) return undefined;
    window.scrollTo({ top: readTabScroll(id, tab), behavior: "instant" });
    const save = () => saveTabScroll(id, tab);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [id, tab]);
}
