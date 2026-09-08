import {lazy, Suspense, useCallback} from 'react';
import Squad from './components/Squad';
import LeaderboardView from './components/Leaderboard';
import ProfileInsights from './components/ProfileInsights';
import Clasico from './components/Clasico';
import LikeButton from './components/LikeButton';
import {api, invalidate} from './lib/api';
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
  GALLERY: "gallery",
  ADMIN: "admin",
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sameId(a, b) {
  return String(a) === String(b);
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(
    value
  ).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
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
  const [recordSection,setRecordSection]=useState('record');
  const [ratings,setRatings]=useState({});
  const [legacyUnrated,setLegacyUnrated]=useState([]);
  const [modal,setModal]=useState(null);
  const [detailId,setDetailId]=useState(null);
  const [refreshKey,setRefreshKey]=useState(0);
  const [galleryNext,setGalleryNext]=useState(null);
  const [galleryMatch,setGalleryMatch]=useState('');
  const [galleryPlayers,setGalleryPlayers]=useState([]);
  const [overview,setOverview]=useState(null);
  const [archivePage,setArchivePage]=useState(1);
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('gg-theme')==='golden'?'golden':'dark';}catch{return 'dark';}});
  const closeModal=useCallback(()=>{setModal(null);setDetailId(null);},[]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('gg-theme',theme);}catch{/* Private browsing can disable storage. */}},[theme]);
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
    gallery,
    setGallery,
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

  const [
    galleryLoading,
    setGalleryLoading,
  ] = useState(true);

  // =========================================================
  // GALLERY
  // =========================================================

  const [
    galleryFile,
    setGalleryFile,
  ] = useState(null);

  const [
    galleryCaption,
    setGalleryCaption,
  ] = useState("");

  const [
    galleryUploading,
    setGalleryUploading,
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
  // CALENDAR
  // =========================================================

  const today =
    new Date();

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    today.getMonth() + 1
  );

  const [
    calendarYear,
    setCalendarYear,
  ] = useState(
    today.getFullYear()
  );

  const [
    calendarMatches,
    setCalendarMatches,
  ] = useState([]);

  const [
    calendarLoading,
    setCalendarLoading,
  ] = useState(false);

  const [
    hoveredDay,
    setHoveredDay,
  ] = useState(null);

  const [
    selectedDay,
    setSelectedDay,
  ] = useState(
    today.getDate()
  );

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
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          setAuthUser(
            firebaseUser
          );

          if (!firebaseUser) {
            setBackendUser(null);
            setAuthLoading(false);
            return;
          }

          try {
            const token =
              await firebaseUser.getIdToken();

            const response =
              await fetch(
                `${API_URL}/auth/me`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                }
              );

            const data =
              await response
                .json()
                .catch(() => ({}));

            if (!response.ok) {
              throw new Error(
                data.message ||
                  `Authentication sync failed (${response.status})`
              );
            }

            setBackendUser(
              data.user || null
            );

            setMessage("");
          } catch (error) {
            console.error(
              "Auth sync error:",
              error
            );

            setBackendUser(null);

            setMessage(
              `Could not sync your account: ${error.message}`
            );
          } finally {
            setAuthLoading(false);
          }
        }
      );

    return unsubscribe;
  }, []);

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadPlayers();
    loadMatches();
    loadNews();
    loadLeaderboard("all");
    loadAwards();
    loadGallery();
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

  async function loadGallery(page = 1) {
    try {
      setGalleryLoading(true);

      const response =
        await fetch(
          `${API_URL}/gallery?page=${page}`
        );

      if (!response.ok) {
        throw new Error(
          "Failed to load gallery."
        );
      }

      const data =
        await response.json();

      setGallery(current => page === 1 ? (data.items || []) : [...current,...(data.items || [])]);
      setGalleryNext(data.nextPage);
    } catch (error) {
      console.error(error);
      setGallery([]);
    } finally {
      setGalleryLoading(false);
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
    if (!auth) { setMessage("Sign-in is not configured for this environment yet."); return; }
    try {
      setMessage("");

      if (
        window.innerWidth <
        700
      ) {
        await signInWithRedirect(
          auth,
          googleProvider
        );

        return;
      }

      await signInWithPopup(
        auth,
        googleProvider
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error?.code ===
          "auth/popup-closed-by-user"
          ? "Sign-in cancelled."
          : `${error?.code || "auth-error"}: ${
              error?.message ||
              "Google sign-in failed."
            }`
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
    });


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
    setRatings({});setLegacyUnrated([]);
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
    setRatings(Object.fromEntries((match.participants||[]).map(p=>[String(p.player?._id||p.player),p.rating??""])));
    setLegacyUnrated((match.participants||[]).filter(p=>p.rating==null).map(p=>String(p.player?._id||p.player)));
    const nextTeams =
      {};

    const nextGoals =
      {};

    const nextAssists =
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

  const teamAScore =
    teamAPlayers.reduce(
      (
        total,
        player
      ) =>
        total +
        (
          goals[
            String(
              player._id
            )
          ] ||
          0
        ),
      0
    );

  const teamBScore =
    teamBPlayers.reduce(
      (
        total,
        player
      ) =>
        total +
        (
          goals[
            String(
              player._id
            )
          ] ||
          0
        ),
      0
    );

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
              rating: ratings[String(player._id)] === "" || ratings[String(player._id)] == null ? null : Number(ratings[String(player._id)]),
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

      invalidate();
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

      loadCalendar(calendarYear,calendarMonth);
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
  // GALLERY
  // =========================================================

  async function uploadGalleryPhoto() {
    if (!isSignedIn) {
      setMessage(
        "Sign in to upload a photo."
      );
      return;
    }

    if (!galleryFile) {
      setMessage(
        "Choose a photo first."
      );
      return;
    }

    if (!/^image\/(jpeg|png|webp|avif)$/.test(galleryFile.type) || galleryFile.size > 8*1024*1024) { setMessage("Choose a JPEG, PNG, WebP or AVIF image under 8 MB."); return; }
    const cloudName =
      import.meta.env
        .VITE_CLOUDINARY_CLOUD_NAME;

    const uploadPreset =
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "gg-matchday-gallery";

    if (
      !cloudName ||
      !uploadPreset
    ) {
      setMessage(
        "Cloudinary upload settings are missing."
      );
      return;
    }

    try {
      setGalleryUploading(
        true
      );

      const formData =
        new FormData();

      formData.append(
        "file",
        galleryFile
      );

      formData.append(
        "upload_preset",
        uploadPreset
      );

      const cloudinaryResponse =
        await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method:
              "POST",
            body:
              formData,
          }
        );

      const cloudinaryData =
        await cloudinaryResponse.json();

      if (
        !cloudinaryResponse.ok
      ) {
        throw new Error(
          cloudinaryData.error
            ?.message ||
            "Image upload failed."
        );
      }

      const response =
        await authenticatedFetch(
          `${API_URL}/gallery`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                imageUrl:
                  cloudinaryData.secure_url,

                caption:
                  galleryCaption.trim(),
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not save gallery photo."
        );
      }

      setGalleryMatch("");setGalleryPlayers([]);invalidate();
      setGalleryFile(null);
      setGalleryCaption("");

      const fileInput =
        document.getElementById(
          "gallery-file-input"
        );

      if (fileInput) {
        fileInput.value = "";
      }

      await loadGallery();

      setMessage(
        "Photo added to GG Gallery."
      );
    } catch (error) {
      console.error(
        "Gallery upload error:",
        error
      );

      setMessage(
        error.message ||
          "Could not upload photo."
      );
    } finally {
      setGalleryUploading(
        false
      );
    }
  }

  async function deleteGalleryPhoto(
    photoId
  ) {
    if (!isAdmin) {
      return;
    }

    if (
      !window.confirm(
        "Delete this gallery photo?"
      )
    ) {
      return;
    }

    try {
      const response =
        await authenticatedFetch(
          `${API_URL}/gallery/${photoId}`,
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
            "Could not delete photo."
        );
      }

      await loadGallery();

      setMessage(
        "Photo deleted."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Could not delete photo."
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
  // CALENDAR
  // =========================================================

  async function loadCalendar(
    year,
    month
  ) {
    try {
      setCalendarLoading(
        true
      );

      const response =
        await fetch(
          `${API_URL}/stats/calendar?year=${year}&month=${month}`
        );

      if (!response.ok) {
        throw new Error(
          "Could not load calendar."
        );
      }

      const data =
        await response.json();

      setCalendarMatches(
        Array.isArray(
          data.matches
        )
          ? data.matches
          : []
      );
    } catch (error) {
      console.error(error);

      setCalendarMatches([]);
    } finally {
      setCalendarLoading(
        false
      );
    }
  }

  useEffect(() => {
    if (
      activeTab ===
      TABS.CALENDAR
    ) {
      loadCalendar(
        calendarYear,
        calendarMonth
      );
    }
  }, [
    activeTab,
    calendarYear,
    calendarMonth,
  ]);

  function getCalendarDays(
    year,
    month
  ) {
    const firstDay =
      new Date(
        year,
        month - 1,
        1
      ).getDay();

    const daysInMonth =
      new Date(
        year,
        month,
        0
      ).getDate();

    const days = [];

    for (
      let i = 0;
      i < firstDay;
      i += 1
    ) {
      days.push(null);
    }

    for (
      let day = 1;
      day <=
      daysInMonth;
      day += 1
    ) {
      days.push(day);
    }

    return days;
  }

  function matchesForDay(
    day
  ) {
    if (!day) {
      return [];
    }

    return calendarMatches.filter(
      (match) => {
        const value =
          new Date(
            match.date
          );

        return (
          value.getFullYear() ===
            calendarYear &&
          value.getMonth() +
              1 ===
            calendarMonth &&
          value.getDate() ===
            day
        );
      }
    );
  }

  function monthName(
    month
  ) {
    return new Date(
      2026,
      month - 1,
      1
    ).toLocaleString(
      undefined,
      {
        month:
          "long",
      }
    );
  }

  function previousMonth() {
    setSelectedDay(null);

    if (
      calendarMonth ===
      1
    ) {
      setCalendarMonth(12);
      setCalendarYear(
        (year) =>
          year - 1
      );
    } else {
      setCalendarMonth(
        (month) =>
          month - 1
      );
    }
  }

  function nextMonth() {
    setSelectedDay(null);

    if (
      calendarMonth ===
      12
    ) {
      setCalendarMonth(1);
      setCalendarYear(
        (year) =>
          year + 1
      );
    } else {
      setCalendarMonth(
        (month) =>
          month + 1
      );
    }
  }

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

  return (
    <main className="app">

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
        <div className="gg-header-actions"><div className="gg-theme" aria-label="Theme">{[['dark','Dark'],['golden','Gold']].map(([value,label])=><button key={value} aria-pressed={theme===value} onClick={()=>setTheme(value)}>{label}</button>)}</div>{isSignedIn&&<button className="secondary-button" onClick={()=>setModal('chat')}>Chat</button>}</div>
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
              <strong>
                Viewer mode
              </strong>

              <small>
                Public read-only access
              </small>
            </div>

            <button
              type="button"
              className="google-button"
              onClick={
                signIn
              }
            >
              Continue with Google
            </button>

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

      {activeTab ===
        TABS.HOME && (
        <section className="tab-content home-page">

          <section className="home-hero">
            <p className="eyebrow">
              YOUR FOOTBALL JOURNAL
            </p>

            <h2>
              Welcome to GG Matchday.
            </h2>

            <p className="home-intro">
              Matches, players, rankings, photos and
              every part of your football story in one
              place.
            </p>
          <button className="gg-hall-entry secondary-button" onClick={()=>setModal('hall')}>★ Hall of Fame →</button>
          </section>

          <section className="home-feature-card">

            <div className="feature-label">
              ⚡ MATCHDAY MOMENT
            </div>

            <h2>
              {latestMatch
                ? latestTopScorer &&
                  latestTopScorer.goals >=
                    3
                  ? `${latestTopScorer.name} lights up the match with a hat-trick.`
                  : latestTopScorer &&
                    latestTopScorer.goals ===
                      2
                  ? `${latestTopScorer.name} delivers a two-goal performance.`
                  : `${latestMatch.name} adds another chapter to the GG story.`
                : "Your football story starts here."}
            </h2>

            <p>
              {latestMatch
                ? `${latestTopScorer?.name || "The players"} ${
                    latestTopScorer
                      ? `recorded ${latestTopScorer.goals} goal${
                          latestTopScorer.goals ===
                          1
                            ? ""
                            : "s"
                        }`
                      : "featured in the latest match"
                  }.`
                : "Record your first match and the Matchday story will appear here."}
            </p>

            {latestMatch && (
              <div className="feature-score">

                <div>
                  <span>
                    {
                      latestMatch
                        .teamA
                        ?.label
                    }
                  </span>

                  <strong>
                    {
                      latestMatch
                        .teamA
                        ?.score
                    }
                  </strong>
                </div>

                <span>
                  :
                </span>

                <div>
                  <span>
                    {
                      latestMatch
                        .teamB
                        ?.label
                    }
                  </span>

                  <strong>
                    {
                      latestMatch
                        .teamB
                        ?.score
                    }
                  </strong>
                </div>

              </div>
            )}

          </section>

          <section className="home-stat-grid">

            <HomeStat
              label="PLAYERS"
              value={
                players.length
              }
            />

            <HomeStat
              label="MATCHES"
              value={
                overview?.matches ?? matches.length
              }
            />

            <HomeStat
              label="GOALS"
              value={
                overview?.goals ?? totalAllTimeGoals
              }
            />

            <HomeStat
              label="PHOTOS"
              value={
                overview?.photos ?? gallery.length
              }
            />

          </section>

          <section className="home-section">

            <SectionHeading
              eyebrow="THE GG DESK"
              title="Latest News"
              action="Open Gallery"
              onAction={() =>
                setActiveTab(
                  TABS.GALLERY
                )
              }
            />

            {newsLoading ? (
              <div className="loading-panel">
                Loading the football desk...
              </div>
            ) : news.length ===
              0 ? (
              <div className="empty-state">
                <span>
                  📰
                </span>

                <h3>
                  No stories yet
                </h3>

                <p>
                  Match reports will appear here as
                  your football archive grows.
                </p>
              </div>
            ) : (
              <div className="news-list">

                {news
                  .slice(
                    0,
                    6
                  )
                  .map(
                    (article) => (
                      <article
                        className="news-card"
                        key={
                          article._id
                        }
                      >
                        <div className="news-icon">
                          {
                            article.icon ||
                            "⚽"
                          }
                        </div>

                        <div className="news-content">
                          <span className="news-type">
                            {article.generatedBy ===
                            "gemini"
                              ? "THE GG DESK"
                              : "MATCH REPORT"}
                          </span>

                          <h3>
                            {
                              article.headline
                            }
                          </h3>

                          <p>
                            {
                              article.summary
                            }
                          </p>

                          <small>
                            {formatDate(
                              article.createdAt
                            )}
                          </small>
                        <LikeButton type="news" id={article._id} isSignedIn={isSignedIn}/>
                        </div>
                      </article>
                    )
                  )}

              </div>
            )}

          </section>

          <section className="home-section">

            <SectionHeading
              eyebrow="GG MOMENTS"
              title="Latest Photos"
              action="View Gallery"
              onAction={() =>
                setActiveTab(
                  TABS.GALLERY
                )
              }
            />

            {gallery.length ===
            0 ? (
              <div className="empty-state">
                <span>
                  📷
                </span>

                <h3>
                  No photos yet
                </h3>

                <p>
                  Be the first to add a Matchday
                  moment.
                </p>
              </div>
            ) : (
              <div className="home-gallery-strip">
                {gallery
                  .slice(
                    0,
                    4
                  )
                  .map(
                    (photo) => (
                      <img
                        key={
                          photo._id
                        }
                        src={
                          photo.imageUrl
                        }
                        alt={
                          photo.caption ||
                          "GG Matchday"
                        }
                        onClick={() =>
                          setActiveTab(
                            TABS.GALLERY
                          )
                        }
                      />
                    )
                  )}
              </div>
            )}

          </section>

          {leaderboard.length >
            0 && (
            <section className="home-section">

              <SectionHeading
                eyebrow="GG RANKINGS"
                title="Current Leader"
                action="Leaderboard"
                onAction={() =>
                  setActiveTab(
                    TABS.LEADERBOARD
                  )
                }
              />

              <button
                type="button"
                className="home-player-feature"
                onClick={() => {

                  const player =
                    players.find(
                      (item) =>
                        sameId(
                          item._id,
                          leaderboard[0]
                            .playerId
                        )
                    );

                  if (
                    player
                  ) {
                    openPlayerProfile(
                      player
                    );

                    setActiveTab(
                      TABS.PLAYERS
                    );
                  }

                }}
              >

                <div className="home-player-medal">
                  🥇
                </div>

                <div>
                  <span>
                    CURRENT #1
                  </span>

                  <strong>
                    {
                      leaderboard[0]
                        .name
                    }
                  </strong>

                  <small>
                    {
                      leaderboard[0]
                        .goals
                    }{" "}
                    goals ·{" "}
                    {
                      leaderboard[0]
                        .assists
                    }{" "}
                    assists
                  </small>
                </div>

                <b>
                  →
                </b>

              </button>

            </section>
          )}

        </section>
      )}

      {/* =====================================================
          RECORD
      ===================================================== */}

      {activeTab === TABS.RECORD && <section className="tab-content">
        <div className="gg-secondary-tabs" role="tablist" aria-label="Record sections"><button role="tab" aria-selected={recordSection==='record'} onClick={()=>setRecordSection('record')}>Match Record</button><button role="tab" aria-selected={recordSection==='clasico'} onClick={()=>setRecordSection('clasico')}>El Clásico</button></div>
        {recordSection==='clasico'?<Clasico onPlayer={showPlayer} onMatch={showMatch} refreshKey={refreshKey} isSignedIn={isSignedIn}/>:<>
        <div className="page-title"><p className="eyebrow">MATCH DAY</p><h2>{isEditor?(editingMatchId?'Edit Match':'Record a Match'):'Match Record'}</h2><p>{isEditor?'Assign sides, record performances, and let the match tell the story.':'Explore the GG Matchday archive.'}</p></div>
        {isEditor&&<section className="card"><form onSubmit={saveMatch}>
          <div className="form-grid"><label>Date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>Match name<input value={matchName} maxLength={160} onChange={e=>setMatchName(e.target.value)} placeholder="Sunday Football"/></label></div>
          <div className="match-score-header"><div className="side-block"><span>Side 1</span><input value={teamALabel} maxLength={80} onChange={e=>setTeamALabel(e.target.value)}/><strong key={teamAScore}>{teamAScore}</strong></div><span className="versus">:</span><div className="side-block"><span>Side 2</span><input value={teamBLabel} maxLength={80} onChange={e=>setTeamBLabel(e.target.value)}/><strong key={teamBScore}>{teamBScore}</strong></div></div>
          <div className="subsection"><div className="section-heading"><h3>Player performances</h3><span className="muted">{assignedPlayers.length} participating</span></div><div className="gg-performance-head"><span>Player</span><span>Side</span><span>Goals</span><span>Assists</span><span>Rating</span></div>
          {players.map(player=>{const id=String(player._id),assigned=Boolean(teams[id]);return <div className={`gg-performance-row ${assigned?'assigned':''}`} key={id}><div><strong>{player.name}</strong><small>{teams[id]==='A'?teamALabel:teams[id]==='B'?teamBLabel:'Not participating'}</small></div><div className="team-switch">{['A','B'].map((team,i)=><button key={team} type="button" aria-label={`${player.name} Side ${i+1}`} aria-pressed={teams[id]===team} className={teams[id]===team?'active':''} onClick={()=>setPlayerTeam(id,team)}>{i+1}</button>)}</div>{[[goals,setGoals,'Goals'],[assists,setAssists,'Assists']].map(([values,setter,label])=><div className="counter" key={label}><button type="button" disabled={!assigned||!values[id]} aria-label={`Remove ${label.toLowerCase()} for ${player.name}`} onClick={()=>changeCount(setter,id,-1)}>−</button><strong key={values[id]}>{assigned?values[id]||0:0}</strong><button type="button" disabled={!assigned} aria-label={`Add ${label.toLowerCase()} for ${player.name}`} onClick={()=>changeCount(setter,id,1)}>+</button></div>)}<label className="gg-rating-input"><span className="sr-only">Rating for {player.name}</span><input type="number" min="0" max="10" step="0.1" placeholder={legacyUnrated.includes(id)?'Unrated':'0–10'} disabled={!assigned} required={assigned&&!legacyUnrated.includes(id)} value={ratings[id]??''} onChange={e=>setRatings(old=>({...old,[id]:e.target.value}))}/></label></div>;})}</div>
          <div className="match-total"><span>{totalGoals} goals</span><span>{totalAssists} assists</span></div><button type="submit" className="save-button" disabled={savingMatch}>{savingMatch?'Saving…':editingMatchId?'Update Match':'Save Match'}</button>{editingMatchId&&<button type="button" className="secondary-button" onClick={resetMatchForm}>Cancel edit</button>}
        </form></section>}
        <section className="card quick-gallery-card"><h3>Matchday media</h3><button className="secondary-button" onClick={()=>setActiveTab(TABS.GALLERY)}>Open Gallery →</button></section>
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

      {activeTab ===
        TABS.CALENDAR && (
        <section className="tab-content">

          <div className="page-title">
            <p className="eyebrow">
              MATCH JOURNAL
            </p>

            <h2>
              Calendar
            </h2>

            <p>
              Browse Matchday history day by day.
            </p>
          </div>

          <section className="card calendar-card">

            <div className="calendar-header">

              <button
                type="button"
                className="calendar-nav"
                onClick={
                  previousMonth
                }
              >
                ‹
              </button>

              <div>
                <h3>
                  {
                    monthName(
                      calendarMonth
                    )
                  }{" "}
                  {
                    calendarYear
                  }
                </h3>

                <span>
                  {
                    calendarMatches.length
                  }{" "}
                  matches
                </span>
              </div>

              <button
                type="button"
                className="calendar-nav"
                onClick={
                  nextMonth
                }
              >
                ›
              </button>

            </div>

            {calendarLoading ? (
              <div className="loading-panel">
                Loading calendar...
              </div>
            ) : (
              <>

                <div className="calendar-weekdays">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                <div className="calendar-grid">

                  {getCalendarDays(
                    calendarYear,
                    calendarMonth
                  ).map(
                    (
                      day,
                      index
                    ) => {

                      const dayMatches =
                        matchesForDay(
                          day
                        );

                      return (
                        <button
                          key={`${calendarYear}-${calendarMonth}-${index}`}
                          type="button"
                          disabled={
                            !day
                          }
                          className={`calendar-day ${
                            dayMatches.length
                              ? "has-match"
                              : ""
                          } ${
                            selectedDay ===
                            day
                              ? "selected-day"
                              : ""
                          }`}
                          onMouseEnter={() =>
                            setHoveredDay(
                              day
                            )
                          }
                          onMouseLeave={() =>
                            setHoveredDay(
                              null
                            )
                          }
                          onClick={() =>
                            setSelectedDay(
                              day
                            )
                          }
                        >

                          {day && (
                            <>
                              <strong>
                                {
                                  day
                                }
                              </strong>

                              {dayMatches.length >
                                0 && (
                                <span className="calendar-dot" />
                              )}

                              {hoveredDay ===
                                day &&
                                dayMatches.length >
                                  0 && (
                                  <div className="calendar-popover">

                                    {dayMatches
                                      .slice(
                                        0,
                                        3
                                      )
                                      .map(
                                        (
                                          match
                                        ) => (
                                          <div
                                            key={
                                              match._id
                                            }
                                          >
                                            <strong>
                                              {
                                                match
                                                  .teamA
                                                  ?.score
                                              }{" "}
                                              :{" "}
                                              {
                                                match
                                                  .teamB
                                                  ?.score
                                              }
                                            </strong>

                                            <span>
                                              {
                                                match
                                                  .teamA
                                                  ?.label
                                              }{" "}
                                              vs{" "}
                                              {
                                                match
                                                  .teamB
                                                  ?.label
                                              }
                                            </span>

                                            <small>
                                              {
                                                match.name
                                              }
                                            </small>
                                          </div>
                                        )
                                      )}

                                  </div>
                                )}

                            </>
                          )}

                        </button>
                      );
                    }
                  )}

                </div>

              </>
            )}

          </section>

          <section className="section-block">

            <SectionHeading
              eyebrow="DAY DETAILS"
              title={
                selectedDay
                  ? `${monthName(
                      calendarMonth
                    )} ${selectedDay}`
                  : "Select a date"
              }
            />

            {selectedDay &&
            matchesForDay(
              selectedDay
            ).length >
              0 ? (
              <div className="match-list">

                {matchesForDay(
                  selectedDay
                ).map(
                  (
                    match
                  ) => (
                    <MatchHistoryCard onOpen={()=>showMatch(match._id)}
                      key={
                        match._id
                      }
                      match={
                        match
                      }
                      canEdit={
                        isEditor
                      }
                      onEdit={() =>
                        startEditingMatch(
                          match
                        )
                      }
                      onDelete={() =>
                        deleteMatch(
                          match._id
                        )
                      }
                    />
                  )
                )}

              </div>
            ) : (
              <div className="empty-state">

                <span>
                  📅
                </span>

                <h3>
                  No matches this day
                </h3>

                <p>
                  Select another date to explore the
                  archive.
                </p>

              </div>
            )}

          </section>

        </section>
      )}

      {/* =====================================================
          PLAYERS
      ===================================================== */}

      {activeTab ===
        TABS.PLAYERS && (
        <section className="tab-content">

          {!selectedPlayer ? (
            <>

              <div className="page-title">

                <p className="eyebrow">
                  SQUAD
                </p>

                <h2>
                  Players
                </h2>

                <p>
                  Profiles, player details and career
                  statistics.
                </p>

              </div>

              {isEditor && (
                <section className="card">

                  <form
                    onSubmit={
                      addPlayer
                    }
                  >

                    <label>
                      <span>
                        Add Player
                      </span>

                      <div className="add-player-form">

                        <input
                          value={
                            newPlayerName
                          }
                          onChange={(
                            event
                          ) =>
                            setNewPlayerName(
                              event.target.value
                            )
                          }
                          placeholder="Player name"
                        />

                        <button
                          type="submit"
                          className="add-button"
                          disabled={
                            playerActionLoading
                          }
                        >
                          {
                            playerActionLoading
                              ? "..."
                              : "Add Player"
                          }
                        </button>

                      </div>
                    </label>

                  </form>

                </section>
              )}

              <Squad players={players} statistics={leaderboard} onPlayer={showPlayer}/>
              <section className="section-block">

                <div className="section-heading">

                  <div>
                    <p className="eyebrow">
                      ROSTER
                    </p>

                    <h2>
                      All Players
                    </h2>
                  </div>

                  <span className="muted">
                    {
                      players.length
                    }
                  </span>

                </div>

                {loadingPlayers ? (
                  <div className="loading-panel">
                    Loading players...
                  </div>
                ) : players.length ===
                  0 ? (
                  <div className="empty-state">

                    <span>
                      👥
                    </span>

                    <h3>
                      No players yet
                    </h3>

                  </div>
                ) : (
                  <div className="player-list">

                    {players.map(
                      (
                        player
                      ) => (
                        <button
                          type="button"
                          className="player-profile-row"
                          key={
                            player._id
                          }
                          onClick={() =>
                            openPlayerProfile(
                              player
                            )
                          }
                        >

                          {player.profileImage ? (
                            <img
                              className="player-photo"
                              src={
                                player.profileImage
                              }
                              alt=""
                            />
                          ) : (
                            <div className="player-avatar">
                              {
                                player.name
                                  ?.charAt(
                                    0
                                  )
                                  .toUpperCase()
                              }
                            </div>
                          )}

                          <div className="managed-player-info">

                            <strong>
                              {
                                player.name
                              }
                            </strong>

                            <span>
                              {
                                player.position ||
                                "Position not set"
                              }
                            </span>

                          </div>

                          <span className="profile-arrow">
                            →
                          </span>

                        </button>
                      )
                    )}

                  </div>
                )}

              </section>

            </>
          ) : (
            <section className="player-profile">

              <button
                type="button"
                className="back-button"
                onClick={() => {
                  setSelectedPlayer(null);
            
                  setPlayerReview(null);
                }}
              >
                ← Back to Players
              </button>

              <section className="profile-hero card">

                <div className="profile-photo-wrap">

                  {selectedPlayer.profileImage ? (
                    <img
                      src={
                        selectedPlayer.profileImage
                      }
                      alt={
                        selectedPlayer.name
                      }
                      className="profile-large-photo"
                    />
                  ) : (
                    <div className="profile-photo-fallback">
                      {
                        selectedPlayer.name
                          ?.charAt(
                            0
                          )
                          .toUpperCase()
                      }
                    </div>
                  )}

                </div>

                <div className="profile-heading">

                  <p className="eyebrow">
                    PLAYER PROFILE
                  </p>

                  <h2>
                    {
                      selectedPlayer.name
                    }
                  </h2>

                  <p>
                    {
                      selectedPlayer.position ||
                      "Position not set"
                    }
                  </p>

                </div>

                {isEditor && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setEditingProfile(
                        (
                          value
                        ) =>
                          !value
                      )
                    }
                  >
                    {
                      editingProfile
                        ? "Cancel"
                        : "Edit Profile"
                    }
                  </button>
                )}

              </section>

              {editingProfile &&
              isEditor ? (
                <section className="card">

                  <form
                    onSubmit={
                      savePlayerProfile
                    }
                  >

                    <div className="form-grid">

                      <label>
                        <span>
                          Name
                        </span>

                        <input
                          value={
                            profileForm.name
                          }
                          onChange={(
                            event
                          ) =>
                            setProfileForm(
                              (
                                current
                              ) => ({
                                ...current,
                                name:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Profile Image URL
                        </span>

                        <input
                          value={
                            profileForm.profileImage
                          }
                          onChange={(
                            event
                          ) =>
                            setProfileForm(
                              (
                                current
                              ) => ({
                                ...current,
                                profileImage:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </label>

                    </div>

                    <div className="profile-fields-grid">

                      {[
                        [
                          "height",
                          "Height (cm)",
                        ],
                        [
                          "weight",
                          "Weight (kg)",
                        ],
                        [
                          "position",
                          "Position",
                        ],
                        [
                          "jerseyNumber",
                          "Jersey Number",
                        ],
                      ].map(
                        ([
                          field,
                          label,
                        ]) => (
                          <label
                            key={
                              field
                            }
                          >
                            <span>
                              {
                                label
                              }
                            </span>

                            <input
                              type={
                                field ===
                                "height" ||
                                field ===
                                "weight" ||
                                field ===
                                "jerseyNumber"
                                  ? "number"
                                  : "text"
                              }
                              value={
                                profileForm[
                                  field
                                ]
                              }
                              onChange={(
                                event
                              ) =>
                                setProfileForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,
                                    [field]:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                            />
                          </label>
                        )
                      )}

                      <label>
                        <span>
                          Preferred Foot
                        </span>

                        <select
                          value={
                            profileForm.preferredFoot
                          }
                          onChange={(
                            event
                          ) =>
                            setProfileForm(
                              (
                                current
                              ) => ({
                                ...current,
                                preferredFoot:
                                  event.target.value,
                              })
                            )
                          }
                        >
                          <option value="">
                            Not set
                          </option>

                          <option value="Left">
                            Left
                          </option>

                          <option value="Right">
                            Right
                          </option>

                          <option value="Both">
                            Both
                          </option>
                        </select>
                      </label>

                      <label>
                        <span>
                          Date of Birth
                        </span>

                        <input
                          type="date"
                          value={
                            profileForm.dateOfBirth
                          }
                          onChange={(
                            event
                          ) =>
                            setProfileForm(
                              (
                                current
                              ) => ({
                                ...current,
                                dateOfBirth:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </label>

                    </div>

                    <label>
                      <span>
                        Bio
                      </span>

                      <textarea
                        rows="5"
                        value={
                          profileForm.bio
                        }
                        onChange={(
                          event
                        ) =>
                          setProfileForm(
                            (
                              current
                            ) => ({
                              ...current,
                              bio:
                                event.target.value,
                            })
                          )
                        }
                      />
                    </label>

                    <button
                      type="submit"
                      className="save-button"
                      disabled={
                        profileSaving
                      }
                    >
                      {
                        profileSaving
                          ? "Saving..."
                          : "Save Profile"
                      }
                    </button>

                  </form>

                </section>
              ) : (
                <>

                  <div className="profile-info-grid">

                    <InfoItem
                      label="Height"
                      value={
                        selectedPlayer.height
                          ? `${selectedPlayer.height} cm`
                          : "—"
                      }
                    />

                    <InfoItem
                      label="Weight"
                      value={
                        selectedPlayer.weight
                          ? `${selectedPlayer.weight} kg`
                          : "—"
                      }
                    />

                    <InfoItem
                      label="Position"
                      value={
                        selectedPlayer.position ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="Preferred Foot"
                      value={
                        selectedPlayer.preferredFoot ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="Jersey"
                      value={
                        selectedPlayer.jerseyNumber ??
                        "—"
                      }
                    />

                    <InfoItem
                      label="Date of Birth"
                      value={
                        formatDate(
                          selectedPlayer.dateOfBirth
                        )
                      }
                    />

                  </div>

                  <ProfileInsights playerId={selectedPlayer._id} onMatch={showMatch} refreshKey={refreshKey}/>

                  <section className="card">

                    <div className="section-heading">

                      <div>
                        <p className="eyebrow">
                          AI EDITORIAL
                        </p>

                        <h3>
                          Player Review
                        </h3>
                      </div>

                      <button
                        type="button"
                        className="secondary-button"
                        disabled={
                          playerReviewLoading
                        }
                        onClick={() =>
                          loadPlayerReview(
                            selectedPlayer._id
                          )
                        }
                      >
                        {
                          playerReviewLoading
                            ? "Writing..."
                            : "Generate Review"
                        }
                      </button>

                    </div>

                    {playerReview ? (
                      <div className="ai-review">
                        <p>
                          {
                            playerReview.review
                          }
                        </p>
                      </div>
                    ) : (
                      <p className="muted">
                        Generate a review from the
                        player's statistics.
                      </p>
                    )}

                  </section>

                  <section className="card profile-bio">

                    <p className="eyebrow">
                      ABOUT
                    </p>

                    <p>
                      {
                        selectedPlayer.bio ||
                        "No player bio added yet."
                      }
                    </p>

                  </section>

                  {isEditor && (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        deletePlayer(
                          selectedPlayer._id
                        )
                      }
                    >
                      Delete Player
                    </button>
                  )}

                </>
              )}

            </section>
          )}

        </section>
      )}

      {/* =====================================================
          GALLERY
      ===================================================== */}

      {activeTab ===
        TABS.GALLERY && (
        <section className="tab-content">

          <div className="page-title">

            <p className="eyebrow">
              GG MOMENTS
            </p>

            <h2>
              Gallery
            </h2>

            <p>
              Photos from the GG Matchday football
              archive.
            </p>

          </div>

          {isSignedIn ? (
            <section className="card gallery-upload-card">

              <div className="section-heading">

                <div>
                  <p className="eyebrow">
                    SHARE A MOMENT
                  </p>

                  <h3>
                    Add a Photo
                  </h3>

                  <p>
                    Anyone signed in can contribute to
                    the gallery.
                  </p>
                </div>

              </div>

              <input
                id="gallery-file-input"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setGalleryFile(
                    event.target.files?.[0] ||
                      null
                  )
                }
              />

              {galleryFile && (
                <p className="file-selected">
                  Selected:{" "}
                  {
                    galleryFile.name
                  }
                </p>
              )}

              <input
                type="text"
                value={
                  galleryCaption
                }
                onChange={(event) =>
                  setGalleryCaption(
                    event.target.value
                  )
                }
                placeholder="Add a caption..."
                maxLength={160}
              />

              <label>Match (optional)<select value={galleryMatch} onChange={e=>setGalleryMatch(e.target.value)}><option value="">No match association</option>{matches.map(m=><option key={m._id} value={m._id}>{m.name} · {formatDate(m.date)}</option>)}</select></label>
              <fieldset className="gg-associations"><legend>Players (optional)</legend>{players.map(p=><label key={p._id}><input type="checkbox" checked={galleryPlayers.includes(p._id)} onChange={e=>setGalleryPlayers(old=>e.target.checked?[...old,p._id]:old.filter(id=>id!==p._id))}/>{p.name}</label>)}</fieldset>
              <button
                type="button"
                className="save-button"
                disabled={
                  !galleryFile ||
                  galleryUploading
                }
                onClick={
                  uploadGalleryPhoto
                }
              >
                {
                  galleryUploading
                    ? "Uploading..."
                    : "Add to Gallery"
                }
              </button>

            </section>
          ) : (
            <section className="gallery-login-note">

              <strong>
                Want to share a photo?
              </strong>

              <span>
                Sign in with Google to upload a
                Matchday moment.
              </span>

              <button
                type="button"
                className="google-button"
                onClick={
                  signIn
                }
              >
                Sign in with Google
              </button>

            </section>
          )}

          {galleryLoading ? (
            <div className="loading-panel">
              Loading the gallery...
            </div>
          ) : gallery.length ===
            0 ? (
            <div className="empty-state">

              <span>
                📷
              </span>

              <h3>
                No photos yet
              </h3>

              <p>
                The first Matchday moment is waiting
                to be uploaded.
              </p>

            </div>
          ) : (
            <div className="gallery-grid">

              {gallery.map(
                (photo) => (
                  <article
                    className="gallery-item"
                    key={
                      photo._id
                    }
                  >

                    <div className="gallery-image-wrap">

                      <img
                        src={
                          photo.imageUrl
                        }
                        alt={
                          photo.caption ||
                          "GG Matchday"
                        }
                        loading="lazy"
                      />

                    </div>

                    <div className="gallery-meta">

                      {photo.caption && (
                        <strong>
                          {
                            photo.caption
                          }
                        </strong>
                      )}

                      <span>
                        {
                          photo.uploadedByName ||
                          "GG Matchday"
                        }
                      </span>

                      <small>
                        {
                          formatDate(
                            photo.createdAt
                          )
                        }
                      </small>

                      <LikeButton type="gallery" id={photo._id} isSignedIn={isSignedIn}/>
                      {photo.matchId&&<button className="gg-player-link" onClick={()=>showMatch(photo.matchId._id)}>Match: {photo.matchId.name}</button>}
                      {(photo.playerIds||[]).map(player=><button key={player._id} className="gg-player-link" onClick={()=>showPlayer(player._id)}>{player.name}</button>)}
                      {isAdmin && (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() =>
                            deleteGalleryPhoto(
                              photo._id
                            )
                          }
                        >
                          Delete
                        </button>
                      )}

                    </div>

                  </article>
                )
              )}

            </div>
          )}

          {galleryNext&&<button className="secondary-button" onClick={()=>loadGallery(galleryNext)} disabled={galleryLoading}>Load more photos</button>}
        </section>
      )}

      {/* =====================================================
          ADMIN
      ===================================================== */}

      {activeTab ===
        TABS.ADMIN && (
        <section className="tab-content">

          {!isAdmin ? (
            <AccessDenied
              title="Admin access required"
              description="This area is only available to the GG Matchday administrator."
              signIn={
                !isSignedIn
                  ? signIn
                  : null
              }
            />
          ) : (
            <>

              <div className="page-title">
                <p className="eyebrow">
                  ADMIN
                </p>

                <h2>
                  Access Control
                </h2>

                <p>
                  Manage editor requests and active
                  editors.
                </p>
              </div>

              <section className="card">

                <div className="section-heading">

                  <div>
                    <p className="eyebrow">
                      REQUESTS
                    </p>

                    <h3>
                      Editor Requests
                    </h3>
                  </div>

                  <span className="muted">
                    {
                      editorRequests.length
                    }
                  </span>

                </div>

                {adminLoading ? (
                  <div className="loading-panel">
                    Loading requests...
                  </div>
                ) : editorRequests.length ===
                  0 ? (
                  <div className="empty-state">

                    <span>
                      ✅
                    </span>

                    <h3>
                      No pending requests
                    </h3>

                    <p>
                      You're all caught up.
                    </p>

                  </div>
                ) : (
                  <div className="admin-request-list">

                    {editorRequests.map(
                      (
                        request
                      ) => (
                        <div
                          className="admin-request"
                          key={
                            request._id
                          }
                        >

                          <div className="admin-request-user">

                            {request.photoURL ? (
                              <img
                                src={
                                  request.photoURL
                                }
                                alt=""
                              />
                            ) : (
                              <div>
                                {
                                  request.name
                                    ?.charAt(
                                      0
                                    )
                                    .toUpperCase()
                                }
                              </div>
                            )}

                            <div>

                              <strong>
                                {
                                  request.name ||
                                  "User"
                                }
                              </strong>

                              <span>
                                {
                                  request.email
                                }
                              </span>

                            </div>

                          </div>

                          <div className="admin-request-actions">

                            <button
                              type="button"
                              className="approve-button"
                              disabled={
                                adminActionLoading
                              }
                              onClick={() =>
                                handleEditorRequest(
                                  request._id,
                                  "approve"
                                )
                              }
                            >
                              Approve
                            </button>

                            <button
                              type="button"
                              className="danger-button"
                              disabled={
                                adminActionLoading
                              }
                              onClick={() =>
                                handleEditorRequest(
                                  request._id,
                                  "reject"
                                )
                              }
                            >
                              Reject
                            </button>

                          </div>

                        </div>
                      )
                    )}

                  </div>
                )}

              </section>

              <section className="card">

                <div className="section-heading">

                  <div>
                    <p className="eyebrow">
                      TEAM ACCESS
                    </p>

                    <h3>
                      Active Editors
                    </h3>
                  </div>

                  <span className="muted">
                    {
                      activeEditors.length
                    }
                  </span>

                </div>

                {editorsLoading ? (
                  <div className="loading-panel">
                    Loading editors...
                  </div>
                ) : activeEditors.length ===
                  0 ? (
                  <div className="empty-state">

                    <span>
                      ✏️
                    </span>

                    <h3>
                      No active editors
                    </h3>

                  </div>
                ) : (
                  <div className="admin-request-list">

                    {activeEditors.map(
                      (
                        editor
                      ) => (
                        <div
                          className="admin-request"
                          key={
                            editor._id
                          }
                        >

                          <div className="admin-request-user">

                            {editor.photoURL ? (
                              <img
                                src={
                                  editor.photoURL
                                }
                                alt=""
                              />
                            ) : (
                              <div>
                                {
                                  editor.name
                                    ?.charAt(
                                      0
                                    )
                                    .toUpperCase()
                                }
                              </div>
                            )}

                            <div>

                              <strong>
                                {
                                  editor.name
                                }
                              </strong>

                              <span>
                                {
                                  editor.email
                                }
                              </span>

                              <small>
                                Editor
                              </small>

                            </div>

                          </div>

                          <button
                            type="button"
                            className="danger-button"
                            disabled={
                              adminActionLoading
                            }
                            onClick={() =>
                              revokeEditor(
                                editor._id
                              )
                            }
                          >
                            Remove Editor
                          </button>

                        </div>
                      )
                    )}

                  </div>
                )}

              </section>

              <section className="formula-card">

                <p className="eyebrow">
                  PERMISSIONS
                </p>

                <h3>
                  GG Matchday access
                </h3>

                <div className="permission-model">

                  <div>
                    <strong>
                      Viewer
                    </strong>

                    <span>
                      View the public archive and
                      upload Gallery photos.
                    </span>
                  </div>

                  <div>
                    <strong>
                      Editor
                    </strong>

                    <span>
                      Manage matches, players and
                      football data.
                    </span>
                  </div>

                  <div>
                    <strong>
                      Admin
                    </strong>

                    <span>
                      Full access plus user management.
                    </span>
                  </div>

                </div>

                <p>
                  Removing editor access changes the
                  user's role back to viewer without
                  deleting their account or history.
                </p>

              </section>

            </>
          )}

        </section>
      )}

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
    </main>
  );
}

// =========================================================
// COMPONENTS
// =========================================================

function SectionHeading({
  eyebrow,
  title,
  action,
  onAction,
}) {
  return (
    <div className="section-heading">

      <div>
        <p className="eyebrow">
          {eyebrow}
        </p>

        <h2>
          {title}
        </h2>
      </div>

      {action && (
        <button
          type="button"
          className="text-button"
          onClick={
            onAction
          }
        >
          {action} →
        </button>
      )}

    </div>
  );
}

function HomeStat({
  label,
  value,
}) {
  return (
    <div className="home-stat-card">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}

function MatchHistoryCard({match,canEdit,onEdit,onDelete,onOpen}) {
 const scorers=team=>{const ids=new Set((match.participants||[]).filter(p=>p.team===team).map(p=>String(p.player?._id||p.player)));const counts=new Map();for(const e of match.events||[])if(e.type==='goal'&&ids.has(String(e.player?._id||e.player))){const name=e.player?.name||'Player';counts.set(name,(counts.get(name)||0)+1);}return [...counts].map(([name,n])=>`${name}(${n})`).join(', ')||'—';};
 return <article className="match-card"><button className="gg-match-open" onClick={onOpen}><div className="match-main"><div><p className="match-date">{formatDate(match.date)}</p><h3>{match.name}</h3></div><div className="match-score"><strong>{match.teamA.score}–{match.teamB.score}</strong><span>{match.teamA.score===match.teamB.score?'DRAW':'FINAL'}</span></div></div><div className="v14-history-summary"><div className="v14-history-team"><strong>{match.teamA.label}</strong><div className="v14-history-scorers">{scorers('A')}</div></div><div className="v14-history-team v14-history-team-b"><strong>{match.teamB.label}</strong><div className="v14-history-scorers">{scorers('B')}</div></div></div><small className="muted">View match details →</small></button>{canEdit&&<div className="match-actions"><button className="secondary-button" onClick={onEdit}>Edit</button><button className="danger-button" onClick={onDelete}>Delete</button></div>}</article>;
}

function InfoItem({
  label,
  value,
}) {
  return (
    <div className="profile-info-item">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}

function AccessDenied({
  title,
  description,
  signIn,
  request,
  pending,
}) {
  return (
    <section className="access-denied">

      <div className="access-icon">
        🔒
      </div>

      <p className="eyebrow">
        RESTRICTED
      </p>

      <h2>
        {title}
      </h2>

      <p>
        {description}
      </p>

      {signIn && (
        <button
          type="button"
          className="google-button"
          onClick={
            signIn
          }
        >
          Continue with Google
        </button>
      )}

      {request &&
        !pending && (
          <button
            type="button"
            className="secondary-button"
            onClick={
              request
            }
          >
            Request Editor Access
          </button>
        )}

      {pending && (
        <span className="request-pending">
          Your editor request is pending approval.
        </span>
      )}

    </section>
  );
}

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
