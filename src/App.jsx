import {lazy, Suspense, useCallback, useRef} from 'react';
import {api, invalidate} from './lib/api';
import { subscribeToProfileUpdates } from './lib/profileLive';
import { refreshLiveTopics, subscribeToAccountUpdates, useLiveRevision } from './lib/liveData';
import SwipePager from "./components/SwipePager";
import { scrollToPagerStart } from "./lib/pagerScroll";
import NotificationIndicator from './components/NotificationIndicator';
import {StartupScreen, LoginDashboard, WelcomeScreen} from './components/StartupExperience';
// Keep the five primary navigation destinations in the initial JS graph.
// Otherwise the top-level Suspense boundary replaces the entire app shell
// with “Opening Matchday…” the first time a user opens each tab.
import LeaderboardView from './components/Leaderboard';
import MatchHistoryCard from './components/ui/MatchHistoryCard';
import PlayersDirectory from './features/players/PlayersDirectory';
import PlayerProfile from './features/players/PlayerProfile';
import HomePage from './features/home/HomePage';
import Calendar from './features/calendar/Calendar';
import MatchRecordForm from './features/matches/MatchRecordForm';
// Heavier destinations stay split, but suspend only inside their own view.
const Clasico = lazy(() => import('./components/Clasico'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));
const ProfileRequests = lazy(() => import('./ProfileRequests'));
// Clubs is a primary product surface, so its code must be ready before
// navigation; background prefetch can race the user's first click.
import ClubsMode from './features/clubs/ClubsMode';
const Awards = lazy(()=>import('./components/Awards'));
const MatchDetail = lazy(()=>import('./components/MatchDetail'));
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

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

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
  const [experience,setExperience]=useState('startup');
  // Product mode is intentionally session-only. A full reload always starts
  // in the main Matchday Home experience, including when the previous mode was Clubs.
  const [productMode,setProductMode]=useState("matchday");
  const [clubsAdminEntry, setClubsAdminEntry] = useState(false);
  const [profileRequestMode, setProfileRequestMode] = useState(null);
  const [openingOwnProfile, setOpeningOwnProfile] = useState(false);
  const [ownProfileError, setOwnProfileError] = useState("");
  const [profileFocusRequest, setProfileFocusRequest] = useState(null);
  const ownProfileRequest = useRef(null);
  const [recordSection,setRecordSection]=useState('record');
  const [modal,setModal]=useState(null);
  const [detailId,setDetailId]=useState(null);
  const refreshKey = useLiveRevision("matchday");
  const newsRevision = useLiveRevision("news");
  const [overview,setOverview]=useState(null);
  const [archivePage,setArchivePage]=useState(1);
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('gg-theme')==='golden'?'golden':'dark';}catch{return 'dark';}});
  const [modeTransition,setModeTransition]=useState(null);
  const modeTransitionTimer = useRef(null);
  const closeModal=useCallback(()=>{setModal(null);setDetailId(null);},[]);

  const switchProductMode=useCallback((nextMode)=>{
    if(nextMode===productMode) return;
    window.clearTimeout(modeTransitionTimer.current);
    const transition = nextMode === "clubs"
      ? `to-clubs-${theme}`
      : `to-matchday-${theme}`;
    setModeTransition(transition);
    setProductMode(nextMode);
    try {
      // Product mode is application state, not a route. Keep the public URL
      // canonical so refreshing always returns to Matchday Home.
      const url = new URL(window.location.href);
      url.searchParams.delete("mode");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
    } catch {
      // URL history can be unavailable in restricted browser environments.
    }
    modeTransitionTimer.current = window.setTimeout(()=>setModeTransition(null),225);
  },[productMode,theme]);
  useEffect(() => () => window.clearTimeout(modeTransitionTimer.current), []);

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

  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('gg-theme',theme);}catch{/* Private browsing can disable storage. */}},[theme]);
  useEffect(()=>{document.documentElement.dataset.productMode=productMode;},[productMode]);
  function navigateMatchdayTab(tab) {
    if (tab !== activeTab) scrollToPagerStart(document.getElementById("matchday-pager"));
    setActiveTab(tab);
  }

  function showPlayer(playerId){const player=players.find(p=>String(p._id)===String(playerId));if(player){closeModal();openPlayerProfile(player);setActiveTab(TABS.PLAYERS);}}
  function showMatch(matchId){setActiveTab(TABS.CALENDAR);setDetailId(matchId);setModal('match');}

  // =========================================================
  // NAVIGATION
  // =========================================================

  const [
    activeTab,
    setActiveTab,
  ] = useState(TABS.HOME);

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

  const isAdmin =
    backendUser?.role ===
    "admin";

  const linkedPlayerId = isSignedIn ? backendUser?.playerProfile : null;
  useEffect(() => () => { ownProfileRequest.current = null; }, [backendUser?.id, linkedPlayerId]);

  const isEditor =
    backendUser?.role ===
      "editor" ||
    isAdmin;

  const hasPendingRequest =
    backendUser?.accessRequest ===
    "pending";

  // =========================================================
  // AUTH STATE
  // =========================================================

  useEffect(() => {
    if (import.meta.env.VITE_E2E_TEST_AUTH_SECRET) {
      let active = true;
      const params = new URLSearchParams(window.location.search);
      const role = params.get("e2eRole") || import.meta.env.VITE_E2E_TEST_ROLE || "viewer";
      const playerId = params.get("e2ePlayerId") || import.meta.env.VITE_E2E_TEST_PLAYER_ID || "";
      if (role === "guest") {
        // Initial state is already signed out and not loading for explicit E2E
        // guest mode, so avoid redundant state updates during effect setup.
        return () => { active = false; };
      }
      const headers = {
        "X-E2E-Test-Token": import.meta.env.VITE_E2E_TEST_AUTH_SECRET,
        "X-E2E-Test-Role": role,
        ...(playerId ? { "X-E2E-Test-Player-Id": playerId } : {}),
      };
      fetch(`${API_URL}/auth/me`, { headers })
        .then(async response => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.message || "Test authentication failed.");
          if (!active) return;
          setAuthUser({
            uid: `e2e-test:${role}:${playerId || "unlinked"}`,
            displayName: data.user?.name || `Playwright ${role}`,
            email: data.user?.email || "playwright@test.invalid",
            photoURL: "",
            getIdToken: async () => "",
          });
          setBackendUser(data.user || null);
          setMessage("");
        })
        .catch(error => {
          if (!active) return;
          setBackendUser(null);
          setMessage(`Test authentication failed: ${error.message}`);
        })
        .finally(() => {
          if (active) setAuthLoading(false);
        });
      return () => { active = false; };
    }

    if (!auth) return;

    let active = true;

    async function syncBackendUser(firebaseUser) {
      if (!active) return;

      setAuthUser(firebaseUser);

      if (!firebaseUser) {
        setBackendUser(null);
        setAuthLoading(false);
        return;
      }

      try {
        const token = await firebaseUser.getIdToken();
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message ||
              `Authentication sync failed (${response.status})`,
          );
        }

        if (!active) return;
        setBackendUser(data.user || null);
        setMessage("");
      } catch (error) {
        console.error("Auth sync error:", error);

        if (!active) return;
        setBackendUser(null);
        setMessage(`Could not sync your account: ${error.message}`);
      } finally {
        if (active) setAuthLoading(false);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, syncBackendUser);

    // Consume a pending redirect result on startup as an explicit
    // fallback for browsers where the auth observer is delayed.
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) return syncBackendUser(result.user);
        return undefined;
      })
      .catch((error) => {
        console.error("Redirect auth result error:", error);

        if (active) {
          setAuthLoading(false);
          setMessage(
            error?.code === "auth/web-storage-unsupported"
              ? "Google sign-in needs browser storage enabled."
              : `${error?.code || "auth-error"}: ${error?.message || "Google sign-in could not be completed."}`,
          );
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const finishStartup = useCallback(() => {
    setExperience(authUser ? "welcome" : "entry");
  }, [authUser]);

  function enterGuestMode() {
    setExperience("app");
  }

  const liveActive = experience === "app" || productMode === "clubs";
  const accountId = isSignedIn ? backendUser?.id : null;
  const matchdayActive = liveActive && productMode === "matchday";
  const showArchive = matchdayActive && (activeTab === TABS.HOME || activeTab === TABS.RECORD);
  const showHome = matchdayActive && activeTab === TABS.HOME;
  const showPlayerRanks = showHome || (matchdayActive && activeTab === TABS.PLAYERS);
  const matchPages = activeTab === TABS.RECORD ? archivePage : 1;

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
    api("/players").then(latest => {
      if (!active || !Array.isArray(latest)) return;
      setPlayers(latest);
      setSelectedPlayer(current => current
        ? latest.find(player => sameId(player._id, current._id)) || null
        : null);
    }).catch(error => { if (active) console.error(error); })
      .finally(() => { if (active) setLoadingPlayers(false); });
    return () => { active = false; };
  }, [matchdayActive, refreshKey]);

  useEffect(() => {
    if (!showArchive) return undefined;
    let active = true;
    const pages = Array.from({ length: matchPages }, (_, index) =>
      api(`/matches?page=${index + 1}&limit=50`),
    );
    Promise.all(pages).then(results => {
      if (active) setMatches([...new Map(results.flat().map(match => [match._id, match])).values()]);
    }).catch(error => {
      if (active) setMessage(error.message || "Could not load matches.");
    }).finally(() => {
      if (active) setLoadingMatches(false);
    });
    api("/stats/overview").then(data => { if (active) setOverview(data); }).catch(() => {});
    return () => { active = false; };
  }, [showArchive, matchPages, refreshKey]);

  useEffect(() => {
    if (!showHome) return undefined;
    let active = true;
    api("/news?limit=12").then(data => {
      if (active) setNews(Array.isArray(data) ? data : []);
    }).catch(error => { if (active) console.error(error); })
      .finally(() => { if (active) setNewsLoading(false); });
    return () => { active = false; };
  }, [showHome, newsRevision]);

  useEffect(() => {
    if (!showPlayerRanks) return undefined;
    let active = true;
    api("/stats/leaderboard").then(data => {
      if (active) setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : []);
    }).catch(error => { if (active) console.error(error); });
    return () => { active = false; };
  }, [showPlayerRanks, refreshKey]);

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
  // LOADERS
  // =========================================================

  async function loadPlayers() {
    try {
      setLoadingPlayers(true);

      const response =
        await fetch(
          `${API_URL}/players`
        );

      if (!response.ok) {
        throw new Error(
          "Failed to load players."
        );
      }

      const data =
        await response.json();

      setPlayers(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(error);
      setMessage(
        "Could not load players."
      );
    } finally {
      setLoadingPlayers(false);
    }
  }

  // =========================================================
  // AUTHENTICATED REQUEST
  // =========================================================

  async function authenticatedFetch(
    url,
    options = {}
  ) {
    if (import.meta.env.VITE_E2E_TEST_AUTH_SECRET) {
      const params = new URLSearchParams(window.location.search);
      const role = params.get("e2eRole") || import.meta.env.VITE_E2E_TEST_ROLE || "viewer";
      const playerId = params.get("e2ePlayerId") || import.meta.env.VITE_E2E_TEST_PLAYER_ID || "";
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          "X-E2E-Test-Token": import.meta.env.VITE_E2E_TEST_AUTH_SECRET,
          "X-E2E-Test-Role": role,
          ...(playerId ? { "X-E2E-Test-Player-Id": playerId } : {}),
        },
      });
    }

    if (
      !auth?.currentUser
    ) {
      throw new Error(
        "Authentication required."
      );
    }

    const token =
      await auth?.currentUser.getIdToken();

    return fetch(
      url,
      {
        ...options,

        headers: {
          ...(options.headers ||
            {}),

          Authorization:
            `Bearer ${token}`,
        },
      }
    );
  }

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
    }
  }

  async function logout() {
    try {
      await signOut(auth);

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

      setBackendUser(
        data.user ||
          backendUser
      );

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

      const response =
        await authenticatedFetch(
          `${API_URL}/players`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                name,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not add player."
        );
      }

      setNewPlayerName("");

      await loadPlayers();

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
      const response =
        await authenticatedFetch(
          `${API_URL}/players/${playerId}`,
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
            "Could not delete player."
        );
      }

      await loadPlayers();

      setSelectedPlayer(
        null
      );



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

  async function openOwnProfile() {
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
      openPlayerProfile(player, true);
      setActiveTab(TABS.PLAYERS);
      switchProductMode("matchday");
    } catch (error) {
      if (ownProfileRequest.current === request) {
        setOwnProfileError(error.status === 404 ? "Your linked player profile could not be found." : "Couldn’t open your profile. Try again.");
      }
    } finally {
      if (ownProfileRequest.current === request || !ownProfileRequest.current) setOpeningOwnProfile(false);
      if (ownProfileRequest.current === request) ownProfileRequest.current = null;
    }
  }

  function openPlayerProfile(
    player, focusProfile = false
  ) {
    setProfileFocusRequest(focusProfile ? {} : null);
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

    if (
      !isEditor ||
      !selectedPlayer
    ) {
      setMessage(
        "Editor access required."
      );
      return;
    }

    try {
      setProfileSaving(true);

      const response =
        await authenticatedFetch(
          `${API_URL}/players/${selectedPlayer._id}`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                profileForm
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not update profile."
        );
      }

      await loadPlayers();

      setSelectedPlayer(
        data
      );

      setEditingProfile(
        false
      );

      invalidate();

      setMessage(
        "Player profile updated."
      );
    } catch (error) {
      console.error(error);

      setMessage(
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

    setActiveTab(
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

      refreshLiveTopics(["matchday", "news"]);
      resetMatchForm();

      setMessage(
        editingMatchId
          ? "Match updated."
          : "Match recorded."
      );
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

  const activeExperience =
    experience === "entry" && authUser && !authLoading
      ? "welcome"
      : experience;

  const modeTransitionLayer = modeTransition ? (
    <div className={`product-mode-transition product-mode-transition--${modeTransition}`} aria-hidden="true">
      <span className="product-mode-wave product-mode-wave--one" />
      <span className="product-mode-wave product-mode-wave--two" />
      <span className="product-mode-wave product-mode-wave--three" />
    </div>
  ) : null;

  if (productMode === "clubs") {
    if (authLoading) {
      return <StartupScreen authLoading={true} onComplete={finishStartup} />;
    }

    return (
      <>
        <ClubsMode onReturnToMatchday={() => switchProductMode("matchday")} authUser={backendUser} isAdmin={isAdmin}
          adminEntry={clubsAdminEntry} onOpenOwnProfile={linkedPlayerId ? openOwnProfile : null}
          openingOwnProfile={openingOwnProfile} ownProfileError={linkedPlayerId ? ownProfileError : ""} />
        {modeTransitionLayer}
      </>
    );
  }

  if (activeExperience === "startup") {
    return <StartupScreen authLoading={authLoading} onComplete={finishStartup} />;
  }

  if (activeExperience === "entry") {
    return <LoginDashboard onSignIn={signIn} onGuest={enterGuestMode} busy={authLoading} message={message} />;
  }

  if (activeExperience === "welcome") {
    return <WelcomeScreen onEnter={() => setExperience("app")} />;
  }

  return (
    <main className={"app" + (activeTab === TABS.ADMIN ? " app--admin" : "")}
      data-page-swipes={activeTab === TABS.ADMIN ? undefined : ""}>
      <NotificationIndicator accountId={accountId} />

      <div className="mobile-tab-stage">
      <header className="topbar">
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
        <div className="gg-header-actions"><button className="secondary-button" type="button" onClick={() => { setClubsAdminEntry(false); switchProductMode("clubs"); }}>Clubs</button><div className="gg-theme" aria-label="Theme">{[['dark','Dark'],['golden','Gold']].map(([value,label])=><button key={value} aria-pressed={theme===value} onClick={()=>setTheme(value)}>{label}</button>)}</div>{isSignedIn&&<button className="secondary-button" onClick={()=>setModal('chat')}>Chat</button>}</div>
      </header>

      {/* ACCOUNT */}

      <section className="account-bar">

        {authLoading ? (
          <span className="account-status">
            Checking account...
          </span>
        ) : authUser ? (
          <>
            <div className="account-user">

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
                    authUser.displayName ||
                    authUser.email ||
                    "U"
                  )
                    .charAt(
                      0
                    )
                    .toUpperCase()}
                </span>
              )}

              <div>
                <strong>
                  {
                    authUser.displayName ||
                    "GG Matchday User"
                  }
                </strong>

                <small>
                  {
                    backendUser?.role ||
                    "viewer"
                  }
                </small>
              </div>

            </div>

            <div className="account-actions">

              {!isEditor &&
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

              {linkedPlayerId && <button type="button" className="secondary-button" onClick={openOwnProfile} disabled={openingOwnProfile}>
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

      {activeTab !== TABS.ADMIN && <SwipePager id="matchday-pager" tabs={TAB_ORDER} active={activeTab} onNavigate={setActiveTab}
        renderPane={pane => <>
      {pane === TABS.HOME && (
        <HomePage
          latestMatch={latestMatch}
          latestTopScorer={latestTopScorer}
          players={players}
          matches={matches}
          overview={overview}
          totalAllTimeGoals={totalAllTimeGoals}
          news={news}
          newsLoading={newsLoading}
          leaderboard={leaderboard}
          onHallOfFame={() => setModal('hall')}
          onPlayer={showPlayer}
          onLeaderboard={() => setActiveTab(TABS.LEADERBOARD)}
          onOpenPlayer={(player) => {
            openPlayerProfile(player);
            setActiveTab(TABS.PLAYERS);
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
        <section className="section-block"><div className="section-heading"><h2>Recent Matches</h2><span className="muted">{overview?.matches??matches.length} recorded</span></div>{loadingMatches&&!matches.length?<div className="loading-panel">Loading matches…</div>:!matches.length?<div className="empty-state">No matches recorded yet.</div>:<div className="match-list">{matches.map(match=><MatchHistoryCard key={match._id} match={match} canEdit={isEditor} onOpen={()=>showMatch(match._id)} onEdit={()=>startEditingMatch(match)} onDelete={()=>deleteMatch(match._id)}/>)}</div>}{matches.length<(overview?.matches||0)&&<button className="secondary-button" disabled={loadingMatches} onClick={()=>{setLoadingMatches(true);setArchivePage(page=>page+1);}}>{loadingMatches?"Loading matches…":"Load more matches"}</button>}</section>
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

          {!selectedPlayer ? (
            <>
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
            </>
          ) : (
            <PlayerProfile
              player={selectedPlayer}
              isEditor={isEditor}
              editingProfile={editingProfile}
              profileForm={profileForm}
              onProfileFormChange={setProfileForm}
              onToggleEditing={()=>setEditingProfile(value=>!value)}
              onSaveProfile={savePlayerProfile}
              profileSaving={profileSaving}
              playerReview={playerReview}
              playerReviewLoading={playerReviewLoading}
              onLoadPlayerReview={loadPlayerReview}
              onDeletePlayer={deletePlayer}
              onMatch={showMatch}
              refreshKey={refreshKey}
              onBack={()=>setSelectedPlayer(null)}
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
          onOpenClubsAdmin={() => { setClubsAdminEntry(true); switchProductMode("clubs"); }}
          onOpenProfileAdmin={() => setProfileRequestMode("admin")}
        />
        </Suspense>
      )}

      </div>

      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      {activeTab !== TABS.ADMIN && <nav className="bottom-nav">

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
      {modal==='awards'&&<Awards onClose={closeModal} onPlayer={showPlayer} refreshKey={refreshKey}/>}
      {modal==='hall'&&<HallOfFame onClose={closeModal} onPlayer={showPlayer} refreshKey={refreshKey}/>}
      {modal==='chat'&&isSignedIn&&<Chat onClose={closeModal}/>}
      {modal==='match'&&detailId&&<MatchDetail key={`${detailId}:${isSignedIn}`} matchId={detailId} onClose={closeModal} onPlayer={showPlayer} isSignedIn={isSignedIn} isAdmin={isAdmin} currentPlayerId={backendUser?.playerProfile}/>}
      {((profileRequestMode === "admin" && isAdmin) || (profileRequestMode === "edit" && linkedPlayerId)) &&
        <ProfileRequests key={`${backendUser?.id}:${linkedPlayerId}:${profileRequestMode}`} mode={profileRequestMode}
          playerId={linkedPlayerId} onClose={() => setProfileRequestMode(null)} />}
      </Suspense>
      {modeTransitionLayer}
    </main>
  );
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
