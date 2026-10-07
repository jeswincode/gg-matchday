import {lazy, Suspense, useCallback, useRef} from 'react';
import LeaderboardView from './components/Leaderboard';
import Clasico from './components/Clasico';
import {api, invalidate} from './lib/api';
import MatchHistoryCard from './components/ui/MatchHistoryCard';
import PlayersDirectory from './features/players/PlayersDirectory';
import PlayerProfile from './features/players/PlayerProfile';
import HomePage from './features/home/HomePage';
import Calendar from './features/calendar/Calendar';
import AdminPage from './features/admin/AdminPage';
import MatchRecordForm from './features/matches/MatchRecordForm';
import ClubsMode from './features/clubs/ClubsMode';
import {StartupScreen, LoginDashboard, WelcomeScreen} from './components/StartupExperience';
const Awards = lazy(()=>import('./components/Awards'));
const MatchDetail = lazy(()=>import('./components/MatchDetail'));
const HallOfFame = lazy(()=>import('./components/HallOfFame'));
const Chat = lazy(()=>import('./components/Chat'));
import {
  useEffect,
  useMemo,
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
  const [productMode,setProductMode]=useState(()=>{
    try {
      const saved=localStorage.getItem("gg-product-mode");
      if(saved === "clubs" || saved === "matchday") return saved;

      const legacyMode=new URLSearchParams(window.location.search).get("mode");
      if(legacyMode === "clubs") {
        localStorage.setItem("gg-product-mode","clubs");
        return "clubs";
      }
    } catch {
      // Storage can be unavailable in private/restricted browser contexts.
    }
    return "matchday";
  });
  const [recordSection,setRecordSection]=useState('record');
  const [modal,setModal]=useState(null);
  const [detailId,setDetailId]=useState(null);
  const [refreshKey,setRefreshKey]=useState(0);
  const [overview,setOverview]=useState(null);
  const [archivePage,setArchivePage]=useState(1);
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('gg-theme')==='golden'?'golden':'dark';}catch{return 'dark';}});
  const touchStartRef=useRef(null);
  const [swipeOffset,setSwipeOffset]=useState(0);
  const [swipeAnimating,setSwipeAnimating]=useState(false);
  const [modeTransition,setModeTransition]=useState(null);
  const closeModal=useCallback(()=>{setModal(null);setDetailId(null);},[]);

  const switchProductMode=useCallback((nextMode)=>{
    if(nextMode===productMode || modeTransition) return;
    const transition = nextMode === "clubs"
      ? `to-clubs-${theme}`
      : `to-matchday-${theme}`;
    setModeTransition(transition);
    setProductMode(nextMode);
    try{
      localStorage.setItem("gg-product-mode",nextMode);

      // Product mode is an application state, not a route. Keep the canonical
      // public URL clean and compatible with old ?mode=clubs links.
      const url=new URL(window.location.href);
      url.searchParams.delete("mode");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
    }catch{
      // URL history/storage are optional in restricted browser environments.
    }
    window.setTimeout(()=>setModeTransition(null),720);
  },[modeTransition,productMode,theme]);

  function isTouchInteractionExcluded(target) {
    if (!(target instanceof Element)) return false;

    if (target.closest('[role="dialog"]')) return true;

    let current=target;
    while (current && current !== document.body) {
      if (current instanceof HTMLElement) {
        const styles=window.getComputedStyle(current);
        const canScrollHorizontally=current.scrollWidth>current.clientWidth+1 &&
          (styles.overflowX==='auto'||styles.overflowX==='scroll');
        if (canScrollHorizontally) return true;
      }
      current=current.parentElement;
    }

    return false;
  }

  function handleAppTouchStart(event) {
    if (event.touches.length !== 1 || swipeAnimating) {
      touchStartRef.current=null;
      return;
    }

    touchStartRef.current={
      x:event.touches[0].clientX,
      y:event.touches[0].clientY,
      excluded:isTouchInteractionExcluded(event.target),
    };
  }

  function handleAppTouchMove(event) {
    const start=touchStartRef.current;
    if (!start || start.excluded || event.touches.length !== 1 || swipeAnimating) return;

    const touch=event.touches[0];
    const deltaX=touch.clientX-start.x;
    const deltaY=touch.clientY-start.y;

    if (Math.abs(deltaX)<8 || Math.abs(deltaX)<=Math.abs(deltaY)*1.15) return;

    const currentIndex=TAB_ORDER.indexOf(activeTab);
    if (currentIndex<0) return;

    const nextIndex=deltaX<0 ? currentIndex+1 : currentIndex-1;
    if (nextIndex<0 || nextIndex>=TAB_ORDER.length) {
      setSwipeOffset(deltaX*0.2);
      return;
    }

    event.preventDefault();
    setSwipeOffset(deltaX);
  }

  function handleAppTouchEnd(event) {
    const start=touchStartRef.current;
    touchStartRef.current=null;

    if (!start || start.excluded || event.changedTouches.length !== 1 || swipeAnimating) return;

    const touch=event.changedTouches[0];
    const deltaX=touch.clientX-start.x;
    const deltaY=touch.clientY-start.y;
    const threshold=Math.min(92, Math.max(56, window.innerWidth*0.16));

    if (Math.abs(deltaX)<threshold || Math.abs(deltaX)<=Math.abs(deltaY)*1.2) {
      setSwipeOffset(0);
      return;
    }

    const currentIndex=TAB_ORDER.indexOf(activeTab);
    if (currentIndex<0) {
      setSwipeOffset(0);
      return;
    }

    const nextIndex=deltaX<0 ? currentIndex+1 : currentIndex-1;
    if (nextIndex<0 || nextIndex>=TAB_ORDER.length) {
      setSwipeOffset(0);
      return;
    }

    setSwipeAnimating(true);
    setSwipeOffset(deltaX<0 ? -window.innerWidth : window.innerWidth);

    window.setTimeout(()=>{
      setActiveTab(TAB_ORDER[nextIndex]);
      setSwipeOffset(0);
      setSwipeAnimating(false);
    },240);
  }
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
  useEffect(()=>{const changed=()=>setRefreshKey(n=>n+1);window.addEventListener('gg-data-changed',changed);return()=>window.removeEventListener('gg-data-changed',changed);},[]);
  useEffect(()=>{api('/stats/overview').then(setOverview).catch(()=>{});},[refreshKey]);
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
  ] = useState(Boolean(auth));

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

  const [
    ,
    setLeaderboardLoading,
  ] = useState(false);


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
  // LEADERBOARD
  // =========================================================

  const [
    leaderboardPeriod,
    ,
  ] = useState("all");

  // =========================================================
  // AWARDS
  // =========================================================

  const [
    ,
    setPlayerOfYear,
  ] = useState(null);

  const [
    ,
    setPlayerOfMonth,
  ] = useState(null);

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

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadPlayers();
    loadMatches();
    loadNews();
    loadLeaderboard("all");
    loadAwards();
  }, []);

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

  async function loadMatches(page = 1) {
    try {
      setLoadingMatches(true);

      const response =
        await fetch(
          `${API_URL}/matches?page=${page}&limit=50`
        );

      if (!response.ok) {
        throw new Error(
          "Failed to load matches."
        );
      }

      const data =
        await response.json();

      const ordered =
        Array.isArray(data)
          ? [...data].sort(
              (a, b) =>
                new Date(b.date) -
                new Date(a.date)
            )
          : [];

      setMatches(current => page===1?ordered:[...current,...ordered]);
      setArchivePage(page);
    } catch (error) {
      console.error(error);
      setMessage(
        "Could not load matches."
      );
    } finally {
      setLoadingMatches(false);
    }
  }

  async function loadNews() {
    try {
      setNewsLoading(true);

      const response =
        await fetch(
          `${API_URL}/news?limit=12`
        );

      if (!response.ok) {
        throw new Error(
          "Failed to load news."
        );
      }

      const data =
        await response.json();

      setNews(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(error);
      setNews([]);
    } finally {
      setNewsLoading(false);
    }
  }

  async function loadLeaderboard(
    period = "all"
  ) {
    try {
      setLeaderboardLoading(true);

      let url =
        `${API_URL}/stats/leaderboard`;

      const now =
        new Date();

      if (
        period ===
        "year"
      ) {
        url +=
          `?year=${now.getFullYear()}`;
      }

      if (
        period ===
        "month"
      ) {
        url +=
          `?year=${now.getFullYear()}` +
          `&month=${now.getMonth() + 1}`;
      }

      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          "Failed to load leaderboard."
        );
      }

      const data =
        await response.json();

      setLeaderboard(
        Array.isArray(
          data.leaderboard
        )
          ? data.leaderboard
          : []
      );
    } catch (error) {
      console.error(error);
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }

  async function loadAwards() {
    try {
      const now =
        new Date();

      const year =
        now.getFullYear();

      const month =
        now.getMonth() + 1;

      const [
        yearResponse,
        monthResponse,
      ] = await Promise.all([
        fetch(
          `${API_URL}/stats/awards?year=${year}`
        ),
        fetch(
          `${API_URL}/stats/awards?year=${year}&month=${month}`
        ),
      ]);

      if (
        !yearResponse.ok ||
        !monthResponse.ok
      ) {
        return;
      }

      const [
        yearData,
        monthData,
      ] = await Promise.all([
        yearResponse.json(),
        monthResponse.json(),
      ]);

      setPlayerOfYear(
        yearData.winner ||
          null
      );

      setPlayerOfMonth(
        monthData.winner ||
          null
      );
    } catch (error) {
      console.error(
        "Awards error:",
        error
      );

      setPlayerOfYear(null);
      setPlayerOfMonth(null);
    }
  }

  // =========================================================
  // AUTHENTICATED REQUEST
  // =========================================================

  async function authenticatedFetch(
    url,
    options = {}
  ) {
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

  function openPlayerProfile(
    player
  ) {
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

  const teamAPlayers =
    useMemo(
      () =>
        players.filter(
          (player) =>
            teams[
              String(
                player._id
              )
            ] ===
            "A"
        ),
      [players, teams]
    );

  const teamBPlayers =
    useMemo(
      () =>
        players.filter(
          (player) =>
            teams[
              String(
                player._id
              )
            ] ===
            "B"
        ),
      [players, teams]
    );

  const assignedPlayers =
    useMemo(
      () =>
        players.filter(
          (player) =>
            teams[
              String(
                player._id
              )
            ] ===
              "A" ||
            teams[
              String(
                player._id
              )
            ] ===
              "B"
        ),
      [players, teams]
    );

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

      invalidate();
      resetMatchForm();
      await Promise.all([
        loadMatches(),
        loadLeaderboard(
          leaderboardPeriod
        ),
        loadAwards(),
        loadNews(),
      ]);

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

      invalidate();
      await Promise.all([
        loadMatches(),
        loadLeaderboard(
          leaderboardPeriod
        ),
        loadAwards(),
        loadNews(),
      ]);

      // Calendar refreshes from the shared data-change event.
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
        <ClubsMode onReturnToMatchday={() => switchProductMode("matchday")} authUser={backendUser} isAdmin={isAdmin} />
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
    return <WelcomeScreen user={authUser} onEnter={() => setExperience("app")} />;
  }

  return (
    <main className="app" onTouchStart={handleAppTouchStart} onTouchMove={handleAppTouchMove} onTouchEnd={handleAppTouchEnd}>

      <div
        className="mobile-tab-stage"
        style={{
          transform:`translate3d(${swipeOffset}px,0,0)`,
          transition:swipeAnimating
            ? "transform 240ms cubic-bezier(.22,.8,.2,1)"
            : "none",
          willChange:swipeOffset!==0||swipeAnimating ? "transform" : "auto",
        }}
      >
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
        <div className="gg-header-actions"><button className="secondary-button" type="button" onClick={()=>switchProductMode("clubs")}>Clubs</button><div className="gg-theme" aria-label="Theme">{[['dark','Dark'],['golden','Gold']].map(([value,label])=><button key={value} aria-pressed={theme===value} onClick={()=>setTheme(value)}>{label}</button>)}</div>{isSignedIn&&<button className="secondary-button" onClick={()=>setModal('chat')}>Chat</button>}</div>
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
                  onClick={() =>
                    setActiveTab(
                      TABS.ADMIN
                    )
                  }
                >
                  ⚙ Admin
                </button>
              )}

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

      {activeTab === TABS.HOME && (
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

      {activeTab === TABS.RECORD && <section className="tab-content">
        <div className="gg-secondary-tabs" role="tablist" aria-label="Record sections"><button role="tab" aria-selected={recordSection==='record'} onClick={()=>setRecordSection('record')}>Match Record</button><button role="tab" aria-selected={recordSection==='clasico'} onClick={()=>setRecordSection('clasico')}>El Clásico</button></div>
        {recordSection==='clasico'?<Clasico onPlayer={showPlayer} onMatch={showMatch} refreshKey={refreshKey} isSignedIn={isSignedIn}/>:<>
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
        <section className="section-block"><div className="section-heading"><h2>Recent Matches</h2><span className="muted">{overview?.matches??matches.length} recorded</span></div>{loadingMatches?<div className="loading-panel">Loading matches…</div>:!matches.length?<div className="empty-state">No matches recorded yet.</div>:<div className="match-list">{matches.map(match=><MatchHistoryCard key={match._id} match={match} canEdit={isEditor} onOpen={()=>showMatch(match._id)} onEdit={()=>startEditingMatch(match)} onDelete={()=>deleteMatch(match._id)}/>)}</div>}{matches.length<(overview?.matches||0)&&<button className="secondary-button" onClick={()=>loadMatches(archivePage+1)}>Load more matches</button>}</section>
        </>}
      </section>}

      {/* =====================================================
          LEADERBOARD
      ===================================================== */}

      {activeTab === TABS.LEADERBOARD && <LeaderboardView onPlayer={showPlayer} onAwards={()=>setModal('awards')} refreshKey={refreshKey}/>}

      {/* =====================================================
          CALENDAR
      ===================================================== */}

      {activeTab === TABS.CALENDAR && (
        <Calendar
          apiUrl={API_URL}
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

      {activeTab ===
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
            />
          )}
        </section>
      )}

      {/* =====================================================
          ADMIN
      ===================================================== */}

      {activeTab === TABS.ADMIN && (
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
        />
      )}

      </div>

      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <nav className="bottom-nav">

        <NavButton
          active={
            activeTab ===
            TABS.HOME
          }
          icon="⌂"
          label="Home"
          onClick={() =>
            setActiveTab(
              TABS.HOME
            )
          }
        />

        <NavButton active={activeTab===TABS.RECORD} icon="＋" label="Record" onClick={()=>setActiveTab(TABS.RECORD)}/>

        <NavButton
          active={
            activeTab ===
            TABS.LEADERBOARD
          }
          icon="🏆"
          label="Leaderboard"
          onClick={() =>
            setActiveTab(
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
            setActiveTab(
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
            setActiveTab(
              TABS.PLAYERS
            )
          }
        />

      </nav>

      <Suspense fallback={<div className="loading-panel">Opening…</div>}>
      {modal==='awards'&&<Awards onClose={closeModal} onPlayer={showPlayer}/>}
      {modal==='hall'&&<HallOfFame onClose={closeModal} onPlayer={showPlayer}/>}
      {modal==='chat'&&isSignedIn&&<Chat onClose={closeModal}/>}
      {modal==='match'&&detailId&&<MatchDetail matchId={detailId} onClose={closeModal} onPlayer={showPlayer} isSignedIn={isSignedIn} isAdmin={isAdmin}/>}
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
