import { useCallback, useEffect, useState } from "react";
import { api, setApiActiveWorld } from "../../lib/api";
import { getActiveWorldSlug } from "../../lib/worldContext.js";
import { isPwaStandalone, promptPwaInstall, subscribeToAppInstalled, subscribeToInstallPrompt } from "../../lib/pwaInstall.js";
import GlobalMapScene from "./GlobalMapScene";
import WorldMapView from "./WorldMapView";
import "./immersive-world-map.css";

async function fetchWorldData(isSignedIn) {
  const publicResult = await api("/worlds/map");
  const worlds = Array.isArray(publicResult?.worlds) ? publicResult.worlds : [];
  const availablePlots = Array.isArray(publicResult?.availablePlots) ? publicResult.availablePlots : [];
  let membershipStates = {};
  let myWorlds = [];
  let reviewQueues = [];

  if (isSignedIn) {
    const ownResult = await api("/worlds/me");
    const ownWorlds = Array.isArray(ownResult?.worlds) ? ownResult.worlds : [];
    myWorlds = ownWorlds;
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
      r¶»§q«^