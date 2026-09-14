import {lazy, Suspense, useCallback} from 'react';
import Squad from './components/Squad';
import LeaderboardView from './components/Leaderboard';
import ProfileInsights from './components/ProfileInsights';
import Clasico from './components/Clasico';
import PlayerComparisons from './components/PlayerComparisons';
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

            body: JSON.stringify({
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
        "Player added."
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

  async function savePlayerProfile(
    event
  ) {
    event.preventDefault();

    if (!isEditor || !selectedPlayer) {
      setMessage("Editor access required.");
      return;
    }

    try {
      setProfileSaving(true);

      const response = await authenticatedFetch(
        `${API_URL}/players/${selectedPlayer._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profileForm.name,
            profileImage: profileForm.profileImage,
            height: profileForm.height === "" ? null : Number(profileForm.height),
            weight: profileForm.weight === "" ? null : Number(profileForm.weight),
            position: profileForm.position,
            preferredFoot: profileForm.preferredFoot,
            jerseyNumber: profileForm.jerseyNumber === "" ? null : Number(profileForm.jerseyNumber),
            dateOfBirth: profileForm.dateOfBirth || null,
            bio: profileForm.bio,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not update profile.");
      }

      const updated = data.player || data;
      setSelectedPlayer(updated);
      setPlayers((current) =>
        current.map((player) =>
          sameId(player._id, updated._id) ? updated : player
        )
      );
      setEditingProfile(false);
      setMessage("Profile updated.");
      await loadPlayers();
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

  const teamAScore = teamANormalScore + teamAOwnGoals;
  const teamBScore = teamBNormalScore + teamBOwnGoals;

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

  function buildParticipants() {
    return assignedPlayers.map(player=>({player:player._id,team:teams[String(player._id)],rating:ratings[String(player._id)]===""||ratings[String(player._id)]==null?null:Number(ratings[String(player._id)]),ownGoals:Number(ownGoals[String(player._id)]||0)}));
  }

  function validateRecord() {
    if (!assignedPlayers.length) return "Assign at least one player to a team.";
    if (!teamAPlayers.length || !teamBPlayers.length) return "Both teams need at least one player.";
    if (totalGoals < 1) return "Record at least one goal.";
    if (totalAssists > totalGoals) return "Assists cannot exceed total goals.";
    const badRating = assignedPlayers.find(player=>{const value=ratings[String(player._id)];return value!==""&&value!=null&&(Number(value)<0||Number(value)>10||!Number.isFinite(Number(value)));});
    if (badRating) return `Rating for ${badRating.name} must be between 0 and 10.`;
    return "";
  }

  async function saveMatch() {
    if (!isEditor) {
      setMessage("Editor access required.");
      return;
    }
    const error=validateRecord();
    if(error){setMessage(error);return;}
    try {
      setSavingMatch(true);
      const payload={date:new Date(`${date}T12:00:00`).toISOString(),name:matchName.trim()||"Football Match",teamA:{label:teamALabel.trim()||"Team A",score:teamAScore},teamB:{label:teamBLabel.trim()||"Team B",score:teamBScore},participants:buildParticipants(),events:buildEvents()};
      const endpoint=editingMatchId?`${API_URL}/matches/${editingMatchId}`:`${API_URL}/matches`;
      const response=await authenticatedFetch(endpoint,{method:editingMatchId?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||"Could not save match.");
      setMessage(editingMatchId?"Match updated.":"Match recorded.");
      resetMatchForm();
      await loadMatches();
      await loadNews();
      await loadLeaderboard("all");
      await loadAwards();
      invalidate();
    }catch(error){console.error(error);setMessage(error.message||"Could not save match.");}finally{setSavingMatch(false);}
  }

  // =========================================================
  // PLAYER PROFILE HELPERS
  // =========================================================

  function openPlayerProfile(player){
    setSelectedPlayer(player);
    setEditingProfile(false);
    setPlayerReview(null);
    setModal("player");
  }

  function closePlayerProfile(){setModal(null);setSelectedPlayer(null);setEditingProfile(false);}

  // =========================================================
  // ADMIN
  // =========================================================

  async function loadEditorRequests() {
    if (!isAdmin) return;
    try {
      setAdminLoading(true);
      const response = await authenticatedFetch(`${API_URL}/auth/editor-requests`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load editor requests.");
      setEditorRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Could not load editor requests.");
    } finally {
      setAdminLoading(false);
    }
  }

  async function loadActiveEditors() {
    if (!isAdmin) return;
    try {
      setEditorsLoading(true);
      const response = await authenticatedFetch(`${API_URL}/auth/editors`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load editors.");
      setActiveEditors(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Could not load editors.");
    } finally {
      setEditorsLoading(false);
    }
  }

  async function decideEditorRequest(id, action) {
    if (!isAdmin) return;
    try {
      setAdminActionLoading(true);
      const response = await authenticatedFetch(`${API_URL}/auth/editor-requests/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not update request.");
      await loadEditorRequests();
      await loadActiveEditors();
      setMessage(data.message || "Editor request updated.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Could not update request.");
    } finally {
      setAdminActionLoading(false);
    }
  }

  async function revokeEditor(userId) {
    if (!isAdmin) return;
    try {
      setAdminActionLoading(true);
      const response = await authenticatedFetch(`${API_URL}/auth/editors/${userId}`,{method:"DELETE"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not revoke editor access.");
      await loadActiveEditors();
      setMessage(data.message || "Editor access revoked.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Could not revoke editor access.");
    } finally {
      setAdminActionLoading(false);
    }
  }

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
              Matches, players, rankings and
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


          </section>

          <section className="home-section">

            <SectionHeading
              eyebrow="THE GG DESK"
              title="Latest News"
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
                    12
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
                        </div>
                      </article>
                    )
                  )}

              </div>
            )}

          </section>

          <PlayerComparisons players={players} statistics={leaderboard} onPlayer={(playerId) => showPlayer(playerId)} />

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
                            ?.playerId
                        )
                    );

                  if (player) {
                    openPlayerProfile(
                      player
                    );
                  }
                }}
              >

                <div className="home-player-medal">
                  🏆
                </div>

                <div>
                  <span>
                    {leaderboard[0]?.name || "Current leader"}
                  </span>

                  <strong>
                    {leaderboard[0]?.ggRating?.toFixed(2) || "—"}
                  </strong>

                  <small>
                    GG Rating
                  </small>
                </div>

                <div className="home-player-arrow">
                  →
                </div>

              </button>

            </section>
          )}

          <section className="home-section home-dual-grid">
            <ProfileInsights players={players} leaderboard={leaderboard} />
            <Squad players={players} />
          </section>

        </section>
      )}

      {/* =====================================================
          RECORD
      ===================================================== */}

      {activeTab ===
        TABS.RECORD && (
        <section className="tab-content">
          {/* existing record UI */}
        </section>
      )}

      {/* =====================================================
          LEADERBOARD
      ===================================================== */}

      {activeTab ===
        TABS.LEADERBOARD && (
        <LeaderboardView
          leaderboard={leaderboard}
          players={players}
          period={leaderboardPeriod}
          onPlayer={showPlayer}
        />
      )}

      {activeTab ===
        TABS.CALENDAR && (
        <section className="tab-content">
          {/* existing calendar UI */}
        </section>
      )}

      {activeTab ===
        TABS.PLAYERS && (
        <section className="tab-content">
          {/* existing players UI */}
        </section>
      )}

      {activeTab ===
        TABS.ADMIN && (
        <section className="tab-content">
          {/* existing admin UI */}
        </section>
      )}

      {/* MODALS */}

      {modal === 'chat' && <Chat onClose={closeModal} />}
      {modal === 'hall' && <HallOfFame onClose={closeModal} onPlayer={showPlayer} />}
      {modal === 'match' && <MatchDetail matchId={detailId} onClose={closeModal} onPlayer={showPlayer} />}
      {modal === 'player' && selectedPlayer && <ProfileInsights player={selectedPlayer} onClose={closePlayerProfile} />}

      <nav className="bottom-nav">
        <button className={activeTab===TABS.HOME?'active':''} onClick={()=>setActiveTab(TABS.HOME)}>⌂<span>Home</span></button>
        <button className={activeTab===TABS.RECORD?'active':''} onClick={()=>setActiveTab(TABS.RECORD)}>＋<span>Record</span></button>
        <button className={activeTab===TABS.LEADERBOARD?'active':''} onClick={()=>setActiveTab(TABS.LEADERBOARD)}>🏆<span>Leaderboard</span></button>
        <button className={activeTab===TABS.CALENDAR?'active':''} onClick={()=>setActiveTab(TABS.CALENDAR)}>▦<span>Calendar</span></button>
        <button className={activeTab===TABS.PLAYERS?'active':''} onClick={()=>setActiveTab(TABS.PLAYERS)}>♟<span>Players</span></button>
      </nav>
    </main>
  );
}

function HomeStat({label,value}){
  return <div className="home-stat-card"><span>{label}</span><strong>{value}</strong></div>;
}

function SectionHeading({eyebrow,title,action,onAction}){
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action&&<button type="button" className="text-button" onClick={onAction}>{action} →</button>}</div>;
}
