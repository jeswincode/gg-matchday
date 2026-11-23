import {lazy, Suspense, useCallback, useRef} from 'react';
import {API_URL, api, authenticatedFetch, invalidate} from './lib/api';
import { createAccountSync, fetchMatchdayAccount } from "./lib/accountSync";
import { subscribeToProfileUpdates } from './lib/profileLive';
import { refreshLiveTopics, subscribeToAccountUpdates, useLiveRevision } from './lib/liveData';
import SwipePager from "./components/SwipePager";
import WorkspaceTransition from "./components/WorkspaceTransition";
import useDockDrag from "./components/useDockDrag";
import { pushTab, readTab, readWorkspace, useTabHistory } from "./lib/tabHistory";
import { pauseBackgroundForSwipe, setBackgroundActive } from "./video-background";
import NotificationIndicator from './components/NotificationIndicator';
import {StartupScreen, LoginDashboard, WelcomeScreen, MobileFullscreenScreen} from './components/StartupExperience';
// Keep the five primary navigation destinations in the initial JS graph.
// Otherwise the top-level Suspense boundary replaces the entire app shell
// with “Opening Matchday…” the first time a user opens each tab.
import LeaderboardView from './components/Leaderboard';
import MatchHistoryCard from './components/ui/MatchHistoryCard';
import PlayersDirectory from './features/players/PlayersDirectory';
import PlayerProfile from './features/players/PlayerProfile';
import AccountProfileSettings from './features/players/AccountProfileSettings';
import HomePage from './features/home/HomePage';
import Calendar from './features/calendar/Calendar';
import MatchRecordForm from './features/matches/MatchRecordForm';
// Heavier destinations stay split, but suspend only inside their own view.
const Clasico = lazy(() => import('./components/Clasico'));
const CommunityWorld = lazy(() => import('./features/world/CommunityWorld'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));
const ProfileRequests = lazy(() => import('./ProfileRequests'));
// Clubs is a primary product surface, so its code must be ready before
// navigation; background prefetch can race the user's first click.
import CompanionWorld from './features/companion/CompanionWorld';
import ClubsMode from './features/clubs/ClubsMode';
const Awards = lazy(()=>import('./components/Awards'));
const loadMatchDetail = () => import('./components/MatchDetail');
const MatchDetail = lazy(loadMatchDetail);
const HallOfFame = lazy(()=>import('./components/HallOfFame'));
const Chat = lazy(()=>import('./components/Chat'));
import {
  useEffect,
  useState,
} from "react";

import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";

import {
  auth,
  googleProvider,
} from "./firebase";

const TABS = {
  HOME: "home",
  RECORD: "record",
  LEADERBOARD: "leaderboard",
  CALENDAR: "calendar",
  PLAYERS: "players",
  ADMIN: "admin",
};

const TAB_ORDER = [
  TABS.HOME,
  TABS.RECORD,
  TABS.LEADERBOARD,
  TABS.CALENDAR,
  TABS.PLAYERS,
];

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sameId(a, b) {
  return String(a) === String(b);
}

function localDateString(
  date = new Date()
) {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function App() {
  const dockDrag = useDockDrag();
  const [worldAccount, setWorldAccount] = useState(null);
  const [experience,setExperience]=useState('startup');
  const [mobileEntry] = useState(() => window.matchMedia("(max-width: 767px), (hover: none) and (pointer: coarse)").matches);
  const [mobileEntryComplete, setMobileEntryComplete] = useState(() => Boolean(document.fullscreenElement));
  const [productMode,setProductMode]=useState(readWorkspace);
  const [clubsAdminEntry, setClubsAdminEntry] = useState(false);
  const [profileRequestMode, setProfileRequestMode] = useState(null);
  const [openingOwnProfile, setOpeningOwnProfile] = useState(false);
  const [ownProfileError, setOwnProfileError] = useState("");
  const [profileFocusRequest, setProfileFocusRequest] = useState(null);
  const playerDirectoryReturn = useRef(null);
  const ownProfileRequest = useRef(null);
  const [recordSection,setRecordSection]=useState('record');
  const [modal,setModal]=useState(null);
  const [detailId,setDetailId]=useState(null);
  const refreshKey = useLiveRevision("matchday");
  const newsRevision = useLiveRevision("news");
  const [overview,setOverview]=useState(null);
  const [archivePage,setArchivePage]=useState(1);
  const [archiveRetry, setArchiveRetry] = useState(0);
  const [archiveError, setArchiveError] = useState("");
  const archivePages = useRef(new Map());
  const [playersError, setPlayersError] = useState("");
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('gg-theme')==='golden'?'golden':'dark';}catch{return 'dark';}});
  const [modeTransition,setModeTransition]=useState(null);
  const pendingWorkspace = useRef(null);
  const closeModal=useCallback(()=>{setModal(null);setDetailId(null);},[]);

  useEffect(()=>{
    try{
      const url=new URL(window.location.href);
      if(url.searchParams.has("mode")){
        url.searchParams.delete("mode");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
      }
    }catch{
      // Ignore URL cleanup failures.
    }
  },[]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const icon = document.getElementById("gg-favicon");
    if (icon) icon.href = theme === "golden" ? icon.dataset.gold : icon.dataset.dark;
    try { localStorage.setItem("gg-theme", theme); } catch { /* Storage can be disabled. */ }
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.productMode = productMode;
  }, [productMode]);
  function navigateMatchdayTab(tab) {
    if (activeTab !== tab) pushTab("matchday", tab);
    setActiveTab(tab);
  }

  function showPlayer(playerId){const player=players.find(p=>String(p._id)===String(playerId));if(player){closeModal();openPlayerProfile(player);navigateMatchdayTab(TABS.PLAYERS);}}
  function showMatch(matchId){navigateMatchdayTab(TABS.CALENDAR);setDetailId(matchId);setModal('match');}

  // =========================================================
  // NAVIGATION
  // =========================================================

  const [
    activeTab,
    setActiveTab,
  ] = useState(() => readWorkspace() === "matchday" && TAB_ORDER.includes(readTab()) ? readTab() : TABS.HOME);
  function switchProductMode(nextMode, destination, adminEntry = false) {
    if (nextMode === productMode || pendingWorkspace.current) return;
    const defaultTab = nextMode === "clubs" ? "overview" : TAB_ORDER.includes(activeTab) ? activeTab : TABS.HOME;
    function openWorkspace() {
      setClubsAdminEntry(adminEntry);
      setProductMode(nextMode);
      if (nextMode === "matchday") setExperience("app");
      pushTab(nextMode, destination ?? defaultTab);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      openWorkspace();
      return;
    }
    pendingWorkspace.current = { workspace: nextMode, phase: "covering", openWorkspace };
    setModeTransition({ workspace: nextMode, phase: "covering" });
  }

  function advanceWorkspaceTransition(phase) {
    const pending = pendingWorkspace.current;
    if (pending?.phase !== phase) return;
    if (phase === "revealing") {
      pendingWorkspace.current = null;
      setModeTransition(null);
      return;
    }

    pending.phase = phase === "covering" ? "covered" : "revealing";
    if (phase === "covering") pending.openWorkspace();
    setModeTransition({ workspace: pending.workspace, phase: pending.phase });
  }

  useTabHistory((workspace, tab) => {
    if (pendingWorkspace.current) {
      pendingWorkspace.current = null;
      setModeTransition(null);
    }
    setProductMode(workspace);
    setClubsAdminEntry(false);
    closeModal();
    if (workspace === "matchday") {
      setActiveTab(TAB_ORDER.includes(tab) ? tab : TABS.HOME);
      setExperience("app");
    }
  }, true);

  // =========================================================
  // AUTH
  // =========================================================

  const [
    authUser,
    setAuthUser,
  ] = useState(null);

  const [
    backendUser,
    setBackendUser,
  ] = useState(null);

  const [
    authLoading,
    setAuthLoading,
  ] = useState(
    Boolean(auth) || Boolean(
      import.meta.env.VITE_E2E_TEST_AUTH_SECRET &&
      new URLSearchParams(window.location.search).get("e2eRole") !== "guest",
    ),
  );
  const [signingIn, setSigningIn] = useState(false);
  const [accountSyncError, setAccountSyncError] = useState("");
  const retryAccountSync = useRef(null);

  const [
    message,
    setMessage,
  ] = useState("");

  // =========================================================
  // MAIN DATA
  // =========================================================

  const [
    players,
    setPlayers,
  ] = useState([]);

  const [
    matches,
    setMatches,
  ] = useState([]);

  const [
    news,
    setNews,
  ] = useState([]);

  const [
    leaderboard,
    setLeaderboard,
  ] = useState([]);

  const [
    loadingPlayers,
    setLoadingPlayers,
  ] = useState(true);

  const [
    loadingMatches,
    setLoadingMatches,
  ] = useState(true);

  const [
    newsLoading,
    setNewsLoading,
  ] = useState(true);


  // =========================================================
  // PLAYER PROFILE
  // =========================================================

  const [
    selectedPlayer,
    setSelectedPlayer,
  ] = useState(null);

  const [
    editingProfile,
    setEditingProfile,
  ] = useState(false);

  const [profileSaveError, setProfileSaveError] = useState("");
  const closePlayerEditor = useCallback(() => setEditingProfile(false), []);

  const [
    profileSaving,
    setProfileSaving,
  ] = useState(false);

  const [
    profileForm,
    setProfileForm,
  ] = useState({
    name: "",
    profileImage: "",
    height: "",
    weight: "",
    position: "",
    preferredFoot: "",
    jerseyNumber: "",
    dateOfBirth: "",
    bio: "",
    backgroundVideoUrl: "",
  });

  const [
    playerReview,
    setPlayerReview,
  ] = useState(null);

  const [
    playerReviewLoading,
    setPlayerReviewLoading,
  ] = useState(false);

  // =========================================================
  // PLAYERS
  // =========================================================

  const [
    newPlayerName,
    setNewPlayerName,
  ] = useState("");

  const [
    playerActionLoading,
    setPlayerActionLoading,
  ] = useState(false);

  // =========================================================
  // MATCH FORM
  // =========================================================

  const [
    editingMatchId,
    setEditingMatchId,
  ] = useState(null);

  const [
    date,
    setDate,
  ] = useState(
    localDateString()
  );

  const [
    matchName,
    setMatchName,
  ] = useState("");

  const [
    teamALabel,
    setTeamALabel,
  ] = useState("Team A");

  const [
    teamBLabel,
    setTeamBLabel,
  ] = useState("Team B");

  const [
    teams,
    setTeams,
  ] = useState({});

  const [
    goals,
    setGoals,
  ] = useState({});

  const [
    assists,
    setAssists,
  ] = useState({});

  const [
    ownGoals,
    setOwnGoals,
  ] = useState({});

  const [legacyMatchContext,setLegacyMatchContext] = useState(null);
  const [bookedFixture, setBookedFixture] = useState(null);
  const [performanceCodes,setPerformanceCodes] = useState({});

  const [
    savingMatch,
    setSavingMatch,
  ] = useState(false);

  // =========================================================
  // ADMIN
  // =========================================================

  const [
    editorRequests,
    setEditorRequests,
  ] = useState([]);

  const [
    activeEditors,
    setActiveEditors,
  ] = useState([]);

  const [
    adminLoading,
    setAdminLoading,
  ] = useState(false);

  const [
    editorsLoading,
    setEditorsLoading,
  ] = useState(false);

  const [
    adminActionLoading,
    setAdminActionLoading,
  ] = useState(false);

  // =========================================================
  // PERMISSIONS
  // =========================================================

  const isSignedIn =
    Boolean(authUser);

  const isAdmin = isSignedIn && backendUser?.role === "admin";

  const linkedPlayerId = isSignedIn ? backendUser?.playerProfile : null;
  useEffect(() => () => { ownProfileRequest.current = null; }, [backendUser?.id, linkedPlayerId]);

  const isEditor = isSignedIn && (backendUser?.role === "editor" || isAdmin);

  const hasPendingRequest =
    backendUser?.accessRequest ===
    "pending";

  // =========================================================
  // AUTH STATE
  // =========================================================

  useEffect(() => {
    const testSecret = import.meta.env.VITE_E2E_TEST_AUTH_SECRET;
    if (!auth && !testSecret) return;

    let active = true;
    let unsubscribe;
    let testHeaders;

    const accountSync = createAccountSync({
      onIdentity(user) {
        setAuthUser(user);
        setBackendUser(null);
        setAccountSyncError("");
        setAuthLoading(Boolean(user));
      },
      onStart() {
        setAccountSyncError("");
        setAuthLoading(true);
      },
      async load(firebaseUser, signal) {
        if (testHeaders) return fetchMatchdayAccount(API_URL, testHeaders, signal);
        async function loadWithToken(forceRefresh) {
          const token = await firebaseUser.getIdToken(forceRefresh);
          signal.throwIfAborted();
          return fetchMatchdayAccount(API_URL, { Authorization: `Bearer ${token}` }, signal);
        }
        try {
          return await loadWithToken(false);
        } catch (error) {
          if (error?.status === 401 && !signal.aborted) return loadWithToken(true);
          throw error;
        }
      },
      onResult(user, { recovered }) {
        setBackendUser(user);
        if (recovered) refreshLiveTopics(["matchday", "news", "clubs"]);
      },
      onError(error) {
        setAccountSyncError(error?.retryable === false
          ? "We couldn't verify your Matchday account. Try again or sign out and back in."
          : "Matchday is taking longer than expected to sync your account.");
      },
      onSettled() { setAuthLoading(false); },
    });

    function retryWhenAvailable() {
      if (!document.hidden) void accountSync.retry({ automatic: true });
    }

    if (testSecret) {
      const params = new URLSearchParams(window.location.search);
      const role = params.get("e2eRole") || import.meta.env.VITE_E2E_TEST_ROLE || "viewer";
      const playerId = params.get("e2ePlayerId") || import.meta.env.VITE_E2E_TEST_PLAYER_ID || "";
      if (role === "guest") return;
      testHeaders = {
        "X-E2E-Test-Token": testSecret,
        "X-E2E-Test-Role": role,
        ...(playerId ? { "X-E2E-Test-Player-Id": playerId } : {}),
      };
      void accountSync.sync({ uid: `e2e-test:${role}:${playerId || "unlinked"}`, displayName: `Playwright ${role}` });
    } else {
      unsubscribe = onAuthStateChanged(auth, user => {
        if (active) void accountSync.sync(user);
      });

      // Consume a pending redirect result when the auth observer is delayed.
      getRedirectResult(auth)
        .then(result => {
          if (active && result?.user && result.user.uid === auth.currentUser?.uid) {
            return accountSync.sync(result.user);
          }
        })
        .catch(error => {
          console.error("Redirect auth result error:", error);
          if (active && !auth.currentUser) {
            setAuthLoading(false);
            setMessage(error?.code === "auth/web-storage-unsupported"
              ? "Google sign-in needs browser storage enabled."
              : `${error?.code || "auth-error"}: ${error?.message || "Google sign-in could not be completed."}`);
          }
        });
    }

    retryAccountSync.current = accountSync.retry;
    window.addEventListener("online", retryWhenAvailable);
    document.addEventListener("visibilitychange", retryWhenAvailable);
    return () => {
      active = false;
      accountSync.cancel();
      unsubscribe?.();
      retryAccountSync.current = null;
      window.removeEventListener("online", retryWhenAvailable);
      document.removeEventListener("visibilitychange", retryWhenAvailable);
    };
  }, []);

  const finishStartup = useCallback(() => {
    setExperience(mobileEntry && mobileEntryComplete && authLoading
      ? "app"
      : authUser ? "welcome" : "entry");
  }, [authUser, authLoading, mobileEntry, mobileEntryComplete]);

  function completeMobileEntry() {
    setMobileEntryComplete(true);
    if (authLoading) setExperience("app");
  }

  function enterGuestMode() {
    setExperience("app");
  }

  const signedInEntry = experience === "entry" && Boolean(authUser);
  const activeExperience = signedInEntry || experience === "welcome"
    ? (mobileEntry ? "app" : "welcome")
    : experience;
  const fullscreenPromptOpen = mobileEntry && !mobileEntryComplete;
  const liveActive = !fullscreenPromptOpen && (activeExperience === "app" || productMode === "clubs");
  const accountId = isSignedIn ? backendUser?.id : null;
  const matchdayActive = liveActive && productMode === "matchday";
  const backgroundActive = productMode === "matchday" && (activeExperience === "startup" || matchdayActive);
  const primaryTabsActive = matchdayActive && activeTab !== TABS.ADMIN;

  useEffect(() => {
    if (matchdayActive && activeTab === TABS.CALENDAR) void loadMatchDetail().catch(() => {});
  }, [matchdayActive, activeTab]);

  useEffect(() => {
    setBackgroundActive(backgroundActive);
    return () => setBackgroundActive(false);
  }, [backgroundActive]);

  useEffect(() => {
    archivePages.current.clear();
  }, [primaryTabsActive, refreshKey]);

  useEffect(() => {
    if (!liveActive) return undefined;
    const changed = event => {
      const path = event.detail?.path;
      if (!path || /^\/(matches|players|admin\/gg|rating-disputes)(\/|$)/.test(path)) {
        refreshLiveTopics(["matchday"]);
      } else if (/^\/news\/(generate\/|[^/]+$)/.test(path)) {
        refreshLiveTopics(["news"]);
      }
    };
    window.addEventListener("gg-data-changed", changed);
    return () => window.removeEventListener("gg-data-changed", changed);
  }, [liveActive]);

  useEffect(() => {
    if (!liveActive || !accountId) return undefined;
    return subscribeToAccountUpdates();
  }, [liveActive, accountId]);

  useEffect(() => {
    if (!matchdayActive) return undefined;
    let active = true;
    api("/players", { publicRead: true }).then(latest => {
      if (!active || !Array.isArray(latest)) return;
      setPlayersError("");
      setPlayers(latest);
      setSelectedPlayer(current => current
        ? latest.find(player => sameId(player._id, current._id)) || null
        : null);
    }).catch(error => { if (active) setPlayersError(error.message || "Could not load players."); })
      .finally(() => { if (active) setLoadingPlayers(false); });
    return () => { active = false; };
  }, [matchdayActive, refreshKey]);

  useEffect(() => {
    if (!primaryTabsActive) return undefined;
    let active = true;
    const loaded = archivePages.current;
    const pages = Array.from({ length: archivePage }, async (_, index) => {
      const page = index + 1;
      if (loaded.has(page)) return loaded.get(page);
      const matches = await api(`/matches?page=${page}&limit=50`, { publicRead: true });
      if (active) loaded.set(page, matches);
      return matches;
    });
    Promise.all(pages).then(results => {
      if (!active) return;
      setArchiveError("");
      setMatches([...new Map(results.flat().map(match => [match._id, match])).values()]);
    }).catch(error => {
      if (active) setArchiveError(error.message || "Could not load matches.");
    }).finally(() => {
      if (active) setLoadingMatches(false);
    });
    return () => { active = false; };
  }, [primaryTabsActive, archivePage, archiveRetry, refreshKey]);

  useEffect(() => {
    if (!primaryTabsActive) return undefined;
    let active = true;
    api("/stats/overview", { publicRead: true }).then(data => { if (active) setOverview(data); }).catch(() => {});
    return () => { active = false; };
  }, [primaryTabsActive, refreshKey]);

  useEffect(() => {
    if (!primaryTabsActive) return undefined;
    let active = true;
    api("/news?limit=6", { publicRead: true }).then(data => {
      if (active) setNews(Array.isArray(data) ? data : []);
    }).catch(error => { if (active) console.error(error); })
      .finally(() => { if (active) setNewsLoading(false); });
    return () => { active = false; };
  }, [primaryTabsActive, newsRevision]);

  useEffect(() => {
    if (!primaryTabsActive) return undefined;
    let active = true;
    api("/stats/leaderboard", { publicRead: true }).then(data => {
      if (active) setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : []);
    }).catch(error => { if (active) console.error(error); });
    return () => { active = false; };
  }, [primaryTabsActive, refreshKey]);

  // Update open player profiles, roster cards and admin controls without
  // remounting tabs or forcing a full browser reload.
  useEffect(() => {
    if (!liveActive) return undefined;
    let active = true;
    const onProfile = async id => {
      try {
        const updated = await api("/players/" + encodeURIComponent(id));
        if (!active) return;
        setPlayers(current => current.map(player => String(player._id) === String(id) ? updated : player));
        setSelectedPlayer(current => current && String(current._id) === String(id) ? updated : current);
      } catch { /* Reconnect reconciliation handles transient errors. */ }
    };
    const unsubscribe = subscribeToProfileUpdates({ onProfile });
    return () => { active = false; unsubscribe(); };
  }, [liveActive]);



  // =========================================================
  // LOGIN / LOGOUT
  // =========================================================

  async function signIn() {
    if (!auth) {
      setMessage("Sign-in is not configured for this environment yet.");
      return;
    }

    try {
      setMessage("");
      setSigningIn(true);
      setAuthLoading(true);

      // Popup auth works across desktop and mobile Chrome. Firebase
      // recommends it as the alternative when redirect auth is affected
      // by browser storage restrictions.
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google sign-in error:", error);

      let finalError = error;

      const canFallbackToRedirect = [
        "auth/popup-blocked",
        "auth/popup-timeout",
        "auth/operation-not-supported-in-this-environment",
        "auth/cancelled-popup-request",
      ].includes(error?.code);

      if (canFallbackToRedirect) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          console.error(
            "Google redirect fallback error:",
            redirectError,
          );
          setAuthLoading(false);
          finalError = redirectError;
        }
      } else {
        setAuthLoading(false);
      }

      setMessage(
        finalError?.code === "auth/popup-closed-by-user"
          ? "Sign-in cancelled."
          : `${finalError?.code || "auth-error"}: ${finalError?.message || "Google sign-in failed."}`,
      );
    } finally {
      setSigningIn(false);
    }
  }

  async function logout() {
    try {
      await signOut(auth);
      setWorldAccount(null);
      closeModal();
      closePlayerEditor();

      setBackendUser(null);

      if (
        activeTab ===
          TABS.RECORD ||
        activeTab ===
          TABS.ADMIN
      ) {
        setActiveTab(
          TABS.HOME
        );
      }

      setExperience("entry");
      setMessage(
        "Signed out."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not sign out."
      );
    }
  }

  // =========================================================
  // EDITOR REQUEST
  // =========================================================

  async function requestEditorAccess() {
    if (!isSignedIn) {
      setMessage(
        "Sign in first."
      );
      return;
    }

    try {
      const response =
        await authenticatedFetch(
          `${API_URL}/auth/request-editor`,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not submit request."
        );
      }

      const updated = data.user;
      if (updated) setBackendUser(current => current && sameId(current.id, updated.id ?? updated._id)
        ? { ...current, role: updated.role, accessRequest: updated.accessRequest }
        : current);

      setMessage(
        "Editor access request submitted."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Could not submit editor request."
      );
    }
  }

  // =========================================================
  // PLAYER ACTIONS
  // =========================================================

  async function addPlayer(
    event
  ) {
    event.preventDefault();

    if (!isEditor) {
      setMessage(
        "Editor access required."
      );
      return;
    }

    const name =
      newPlayerName.trim();

    if (!name) {
      setMessage(
        "Enter a player name."
      );
      return;
    }

    try {
      setPlayerActionLoading(
        true
      );

      const created = await api("/players", { method: "POST", body: { name } });
      setPlayers(current => current.some(player => sameId(player._id, created._id))
        ? current
        : [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewPlayerName("");

      setMessage(
        `${name} added.`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Could not add player."
      );
    } finally {
      setPlayerActionLoading(
        false
      );
    }
  }

  async function deletePlayer(
    playerId
  ) {
    if (!isEditor) {
      setMessage(
        "Editor access required."
      );
      return;
    }

    const player =
      players.find(
        (item) =>
          sameId(
            item._id,
            playerId
          )
      );

    if (!player) return;

    if (
      !window.confirm(
        `Delete ${player.name}?`
      )
    ) {
      return;
    }

    try {
      await api("/players/" + encodeURIComponent(playerId), { method: "DELETE" });
      setPlayers(current => current.filter(player => !sameId(player._id, playerId)));
      setSelectedPlayer(null);
      setPlayerReview(null);

      setMessage(
        `${player.name} deleted.`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Could not delete player."
      );
    }
  }

  // =========================================================
  // PROFILE
  // =========================================================

  async function openOwnProfile({ edit = false } = {}) {
    if (!linkedPlayerId || ownProfileRequest.current) return;
    const request = {};
    ownProfileRequest.current = request;
    setOwnProfileError("");
    setOpeningOwnProfile(true);
    try {
      const player = players.find(entry => sameId(entry._id, linkedPlayerId)) ||
        await api("/players/" + encodeURIComponent(linkedPlayerId));
      if (ownProfileRequest.current !== request) return;
      closeModal();
      openPlayerProfile(player);
      if (edit && isEditor) openPlayerEditor();
      if (productMode === "clubs") {
        setActiveTab(TABS.PLAYERS);
        switchProductMode("matchday", TABS.PLAYERS);
      } else {
        navigateMatchdayTab(TABS.PLAYERS);
      }
    } catch (error) {
      if (ownProfileRequest.current === request) {
        setOwnProfileError(error.status === 404 ? "Your linked player profile could not be found." : "Couldn’t open your profile. Try again.");
      }
    } finally {
      if (ownProfileRequest.current === request || !ownProfileRequest.current) setOpeningOwnProfile(false);
      if (ownProfileRequest.current === request) ownProfileRequest.current = null;
    }
  }

  function openPlayerProfile(player) {
    if (productMode === "matchday" && activeTab === TABS.PLAYERS && !selectedPlayer) {
      playerDirectoryReturn.current = { top: window.scrollY, focus: document.activeElement };
    }
    setProfileFocusRequest({});
    setSelectedPlayer(
      player
    );

    setEditingProfile(
      false
    );

    setPlayerReview(null);

    setProfileForm({
      name:
        player.name ||
        "",

      profileImage:
        player.profileImage ||
        "",

      height:
        player.height ??
        "",

      weight:
        player.weight ??
        "",

      position:
        player.position ||
        "",

      preferredFoot:
        player.preferredFoot ||
        "",

      jerseyNumber:
        player.jerseyNumber ??
        "",

      dateOfBirth:
        player.dateOfBirth
          ? new Date(
              player.dateOfBirth
            )
              .toISOString()
              .split("T")[0]
          : "",

      bio:
        player.bio ||
        "",
      backgroundVideoUrl:
        player.backgroundVideoUrl ||
        "",
    });


  }

  function openPlayerEditor() {
    if (!isEditor) return;
    setProfileSaveError("");
    setEditingProfile(true);
  }

  async function updatePlayerOvrAttributes(playerId, pace, physical) {
    if (!isAdmin) {
      setMessage("Admin access required.");
      throw new Error("Admin access required.");
    }

    const response = await authenticatedFetch(
      `${API_URL}/players/${playerId}/ovr-attributes`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pace, physical }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Could not update player OVR attributes.");
    }

    setPlayers(current =>
      current.map(player =>
        sameId(player._id, data.player?._id) ? data.player : player,
      ),
    );
    setSelectedPlayer(current =>
      current && sameId(current._id, data.player?._id) ? data.player : current,
    );
    invalidate();
    setMessage("Player OVR attributes updated.");
    return data;
  }

  async function updatePlayerBackgroundVideo(playerId, backgroundVideoUrl) {
    if (!isAdmin) {
      setMessage("Admin access required.");
      throw new Error("Admin access required.");
    }

    const response = await authenticatedFetch(
      `${API_URL}/players/${playerId}/background-video`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backgroundVideoUrl }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Could not update player background video.");
    }

    setPlayers(current =>
      current.map(player =>
        sameId(player._id, data._id) ? data : player,
      ),
    );

    setSelectedPlayer(current =>
      current && sameId(current._id, data._id) ? data : current,
    );

    invalidate();
    setMessage(backgroundVideoUrl ? "Player background video updated." : "Player background video cleared.");
    return data;
  }

  async function loadPlayerReview(
    playerId
  ) {
    try {
      setPlayerReviewLoading(
        true
      );

      const response =
        await authenticatedFetch(
          `${API_URL}/news/player/${playerId}`,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not generate review."
        );
      }

      setPlayerReview(
        data
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Could not generate review."
      );
    } finally {
      setPlayerReviewLoading(
        false
      );
    }
  }

  async function savePlayerProfile(
    event
  ) {
    event.preventDefault();
    if (profileSaving) return;

    if (
      !isEditor ||
      !selectedPlayer
    ) {
      setProfileSaveError(
        "Editor access required."
      );
      return;
    }

    try {
      setProfileSaving(true);
      setProfileSaveError("");

      const updated = await api("/players/" + encodeURIComponent(selectedPlayer._id), {
        method: "PUT",
        body: profileForm,
      });
      setPlayers(current => current.map(player => sameId(player._id, updated._id) ? updated : player));
      setSelectedPlayer(updated);
      setEditingProfile(false);

      setMessage(
        "Player profile updated."
      );
    } catch (error) {
      console.error(error);

      setProfileSaveError(
        error.message ||
          "Could not update profile."
      );
    } finally {
      setProfileSaving(
        false
      );
    }
  }

  // =========================================================
  // MATCH FORM
  // =========================================================

  function resetMatchForm() {
    setEditingMatchId(null);
    setBookedFixture(null);
    setDate(
      localDateString()
    );
    setMatchName("");
    setTeamALabel("Team A");
    setTeamBLabel("Team B");
    setTeams({});
    setGoals({});
    setAssists({});
    setOwnGoals({});
    setLegacyMatchContext(null);
    setPerformanceCodes({});
  }

  function setPlayerTeam(
    playerId,
    team
  ) {
    const id =
      String(playerId);

    setTeams(
      (current) => {
        if (
          current[id] ===
          team
        ) {
          const next = {
            ...current,
          };

          delete next[id];

          return next;
        }

        return {
          ...current,
          [id]:
            team,
        };
      }
    );
  }

  function changeCount(
    setter,
    playerId,
    amount
  ) {
    const id =
      String(playerId);

    setter(
      (current) => ({
        ...current,

        [id]:
          Math.max(
            0,
            (
              current[id] ||
              0
            ) + amount
          ),
      })
    );
  }

  function startEditingMatch(
    match
  ) {
    if (!isEditor) {
      return;
    }

    setRecordSection("record");
    setPerformanceCodes(Object.fromEntries((match.participants||[]).map(p=>[String(p.player?._id||p.player),Array.isArray(p.performanceCodes)?p.performanceCodes:[]])));
    const nextTeams =
      {};

    const nextGoals =
      {};

    const nextAssists =
      {};

    const nextOwnGoals =
      {};

    for (
      const participant of
        match.participants ||
        []
    ) {
      const id =
        participant.player?._id ||
        participant.player;

      if (id) {
        nextTeams[
          String(id)
        ] =
          participant.team;
        nextOwnGoals[String(id)] = Number(participant.ownGoals || 0);
      }
    }

    for (
      const event of
        match.events ||
        []
    ) {
      const id =
        event.player?._id ||
        event.player;

      if (!id) continue;

      const key =
        String(id);

      if (
        event.type ===
        "goal"
      ) {
        nextGoals[key] =
          (
            nextGoals[key] ||
            0
          ) + 1;
      }

      if (
        event.type ===
        "assist"
      ) {
        nextAssists[key] =
          (
            nextAssists[key] ||
            0
          ) + 1;
      }
    }

    setEditingMatchId(
      match._id
    );

    setDate(
      localDateString(
        new Date(
          match.date
        )
      )
    );

    setMatchName(
      match.name ||
        ""
    );

    setTeamALabel(
      match.teamA?.label ||
        "Team A"
    );

    setTeamBLabel(
      match.teamB?.label ||
        "Team B"
    );

    setTeams(
      nextTeams
    );

    setGoals(
      nextGoals
    );

    setAssists(
      nextAssists
    );

    setOwnGoals(
      nextOwnGoals
    );

    const isLegacyMatch = !(match.events || []).length && !(match.participants || []).some((participant) => Number(participant.ownGoals || 0) > 0);
    setLegacyMatchContext(isLegacyMatch ? {teamA:Number(match.teamA?.score||0),teamB:Number(match.teamB?.score||0),teams:nextTeams} : null);

    navigateMatchdayTab(
      TABS.RECORD
    );

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  const teamAPlayers = [];
  const teamBPlayers = [];
  const assignedPlayers = [];
  for (const player of players) {
    const team = teams[String(player._id)];
    if (team === "A") teamAPlayers.push(player);
    else if (team === "B") teamBPlayers.push(player);
    else continue;
    assignedPlayers.push(player);
  }

  const teamANormalScore =
    teamAPlayers.reduce(
      (total, player) =>
        total + (goals[String(player._id)] || 0),
      0
    );

  const teamBNormalScore =
    teamBPlayers.reduce(
      (total, player) =>
        total + (goals[String(player._id)] || 0),
      0
    );

  const teamAOwnGoals =
    teamBPlayers.reduce(
      (total, player) =>
        total + (ownGoals[String(player._id)] || 0),
      0
    );

  const teamBOwnGoals =
    teamAPlayers.reduce(
      (total, player) =>
        total + (ownGoals[String(player._id)] || 0),
      0
    );

  const legacyTeamsUnchanged = legacyMatchContext && players.every((player) => (teams[String(player._id)] || null) === (legacyMatchContext.teams[String(player._id)] || null));
  const legacyEventsUntouched = legacyMatchContext && teamANormalScore + teamBNormalScore + teamAOwnGoals + teamBOwnGoals === 0;
  const legacyScoreActive = Boolean(legacyMatchContext && legacyTeamsUnchanged && legacyEventsUntouched);
  const teamAScore = legacyScoreActive ? legacyMatchContext.teamA : teamANormalScore + teamAOwnGoals;
  const teamBScore = legacyScoreActive ? legacyMatchContext.teamB : teamBNormalScore + teamBOwnGoals;

  const totalGoals =
    teamAScore +
    teamBScore;

  const totalAssists =
    assignedPlayers.reduce(
      (
        total,
        player
      ) =>
        total +
        (
          assists[
            String(
              player._id
            )
          ] ||
          0
        ),
      0
    );

  function buildEvents() {
    const events = [];

    assignedPlayers.forEach(
      (player) => {
        const id =
          String(
            player._id
          );

        const playerGoals =
          goals[id] ||
          0;

        const playerAssists =
          assists[id] ||
          0;

        for (
          let i = 0;
          i <
          playerGoals;
          i += 1
        ) {
          events.push({
            player:
              player._id,
            type:
              "goal",
          });
        }

        for (
          let i = 0;
          i <
          playerAssists;
          i += 1
        ) {
          events.push({
            player:
              player._id,
            type:
              "assist",
          });
        }
      }
    );

    return events;
  }

  async function saveMatch(
    event
  ) {
    event.preventDefault();

    if (!isEditor) {
      setMessage(
        "Editor access required."
      );
      return;
    }

    if (
      teamAPlayers.length ===
      0 ||
      teamBPlayers.length ===
      0
    ) {
      setMessage(
        "Both sides need at least one player."
      );
      return;
    }

    if (
      totalAssists >
      totalGoals
    ) {
      setMessage(
        "Assists cannot be greater than total goals."
      );
      return;
    }

    try {
      setSavingMatch(true);

      const payload = {
        date,
        ...(bookedFixture && !editingMatchId ? { clubFixtureId: bookedFixture.id } : {}),

        name:
          matchName.trim() ||
          "Football Match",

        teamA: {
          label:
            teamALabel.trim() ||
            "Team A",

          score:
            teamAScore,
        },

        teamB: {
          label:
            teamBLabel.trim() ||
            "Team B",

          score:
            teamBScore,
        },

        participants:
          assignedPlayers.map(
            (player) => ({
              player:
                player._id,
              performanceCodes: performanceCodes[String(player._id)] || [],
              ownGoals: ownGoals[String(player._id)] || 0,
              team:
                teams[
                  String(
                    player._id
                  )
                ],
            })
          ),

        events:
          buildEvents(),
      };

      const url =
        editingMatchId
          ? `${API_URL}/matches/${editingMatchId}`
          : `${API_URL}/matches`;

      const method =
        editingMatchId
          ? "PUT"
          : "POST";

      const response =
        await authenticatedFetch(
          url,
          {
            method,

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not save match."
        );
      }

      const savedMessage = editingMatchId ? "Match updated." : "Match recorded.";
      let clubMessage = "";
      if (data.clubsSyncPending) {
        clubMessage = " Clubs synchronization is pending.";
      } else if (data.clubResult === "booked" || data.clubResult === "unbooked") {
        clubMessage = data.clubResult === "booked"
          ? " The booked Club fixture is complete." : " Saved in Clubs as an unbooked result.";
      } else if (/\bclubs\b/i.test(payload.name)) {
        clubMessage = " No Club result was linked. Check the Club names and player contracts on the match date.";
      }
      refreshLiveTopics(["matchday", "news"]);
      resetMatchForm();
      setMessage(savedMessage + clubMessage);
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Could not save match."
      );
    } finally {
      setSavingMatch(false);
    }
  }

  async function deleteMatch(
    matchId
  ) {
    if (!isEditor) {
      return;
    }

    if (
      !window.confirm(
        "Delete this match permanently?"
      )
    ) {
      return;
    }

    try {
      const response =
        await authenticatedFetch(
          `${API_URL}/matches/${matchId}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not delete match."
        );
      }

      if (
        sameId(
          editingMatchId,
          matchId
        )
      ) {
        resetMatchForm();
      }

      refreshLiveTopics(["matchday", "news"]);
      setMessage(
        "Match deleted."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Could not delete match."
      );
    }
  }

  // =========================================================
  // ADMIN
  // =========================================================

  async function loadEditorRequests() {
    if (!isAdmin) return;

    try {
      setAdminLoading(true);

      const response =
        await authenticatedFetch(
          `${API_URL}/auth/admin/requests`
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not load requests."
        );
      }

      setEditorRequests(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Could not load editor requests."
      );
    } finally {
      setAdminLoading(false);
    }
  }

  async function loadActiveEditors() {
    if (!isAdmin) return;

    try {
      setEditorsLoading(true);

      const response =
        await authenticatedFetch(
          `${API_URL}/auth/admin/editors`
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not load editors."
        );
      }

      setActiveEditors(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Could not load editors."
      );
    } finally {
      setEditorsLoading(false);
    }
  }

  useEffect(() => {
    if (
      activeTab ===
        TABS.ADMIN &&
      isAdmin
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize remote administrative data on tab entry.
      loadEditorRequests();
      loadActiveEditors();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- These loaders use the current Firebase account and stable state setters; entering Admin refreshes them.
  }, [
    activeTab,
    isAdmin,
  ]);

  async function handleEditorRequest(
    userId,
    action
  ) {
    if (!isAdmin) return;

    const label =
      action ===
      "approve"
        ? "approve"
        : "reject";

    if (
      !window.confirm(
        `Are you sure you want to ${label} this request?`
      )
    ) {
      return;
    }

    try {
      setAdminActionLoading(
        true
      );

      const response =
        await authenticatedFetch(
          `${API_URL}/auth/admin/requests/${userId}/${action}`,
          {
            method:
              "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Could not ${label} request.`
        );
      }

      await Promise.all([
        loadEditorRequests(),
        loadActiveEditors(),
      ]);

      setMessage(
        data.message ||
          `Request ${label}d.`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          `Could not ${label} request.`
      );
    } finally {
      setAdminActionLoading(
        false
      );
    }
  }

  async function revokeEditor(
    userId
  ) {
    if (!isAdmin) return;

    const editor =
      activeEditors.find(
        (item) =>
          sameId(
            item._id,
            userId
          )
      );

    if (!editor) return;

    if (
      !window.confirm(
        `Remove editor access from ${
          editor.name ||
          editor.email
        }?`
      )
    ) {
      return;
    }

    try {
      setAdminActionLoading(
        true
      );

      const response =
        await authenticatedFetch(
          `${API_URL}/auth/admin/editors/${userId}/revoke`,
          {
            method:
              "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not revoke editor access."
        );
      }

      await loadActiveEditors();

      setMessage(
        data.message ||
          "Editor access revoked."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Could not revoke editor access."
      );
    } finally {
      setAdminActionLoading(
        false
      );
    }
  }

  // =========================================================
  // RANKINGS
  // =========================================================

  // =========================================================
  // HOME
  // =========================================================

  const latestMatch =
    matches[0] ||
    null;

  const latestGoals =
    latestMatch?.events?.filter(
      (event) =>
        event.type ===
        "goal"
    ) || [];

  const latestScorers =
    Object.values(
      latestGoals.reduce(
        (
          result,
          event
        ) => {
          const id =
            String(
              event.player?._id ||
                event.player
            );

          if (
            !result[id]
          ) {
            result[id] = {
              name:
                event.player?.name ||
                "Player",
              goals:
                0,
            };
          }

          result[id].goals +=
            1;

          return result;
        },
        {}
      )
    ).sort(
      (a, b) =>
        b.goals -
        a.goals
    );

  const latestTopScorer =
    latestScorers[0] ||
    null;

  const totalAllTimeGoals =
    matches.reduce(
      (
        total,
        match
      ) =>
        total +
        toNumber(
          match.teamA?.score
        ) +
        toNumber(
          match.teamB?.score
        ),
      0
    );

  // =========================================================
  // RENDER
  // =========================================================

  let workspaceContent;
  if (activeExperience === "startup") {
    workspaceContent = <StartupScreen authLoading={authLoading} onComplete={finishStartup} />;
  } else if (fullscreenPromptOpen) {
    workspaceContent = <MobileFullscreenScreen onContinue={completeMobileEntry} />;
  } else if (productMode === "clubs" && (authLoading || accountSyncError)) {
    workspaceContent = <main className="app app--matchday">
      <section className="account-bar">
        <span className="account-status" role={accountSyncError ? "alert" : "status"}>
          {accountSyncError || "Checking account..."}
        </span>
        <div className="account-actions">
          {accountSyncError && <button type="button" className="secondary-button" onClick={() => retryAccountSync.current?.()}>Retry account sync</button>}
          <button type="button" className="secondary-button" onClick={() => switchProductMode("matchday")}>← Matchday</button>
        </div>
      </section>
    </main>;
  } else if (productMode === "clubs") {
    workspaceContent = <ClubsMode onReturnToMatchday={() => switchProductMode("matchday")} authUser={backendUser} isAdmin={isAdmin}
      adminEntry={clubsAdminEntry} onOpenOwnProfile={linkedPlayerId ? openOwnProfile : null}
      openingOwnProfile={openingOwnProfile} ownProfileError={linkedPlayerId ? ownProfileError : ""} />;
  } else if (activeExperience === "entry") {
    workspaceContent = <LoginDashboard onSignIn={signIn} onGuest={enterGuestMode} busy={authLoading} signingIn={signingIn} message={message} />;
  } else if (activeExperience === "welcome") {
    workspaceContent = <WelcomeScreen onEnter={() => setExperience("app")} />;
  } else workspaceContent = (
    <main className={"app" + (activeTab === TABS.ADMIN ? " app--admin" : " app--matchday")}
      data-page-swipes={activeTab === TABS.ADMIN ? undefined : ""} data-companion-world>
      <NotificationIndicator accountId={accountId} />

      <div className="mobile-tab-stage">
      <header className="topbar" data-companion-surface="matchday-header">
        <div>
          <p className="eyebrow">
            GG MATCHDAY
          </p>

          <h1>
            Football Stats
          </h1>
        </div>

        <div className="status-dot">
          <span />
          LIVE
        </div>
        <div className="gg-header-actions"><button className="secondary-button" type="button" onClick={() => switchProductMode("clubs")}>Clubs</button><div className="gg-theme" aria-label="Theme">{[['dark','Dark'],['golden','Gold']].map(([value,label])=><button key={value} aria-pressed={theme===value} onClick={()=>setTheme(value)}>{label}</button>)}</div>{isSignedIn&&<button className="secondary-button" onClick={()=>setModal('chat')}>Chat</button>}</div>
      </header>

      {/* ACCOUNT */}

      <section className="account-bar">

        {authLoading ? (
          <span className="account-status" role="status">
            Checking account...
          </span>
        ) : authUser ? (
          <>
            <div className="account-user">
              <button type="button" className="gg-avatar-action gg-account-avatar" aria-label="Account profile settings"
                data-companion-surface="companion-seat" aria-haspopup="dialog" onClick={() => { setOwnProfileError(""); setModal("account"); }}>
              {authUser.photoURL ? (
                <img
                  src={
                    authUser.photoURL
                  }
                  alt=""
                />
              ) : (
                <span>
                  {(
                    backendUser?.name || authUser.displayName ||
                    authUser.email ||
                    "U"
                  )
                    .charAt(
                      0
                    )
                    .toUpperCase()}
                </span>
              )}
                <span className="gg-avatar-action-mark" aria-hidden="true">⚙</span>
              </button>

              <div>
                <strong>
                  {
                    backendUser?.name || authUser.displayName || "GG Matchday User"
                  }
                </strong>

                <small>
                  {backendUser?.role || "Account not synced"}
                </small>
              </div>

            </div>

            <div className="account-actions">

              {accountSyncError && <button type="button" className="secondary-button" onClick={() => retryAccountSync.current?.()}>
                Retry account sync
              </button>}
              {backendUser && !isEditor &&
                !hasPendingRequest && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      requestEditorAccess
                    }
                  >
                    Request Editor Access
                  </button>
                )}

              {hasPendingRequest && (
                <span className="request-pending">
                  Request pending
                </span>
              )}

              {isAdmin && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setActiveTab(activeTab === TABS.ADMIN ? TABS.HOME : TABS.ADMIN);
                    window.scrollTo(0, 0);
                  }}
                >
                  {activeTab === TABS.ADMIN ? "← Back to Matchday" : "⚙ Admin"}
                </button>
              )}

              {linkedPlayerId && <button type="button" className="secondary-button" onClick={() => openOwnProfile()} disabled={openingOwnProfile}>
                {openingOwnProfile ? "Opening profile…" : "Player Profile"}
              </button>}
              <button
                type="button"
                className="secondary-button"
                onClick={
                  logout
                }
              >
                Sign Out
              </button>

            </div>
          </>
        ) : (
          <div className="signed-out-account">
            <div>
              <strong>Viewer mode</strong>
              <small>Public read-only access</small>
            </div>
            <div className="account-entry-actions">
              <span className="account-entry-hint">Read-only access</span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setExperience("entry")}
              >
                Sign In
              </button>
            </div>
          </div>
        )}

      </section>

      {/* MESSAGE */}

      {accountSyncError && <p className="global-message" role="alert">{accountSyncError}</p>}
      {linkedPlayerId && ownProfileError && <p className="global-message" role="alert">{ownProfileError}</p>}
      {message && (
        <div className="global-message">

          <span>
            {message}
          </span>

          <button
            type="button"
            onClick={() =>
              setMessage("")
            }
          >
            ×
          </button>

        </div>
      )}

      {/* =====================================================
          HOME
      ===================================================== */}

      {activeTab !== TABS.ADMIN && <SwipePager id="matchday-pager" tabs={TAB_ORDER} active={activeTab} onNavigate={navigateMatchdayTab}
        onMotionChange={pauseBackgroundForSwipe}
        renderPane={pane => <>
      {pane === TABS.HOME && (
        <HomePage
          latestMatch={latestMatch}
          latestTopScorer={latestTopScorer}
          players={players}
          loadingPlayers={loadingPlayers}
          playersError={playersError}
          matches={matches}
          loadingMatches={loadingMatches}
          archiveError={archiveError}
          onRetryArchive={() => refreshLiveTopics(["matchday", "news"])}
          overview={overview}
          totalAllTimeGoals={totalAllTimeGoals}
          news={news}
          newsLoading={newsLoading}
          leaderboard={leaderboard}
          onHallOfFame={() => setModal('hall')}
          onPlayer={showPlayer}
          onLeaderboard={() => navigateMatchdayTab(TABS.LEADERBOARD)}
          onPlayers={() => navigateMatchdayTab(TABS.PLAYERS)}
          onRecord={() => navigateMatchdayTab(TABS.RECORD)}
          onOpenPlayer={(player) => {
            openPlayerProfile(player);
            navigateMatchdayTab(TABS.PLAYERS);
          }}
        />
      )}

      {/* =====================================================
          RECORD
      ===================================================== */}

      {pane === TABS.RECORD && <section className="tab-content">
        <div className="gg-secondary-tabs" role="tablist" aria-label="Record sections"><button role="tab" aria-selected={recordSection==='record'} onClick={()=>setRecordSection('record')}>Match Record</button><button role="tab" aria-selected={recordSection==='clasico'} onClick={()=>setRecordSection('clasico')}>El Clásico</button></div>
        {recordSection==='clasico'?<Suspense fallback={<div className="loading-panel" role="status">Preparing El Clásico…</div>}><Clasico onPlayer={showPlayer} onMatch={showMatch} refreshKey={refreshKey} isSignedIn={isSignedIn}/></Suspense>:<>
        <div className="page-title"><p className="eyebrow">MATCH DAY</p><h2>{isEditor?(editingMatchId?'Edit Match':'Record a Match'):'Match Record'}</h2><p>{isEditor?'Assign sides, record performances, and let the match tell the story.':'Explore the GG Matchday archive.'}</p></div>
        {isEditor && (
          <MatchRecordForm
            onSubmit={saveMatch}
            bookedFixture={bookedFixture}
            onChooseFixture={fixture => {
              setBookedFixture(fixture);
              if (!fixture) return;
              setDate(fixture.date);
              setMatchName("Clubs · " + fixture.clubA + " vs " + fixture.clubB);
              setTeamALabel(fixture.clubA);
              setTeamBLabel(fixture.clubB);
              setTeams({});
              setGoals({});
              setAssists({});
              setOwnGoals({});
              setPerformanceCodes({});
            }}
            fixtureRevision={refreshKey}
            date={date}
            setDate={setDate}
            matchName={matchName}
            setMatchName={setMatchName}
            teamALabel={teamALabel}
            setTeamALabel={setTeamALabel}
            teamBLabel={teamBLabel}
            setTeamBLabel={setTeamBLabel}
            teamAScore={teamAScore}
            teamBScore={teamBScore}
            players={players}
            teams={teams}
            setPlayerTeam={setPlayerTeam}
            goals={goals}
            setGoals={setGoals}
            assists={assists}
            setAssists={setAssists}
            ownGoals={ownGoals}
            setOwnGoals={setOwnGoals}
            performanceCodes={performanceCodes}
            setPerformanceCodes={setPerformanceCodes}
            assignedPlayers={assignedPlayers}
            totalGoals={totalGoals}
            totalAssists={totalAssists}
            savingMatch={savingMatch}
            editingMatchId={editingMatchId}
            resetMatchForm={resetMatchForm}
            changeCount={changeCount}
          />
        )}
        <section className="section-block">
          <div className="section-heading">
            <h2>Recent Matches</h2>
            <span className="muted">{overview?.matches ?? matches.length} recorded</span>
          </div>
          {archiveError && <p className="global-message" role="alert">{archiveError}</p>}
          {matches.length > 0 ? <div className="match-list">
            {matches.map(match => <MatchHistoryCard key={match._id} match={match} canEdit={isEditor}
              onOpen={() => showMatch(match._id)} onEdit={() => startEditingMatch(match)} onDelete={() => deleteMatch(match._id)} />)}
          </div> : loadingMatches ? <div className="loading-panel">Loading matches…</div> :
            !archiveError && <div className="empty-state">No matches recorded yet.</div>}
          {(archiveError || matches.length < (overview?.matches || 0)) && <button type="button" className="secondary-button"
            disabled={loadingMatches} onClick={() => {
              setLoadingMatches(true);
              if (archiveError) setArchiveRetry(attempt => attempt + 1);
              else setArchivePage(page => page + 1);
            }}>
            {loadingMatches ? "Loading matches…" : archiveError ? "Retry loading matches" : "Load more matches"}
          </button>}
        </section>
        </>}
      </section>}

      {/* =====================================================
          LEADERBOARD
      ===================================================== */}

      {pane === TABS.LEADERBOARD && <LeaderboardView onPlayer={showPlayer} onAwards={()=>setModal('awards')} refreshKey={refreshKey}/>}

      {/* =====================================================
          CALENDAR
      ===================================================== */}

      {pane === TABS.CALENDAR && (
        <Calendar
          canEdit={isEditor}
          onOpen={showMatch}
          onEdit={startEditingMatch}
          onDelete={deleteMatch}
          refreshKey={refreshKey}
        />
      )}

      {/* =====================================================
          PLAYERS
      ===================================================== */}

      {pane ===
        TABS.PLAYERS && (
        <section className="tab-content">

          <div hidden={Boolean(selectedPlayer)}>
            <PlayersDirectory
              players={players}
              leaderboard={leaderboard}
              loadingPlayers={loadingPlayers}
              isEditor={isEditor}
              newPlayerName={newPlayerName}
              setNewPlayerName={setNewPlayerName}
              playerActionLoading={playerActionLoading}
              addPlayer={addPlayer}
              onPlayer={showPlayer}
              onOpenPlayer={openPlayerProfile}
            />
          </div>
          {selectedPlayer && (
            <PlayerProfile
              key={selectedPlayer._id}
              player={selectedPlayer}
              isEditor={isEditor}
              editingProfile={editingProfile}
              profileForm={profileForm}
              onProfileFormChange={setProfileForm}
              onOpenEditor={openPlayerEditor}
              onCloseEditor={closePlayerEditor}
              onSaveProfile={savePlayerProfile}
              profileSaving={profileSaving}
              profileSaveError={profileSaveError}
              playerReview={playerReview}
              playerReviewLoading={playerReviewLoading}
              onLoadPlayerReview={loadPlayerReview}
              onDeletePlayer={deletePlayer}
              onMatch={showMatch}
              refreshKey={refreshKey}
              onBack={() => {
                const previous = playerDirectoryReturn.current;
                playerDirectoryReturn.current = null;
                setSelectedPlayer(null);
                if (previous) requestAnimationFrame(() => {
                  window.scrollTo({ top: previous.top, behavior: "instant" });
                  if (previous.focus instanceof HTMLElement) previous.focus.focus({ preventScroll: true });
                });
              }}
              onClearReview={()=>setPlayerReview(null)}
              onRequestEdit={!isEditor && sameId(selectedPlayer._id, linkedPlayerId) ? () => setProfileRequestMode("edit") : null}
              profileFocusRequest={activeTab === TABS.PLAYERS ? profileFocusRequest : null}
              visible={activeTab === TABS.PLAYERS}
            />
          )}
        </section>
      )}

      {/* =====================================================
          ADMIN
      ===================================================== */}

        </>} />}
      {activeTab === TABS.ADMIN && (
        <Suspense fallback={<section className="tab-content"><div className="loading-panel" role="status">Preparing administration…</div></section>}>
        <AdminPage
          isAdmin={isAdmin}
          players={players}
          onUpdatePlayerBackgroundVideo={updatePlayerBackgroundVideo}
          onUpdatePlayerOvrAttributes={updatePlayerOvrAttributes}
          isSignedIn={isSignedIn}
          signIn={signIn}
          editorRequests={editorRequests}
          activeEditors={activeEditors}
          adminLoading={adminLoading}
          editorsLoading={editorsLoading}
          adminActionLoading={adminActionLoading}
          handleEditorRequest={handleEditorRequest}
          revokeEditor={revokeEditor}
          onBackToMatchday={() => { setActiveTab(TABS.HOME); window.scrollTo(0, 0); }}
          onOpenClubsAdmin={() => switchProductMode("clubs", undefined, true)}
          onOpenProfileAdmin={() => setProfileRequestMode("admin")}
        />
        </Suspense>
      )}

      </div>

      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      {activeTab !== TABS.ADMIN && <nav className="bottom-nav" aria-label="Matchday tabs" {...dockDrag}>

        <NavButton
          active={
            activeTab ===
            TABS.HOME
          }
          icon="⌂"
          label="Home"
          onClick={() =>
            navigateMatchdayTab(
              TABS.HOME
            )
          }
        />

        <NavButton active={activeTab===TABS.RECORD} icon="＋" label="Record" onClick={()=>navigateMatchdayTab(TABS.RECORD)}/>

        <NavButton
          active={
            activeTab ===
            TABS.LEADERBOARD
          }
          icon="🏆"
          label="Leaderboard"
          onClick={() =>
            navigateMatchdayTab(
              TABS.LEADERBOARD
            )
          }
        />

        <NavButton
          active={
            activeTab ===
            TABS.CALENDAR
          }
          icon="📅"
          label="Calendar"
          onClick={() =>
            navigateMatchdayTab(
              TABS.CALENDAR
            )
          }
        />

        <NavButton
          active={
            activeTab ===
            TABS.PLAYERS
          }
          icon="👥"
          label="Players"
          onClick={() =>
            navigateMatchdayTab(
              TABS.PLAYERS
            )
          }
        />

      </nav>}

      <Suspense fallback={<div className="loading-panel">Opening…</div>}>
      {modal === "account" && authUser && <AccountProfileSettings
        account={authUser} role={backendUser?.role} linked={Boolean(linkedPlayerId)} theme={theme} onTheme={setTheme}
        key={accountId || authUser.uid} companion={backendUser?.companion}
        onCompanionSave={accountId ? companion => setBackendUser(current =>
          current?.id === accountId ? { ...current, companion } : current) : null}
        opening={openingOwnProfile} error={ownProfileError} canEdit={isEditor} onClose={closeModal}
        onOpenPlayer={() => openOwnProfile()}
        onEditPlayer={() => {
          if (isEditor) void openOwnProfile({ edit: true });
          else { closeModal(); setProfileRequestMode("edit"); }
        }} />}
      {modal==='awards'&&<Awards onClose={closeModal} onPlayer={showPlayer} refreshKey={refreshKey}/>}
      {modal==='hall'&&<HallOfFame onClose={closeModal} onPlayer={showPlayer} refreshKey={refreshKey}/>}
      {modal==='chat'&&isSignedIn&&<Chat onClose={closeModal}/>}
      {modal==='match'&&detailId&&<MatchDetail key={`${detailId}:${isSignedIn}`} matchId={detailId} onClose={closeModal} onPlayer={showPlayer} isSignedIn={isSignedIn} isAdmin={isAdmin} currentPlayerId={backendUser?.playerProfile}/>}
      {((profileRequestMode === "admin" && isAdmin) || (profileRequestMode === "edit" && linkedPlayerId)) &&
        <ProfileRequests key={`${backendUser?.id}:${linkedPlayerId}:${profileRequestMode}`} mode={profileRequestMode}
          playerId={linkedPlayerId} onClose={() => setProfileRequestMode(null)} />}
      </Suspense>
    </main>
  );

  return <>
    {workspaceContent}
    <CompanionWorld enabled={Boolean(accountId)} account={backendUser} onWorld={() => setWorldAccount(accountId)} />
    {accountId && worldAccount === accountId && <Suspense fallback={<p className="gg-world-loading" role="status">Opening Community World…</p>}>
      <CommunityWorld key={accountId} onClose={() => setWorldAccount(null)} />
    </Suspense>}
    {modeTransition && <WorkspaceTransition {...modeTransition} onPhaseDone={advanceWorkspaceTransition} />}
  </>;
}

// =========================================================
// COMPONENTS
// =========================================================

function NavButton({
  active,
  icon,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "active"
          : ""
      }
      onClick={
        onClick
      }
    >

      <span>
        {icon}
      </span>

      <small>
        {label}
      </small>

    </button>
  );
}

export default App;
