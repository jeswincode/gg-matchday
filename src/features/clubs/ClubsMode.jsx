import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import "./clubs-mode.css";

const formationLabels4 = ["1-2-1", "2-1-1", "1-3", "3-1", "2-2"];
const formationLabels5 = ["1-2-2", "2-2-1", "2-1-2", "1-3-1", "3-1-1"];

const formationSlots = {
  "1-2-1": [
    { x: 50, y: 84 }, { x: 33, y: 55 }, { x: 67, y: 55 }, { x: 50, y: 23 },
  ],
  "2-1-1": [
    { x: 34, y: 77 }, { x: 66, y: 77 }, { x: 50, y: 50 }, { x: 50, y: 23 },
  ],
  "1-3": [
    { x: 50, y: 78 }, { x: 23, y: 36 }, { x: 50, y: 32 }, { x: 77, y: 36 },
  ],
  "3-1": [
    { x: 22, y: 76 }, { x: 50, y: 80 }, { x: 78, y: 76 }, { x: 50, y: 25 },
  ],
  "2-2": [
    { x: 34, y: 76 }, { x: 66, y: 76 }, { x: 34, y: 31 }, { x: 66, y: 31 },
  ],
  "1-2-2": [
    { x: 50, y: 85 }, { x: 29, y: 55 }, { x: 71, y: 55 }, { x: 29, y: 25 }, { x: 71, y: 25 },
  ],
  "2-2-1": [
    { x: 32, y: 76 }, { x: 68, y: 76 }, { x: 28, y: 47 }, { x: 72, y: 47 }, { x: 50, y: 20 },
  ],
  "2-1-2": [
    { x: 32, y: 78 }, { x: 68, y: 78 }, { x: 50, y: 52 }, { x: 32, y: 24 }, { x: 68, y: 24 },
  ],
  "1-3-1": [
    { x: 50, y: 82 }, { x: 24, y: 50 }, { x: 50, y: 48 }, { x: 76, y: 50 }, { x: 50, y: 20 },
  ],
  "3-1-1": [
    { x: 22, y: 72 }, { x: 50, y: 78 }, { x: 78, y: 72 }, { x: 50, y: 48 }, { x: 50, y: 20 },
  ],
};

function playerInitials(name = "") {
  return String(name).trim().split(/\s+/g).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "GG";
}

function positionCode(position = "") {
  const value = String(position || "").trim().toUpperCase();
  if (value.includes("GK")) return "GK";
  if (value.includes("CB")) return "CB";
  if (value.includes("CDM")) return "CDM";
  if (value.includes("CAM")) return "CAM";
  if (value.includes("ST")) return "ST";
  if (value.includes("CF")) return "CF";
  return value.split(/\s+/g)[0] || "—";
}

function statusLabel(status) {
  return {
    pendingMutualAgreement: "Waiting for all members",
    pendingName: "Ready for club name",
    pendingCaptainVoteSetup: "Captain vote setup",
    captainVote: "Captain vote",
    pendingAdminApproval: "Waiting for admin approval",
    rejected: "Formation rejected",
  }[status] || status;
}

export default function ClubsMode({ onReturnToMatchday, authUser, isAdmin = false }) {
  const [clubs, setClubs] = useState([]);
  const [players, setPlayers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [adminApplications, setAdminApplications] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminOverview, setAdminOverview] = useState(null);
  const [adminClubs, setAdminClubs] = useState([]);
  const [adminMatches, setAdminMatches] = useState([]);
  const [adminRejectReasons, setAdminRejectReasons] = useState({});
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formationLoading, setFormationLoading] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [nameSavingId, setNameSavingId] = useState(null);
  const [error, setError] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState(["", "", "", ""]);
  const [formation, setFormation] = useState("1-2-1");
  const [clubNameDrafts, setClubNameDrafts] = useState({});
  const [detailDrafts, setDetailDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [offerPlayer, setOfferPlayer] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerClub, setOfferClub] = useState("");
  const [activeSection, setActiveSection] = useState(isAdmin && !authUser?.playerProfile ? "adminDashboard" : "overview");
  const [ultimateSubsection, setUltimateSubsection] = useState("overview");
  const [myClubSubsection, setMyClubSubsection] = useState("squad");
  const [playersSubsection, setPlayersSubsection] = useState("directory");
  const [playerHistory, setPlayerHistory] = useState(null);
  const [clubMatches, setClubMatches] = useState([]);
  const [matchClubA, setMatchClubA] = useState("");
  const [matchClubB, setMatchClubB] = useState("");
  const [matchScheduledAt, setMatchScheduledAt] = useState("");
  const [matchSubmitting, setMatchSubmitting] = useState(false);
  const [clubStats, setClubStats] = useState([]);
  const [clubHistory, setClubHistory] = useState([]);
  const [playerAttributes, setPlayerAttributes] = useState({});
  const [auctionState, setAuctionState] = useState(null);
  const [auctionLoading, setAuctionLoading] = useState(false);
  const [joinDecisionReason, setJoinDecisionReason] = useState({});
  const [renewalState, setRenewalState] = useState(null);
  const [retainedPlayers, setRetainedPlayers] = useState([]);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [reviewCandidates, setReviewCandidates] = useState([]);
  const [reviewForm, setReviewForm] = useState({ candidateKey: "", stars: 5, observation: "" });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [matchMarkets, setMatchMarkets] = useState({});
  const [betDrafts, setBetDrafts] = useState({});
  const [announcement, setAnnouncement] = useState("");

  const announce = message => {
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(message), 20);
  };

  useEffect(() => {
    let active = true;
    const adminOnlyView = Boolean(isAdmin && !authUser?.playerProfile);

    const requests = adminOnlyView
      ? [
          api("/clubs/meta"),
          api("/clubs/admin/overview"),
          api("/clubs/admin/clubs"),
          api("/clubs/admin/matches"),
          api("/clubs/admin/applications"),
        ]
      : [
          api("/clubs/meta"),
          api("/clubs"),
          api("/players"),
          api("/clubs/matches"),
          ...(authUser ? [api("/clubs/formation/me")] : []),
        ];

    Promise.all(requests)
      .then(results => {
        if (!active) return;

        setMeta(results[0]);

        if (adminOnlyView) {
          const overview = results[1] || {};
          setAdminOverview(overview);
          setAdminClubs(Array.isArray(results[2]) ? results[2] : []);
          setAdminMatches(Array.isArray(results[3]) ? results[3] : []);
          setAdminApplications(Array.isArray(results[4]) ? results[4] : []);
          setClubs(Array.isArray(results[2]) ? results[2].filter(club => club.status === "approved") : []);
          setClubMatches(Array.isArray(results[3]) ? results[3] : []);
          setPlayers([]);
          setApplications([]);
        } else {
          setClubs(Array.isArray(results[1]) ? results[1] : []);
          setPlayers(Array.isArray(results[2]) ? results[2] : []);
          setClubMatches(Array.isArray(results[3]) ? results[3] : []);
          setApplications(authUser && Array.isArray(results[4]) ? results[4] : []);

          if (authUser) {
            Promise.all([api("/clubs/wallet/me"), api("/clubs/join-requests/me")])
              .then(([walletData, joinData]) => {
                if (!active) return;
                setWallet(walletData);
                setJoinRequests(Array.isArray(joinData) ? joinData : []);
              })
              .catch(() => {});
          }
        }

        setError("");
      })
      .catch(requestError => {
        if (!active) return;
        setError(requestError.message || "Clubs could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authUser, isAdmin]);
  const refreshAdminApplications = async () => {
    if (!isAdmin) return;
    try {
      setAdminLoading(true);
      const data = await api("/clubs/admin/applications");
      setAdminApplications(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setAdminLoading(false);
    }
  };

  const respondToAdminApplication = async (applicationId, action) => {
    try {
      setBusyId("admin-" + applicationId);
      await api("/clubs/admin/applications/" + applicationId + "/" + action, {
        method: "POST",
        body: action === "reject"
          ? { reason: adminRejectReasons[applicationId] || "" }
          : undefined,
      });
      const [overviewData, clubData, matchData, applicationData] = await Promise.all([
        api("/clubs/admin/overview"),
        api("/clubs/admin/clubs"),
        api("/clubs/admin/matches"),
        api("/clubs/admin/applications"),
      ]);
      setAdminOverview(overviewData || null);
      setAdminClubs(Array.isArray(clubData) ? clubData : []);
      setAdminMatches(Array.isArray(matchData) ? matchData : []);
      setAdminApplications(Array.isArray(applicationData) ? applicationData : []);
      setClubs(Array.isArray(clubData) ? clubData.filter(club => club.status === "approved") : []);
      announce(action === "approve" ? "Club formation approved." : "Club formation rejected.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const refreshReviews = async () => {
    if (!authUser) return;
    try {
      setReviewLoading(true);
      const data = await api("/clubs/reviews/eligible/me");
      setReviewCandidates(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const submitReview = async event => {
    event.preventDefault();
    const candidate = reviewCandidates.find(item => item.playerId === reviewForm.candidateKey?.split(":")[0] && item.relationship === reviewForm.candidateKey?.split(":")[1]);
    if (!candidate) {
      setError("Choose an eligible teammate or opponent.");
      return;
    }
    try {
      setBusyId("review");
      await api("/clubs/reviews", {
        method: "POST",
        body: {
          reviewedPlayerId: candidate.playerId,
          relationship: candidate.relationship,
          stars: Number(reviewForm.stars),
          observation: reviewForm.observation,
        },
      });
      setReviewForm({ candidateKey: "", stars: 5, observation: "" });
      await refreshReviews();
      announce("Player review submitted.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const refreshMatchMarkets = async matches => {
    const accepted = (matches || []).filter(match => ["accepted", "completed"].includes(match.status));
    const entries = await Promise.all(accepted.map(async match => {
      try {
        const [prediction, bet] = await Promise.all([
          api("/clubs/matches/" + match._id + "/prediction/refresh", { method: "POST" }),
          authUser ? api("/clubs/matches/" + match._id + "/bets/me") : Promise.resolve(null),
        ]);
        return [String(match._id), { prediction, bet }];
      } catch {
        return [String(match._id), { prediction: match.prediction || null, bet: null }];
      }
    }));
    setMatchMarkets(Object.fromEntries(entries));
  };

  const placeBet = async match => {
    const draft = betDrafts[match._id] || {};
    if (!draft.clubId || !draft.stake) {
      setError("Choose a club and stake before placing your bet.");
      return;
    }
    try {
      setBusyId("bet-" + match._id);
      await api("/clubs/matches/" + match._id + "/bets", {
        method: "POST",
        body: { clubId: draft.clubId, stake: Number(draft.stake) },
      });
      const [bet, walletData] = await Promise.all([
        api("/clubs/matches/" + match._id + "/bets/me"),
        api("/clubs/wallet/me"),
      ]);
      setMatchMarkets(current => ({ ...current, [String(match._id)]: { ...(current[String(match._id)] || {}), bet } }));
      setWallet(walletData);
      setBetDrafts(current => ({ ...current, [match._id]: { clubId: "", stake: "" } }));
      announce("Bet placed successfully. Your Player Wallet has been updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const refreshClubMatches = async () => {
    const data = await api("/clubs/matches");
    const next = Array.isArray(data) ? data : [];
    setClubMatches(next);
    if (activeSection === "overview" && ultimateSubsection === "matches") await refreshMatchMarkets(next);
  };

  const refreshRenewalState = async clubId => {
    if (!clubId || !authUser) return;
    try {
      setRenewalLoading(true);
      const data = await api("/clubs/" + clubId + "/renewal");
      setRenewalState(data || null);
      if (!retainedPlayers.length && data?.club?.memberIds) {
        setRetainedPlayers(data.club.memberIds.slice(0, 2).map(String));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRenewalLoading(false);
    }
  };

  const submitRenewal = async () => {
    if (!currentClub?._id) {
      setError("Your Club is no longer active.");
      return;
    }
    setError("");
    try {
      setBusyId("renewal");
      await api("/clubs/" + currentClub._id + "/renewal", {
        method: "POST",
        body: { retainedPlayerIds: retainedPlayers },
      });
      await refreshRenewalState(currentClub._id);
      announce("Renewal decision submitted.");
      const clubsData = await api("/clubs");
      setClubs(Array.isArray(clubsData) ? clubsData : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const refreshAuctionState = async () => {
    if (!authUser) return;
    try {
      setAuctionLoading(true);
      const data = await api("/clubs/auction/me");
      setAuctionState(data || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setAuctionLoading(false);
    }
  };

  const chooseAuctionOffer = async offerId => {
    setError("");
    try {
      setBusyId("auction-" + offerId);
      await api("/clubs/auction/offers/" + offerId + "/choose", { method: "POST" });
      await refreshAuctionState();
      announce("Auction offer selected.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const respondToJoinRequest = async (requestId, accept) => {
    setError("");
    try {
      setBusyId("join-" + requestId);
      await api("/clubs/join-requests/" + requestId + "/respond", {
        method: "POST",
        body: { accept, reason: joinDecisionReason[requestId] || "" },
      });
      const data = await api("/clubs/join-requests/me");
      setJoinRequests(Array.isArray(data) ? data : []);
      const clubsData = await api("/clubs");
      setClubs(Array.isArray(clubsData) ? clubsData : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const approveAuctionOffer = async offerId => {
    setError("");
    try {
      setBusyId("auction-" + offerId);
      await api("/clubs/auction/offers/" + offerId + "/approve", { method: "POST" });
      const clubsData = await api("/clubs");
      setClubs(Array.isArray(clubsData) ? clubsData : []);
      await refreshAuctionState();
      announce("Signing approval recorded.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const sendJoinRequest = async clubId => {
    setError("");
    try {
      setBusyId(clubId);
      await api("/clubs/join-requests", { method: "POST", body: { clubId } });
      const data = await api("/clubs/join-requests/me");
      setJoinRequests(Array.isArray(data) ? data : []);
      announce("Join request sent.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const makeOffer = async event => {
    event.preventDefault();
    setError("");
    if (!offerClub || !offerPlayer || !offerAmount) {
      setError("Choose a club, player and offer amount.");
      return;
    }
    try {
      setBusyId("offer");
      await api("/clubs/auction/offers", {
        method: "POST",
        body: { clubId: offerClub, playerId: offerPlayer, amount: Number(offerAmount) },
      });
      setOfferPlayer("");
      setOfferAmount("");
      announce("Signing offer sent.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const requestClubMatch = async event => {
    event.preventDefault();
    setError("");
    if (!matchClubA || !matchClubB || !matchScheduledAt) {
      setError("Choose two clubs and a future match date.");
      return;
    }
    if (matchClubA === matchClubB) {
      setError("Choose two different clubs.");
      return;
    }
    try {
      setMatchSubmitting(true);
      await api("/clubs/matches", {
        method: "POST",
        body: { clubAId: matchClubA, clubBId: matchClubB, fixtureDate: matchScheduledAt },
      });
      setMatchClubB("");
      setMatchScheduledAt("");
      await refreshClubMatches();
      announce("Club Match request sent.");
    } catch (e) {
      setError(e.message);
    } finally {
      setMatchSubmitting(false);
    }
  };

  const respondToClubMatch = async (matchId, accept) => {
    setError("");
    try {
      setBusyId(matchId);
      await api("/clubs/matches/" + matchId + "/respond", { method: "POST", body: { accept } });
      await refreshClubMatches();
      announce(accept ? "Club Match request accepted." : "Club Match request declined.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const cancelClubMatch = async matchId => {
    setError("");
    try {
      setBusyId(matchId);
      await api("/clubs/matches/" + matchId + "/cancel", { method: "POST" });
      await refreshClubMatches();
      announce("Club Match request cancelled.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const clubName = clubId =>
    clubs.find(club => String(club._id) === String(clubId))?.name || "Unknown club";
  const adminOnlyView = Boolean(isAdmin && !authUser?.playerProfile);
  const currentPlayerId = authUser?.playerProfile ? String(authUser.playerProfile) : "";
  const currentClub =
    clubs.find(club => club.memberIds?.some(id => String(id) === currentPlayerId)) || null;
  const myCaptainClubs = clubs.filter(club =>
    club.memberIds?.some(id => String(id) === currentPlayerId) &&
    club.captainIds?.some(id => String(id) === currentPlayerId),
  );
  const incomingMatchRequests = useMemo(
    () => clubMatches.filter(match =>
      match.status === "requested" &&
      myCaptainClubs.some(club => String(club._id) === String(match.clubBId)),
    ),
    [clubMatches, myCaptainClubs],
  );
  const formations = currentClub?.memberIds?.length === 5
    ? (meta?.formations5?.length ? meta.formations5 : formationLabels5)
    : (meta?.formations4?.length ? meta.formations4 : formationLabels4);
  const safeFormation = formations.includes(formation) ? formation : formations[0];

  const currentClubMemberKey = (currentClub?.memberIds || []).map(String).join(",");

  useEffect(() => {
    let active = true;
    if (activeSection !== "myClub" || !currentClub?._id) {
      return undefined;
    }

    const memberIds = currentClubMemberKey.split(",").filter(Boolean);

    Promise.all([
      api("/clubs/" + currentClub._id + "/stats"),
      api("/clubs/" + currentClub._id + "/history"),
      ...memberIds.map(playerId =>
        api("/players/" + playerId + "/attributes").catch(() => null),
      ),
    ])
      .then(([statsData, historyData, ...attributeRows]) => {
        if (!active) return;
        setClubStats(Array.isArray(statsData?.stats) ? statsData.stats : []);
        setClubHistory(Array.isArray(historyData) ? historyData : []);
        const nextAttributes = {};
        memberIds.forEach((playerId, index) => {
          if (attributeRows[index]) nextAttributes[playerId] = attributeRows[index];
        });
        setPlayerAttributes(nextAttributes);
      })
      .catch(requestError => {
        if (active) setError(requestError.message || "Club details could not be loaded.");
      });

    return () => {
      active = false;
    };
  }, [activeSection, currentClub?._id, currentClubMemberKey]);


  const availablePlayers = useMemo(
    () => players.filter(player => String(player._id) !== currentPlayerId),
    [players, currentPlayerId],
  );

  const refreshApplications = async () => {
    if (!authUser) return;
    const data = await api("/clubs/formation/me");
    setApplications(Array.isArray(data) ? data : []);
  };

  const updatePlayerSelection = (slot, value) => {
    setSelectedPlayers(current =>
      current.map((item, index) => index === slot ? value : item),
    );
  };

  const startFormation = async event => {
    event.preventDefault();
    setError("");

    const ids = selectedPlayers.filter(Boolean);
    if (ids.length < 3 || ids.length > 4 || new Set(ids).size !== ids.length) {
      setError("Choose three or four different players to invite. That creates a 4- or 5-player Club.");
      return;
    }

    try {
      setFormationLoading(true);
      await api("/clubs/formation", {
        method: "POST",
        body: { playerIds: ids },
      });
      setSelectedPlayers(["", "", "", ""]);
      await refreshApplications();
      announce("Club formation invitation sent to the selected players.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setFormationLoading(false);
    }
  };

  const respondToFormation = async (applicationId, accept) => {
    setError("");

    try {
      setRespondingId(applicationId);
      await api("/clubs/formation/" + applicationId + "/respond", {
        method: "POST",
        body: { accept },
      });
      await refreshApplications();
      announce(accept ? "Club formation invitation accepted." : "Club formation invitation declined.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRespondingId(null);
    }
  };

  const startCaptainVote = async applicationId => { setError(""); try { setBusyId(applicationId); await api("/clubs/formation/" + applicationId + "/captain/setup", { method: "POST" }); await refreshApplications(); announce("Captain vote is ready."); } catch (e) { setError(e.message); } finally { setBusyId(null); } };

  const captainVote = async (applicationId, candidatePlayerId) => { setError(""); try { setBusyId(applicationId); await api("/clubs/formation/" + applicationId + "/captain/vote", { method: "POST", body: { candidatePlayerId } }); await refreshApplications(); announce("Captain vote recorded."); } catch (e) { setError(e.message); } finally { setBusyId(null); } };

  const submitDetails = async applicationId => { setError(""); try { setBusyId(applicationId); await api("/clubs/formation/" + applicationId + "/details", { method: "POST", body: { details: detailDrafts[applicationId] || "" } }); await refreshApplications(); announce("Club details approval recorded."); } catch (e) { setError(e.message); } finally { setBusyId(null); } };

  const proposeName = async applicationId => {
    const name = String(clubNameDrafts[applicationId] || "").trim();
    setError("");

    if (!name) {
      setError("Enter a club name first.");
      return;
    }

    try {
      setNameSavingId(applicationId);
      await api("/clubs/formation/" + applicationId + "/name", {
        method: "POST",
        body: { name },
      });
      await refreshApplications();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setNameSavingId(null);
    }
  };

  useEffect(() => {
    if (!isAdmin || activeSection !== "admin") return undefined;
    // Remote admin data is intentionally refreshed when the Admin section opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Section entry intentionally refreshes remote admin data.
    refreshAdminApplications();
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Section entry is the explicit refresh trigger.
  }, [isAdmin, activeSection]);

  useEffect(() => {
    if (activeSection !== "overview" || ultimateSubsection !== "matches") return undefined;
    let active = true;
    const refresh = async () => {
      const accepted = clubMatches.filter(match => ["accepted", "completed"].includes(match.status));
      const entries = await Promise.all(accepted.map(async match => {
        try {
          const [prediction, bet] = await Promise.all([
            api("/clubs/matches/" + match._id + "/prediction/refresh", { method: "POST" }),
            authUser ? api("/clubs/matches/" + match._id + "/bets/me") : Promise.resolve(null),
          ]);
          return [String(match._id), { prediction, bet }];
        } catch {
          return [String(match._id), { prediction: match.prediction || null, bet: null }];
        }
      }));
      if (active) setMatchMarkets(Object.fromEntries(entries));
    };
    refresh();
    return () => {
      active = false;
    };
  }, [activeSection, ultimateSubsection, clubMatches, authUser]);

  useEffect(() => {
    if (!authUser || activeSection !== "reviews") return undefined;
    let active = true;
    api("/clubs/reviews/eligible/me")
      .then(data => {
        if (active) setReviewCandidates(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [authUser, activeSection]);

  useEffect(() => {
    if (!authUser || activeSection !== "players" || playersSubsection !== "history") return undefined;
    let active = true;
    api("/clubs/player/" + authUser.playerProfile + "/history")
      .then(data => {
        if (active) setPlayerHistory(data || null);
      })
      .catch(e => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [authUser, activeSection, playersSubsection]);

  useEffect(() => {
    if (!authUser || activeSection !== "myClub" || myClubSubsection !== "auctions") return undefined;
    let active = true;
    api("/clubs/auction/me")
      .then(data => {
        if (active) setAuctionState(data || null);
      })
      .catch(e => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [authUser, activeSection, myClubSubsection]);

  useEffect(() => {
    if (!authUser || activeSection !== "myClub" || myClubSubsection !== "squad" || !currentClub?._id) return undefined;
    let active = true;
    api("/clubs/" + currentClub._id + "/renewal")
      .then(data => {
        if (!active) return;
        setRenewalState(data || null);
        if (retainedPlayers.length === 0 && data?.club?.memberIds) {
          setRetainedPlayers(data.club.memberIds.slice(0, 2).map(String));
        }
      })
      .catch(e => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [authUser, activeSection, myClubSubsection, currentClub?._id, retainedPlayers.length]);

  const clubOvrValues = (currentClub?.memberIds || [])
    .map(id => Number(playerAttributes[String(id)]?.currentOvr ?? playerAttributes[String(id)]?.ovr))
    .filter(Number.isFinite);
  const squadHasCompleteOvr =
    Boolean(currentClub?.memberIds?.length) &&
    currentClub.memberIds.length >= 4 &&
    currentClub.memberIds.length <= 5 &&
    clubOvrValues.length === currentClub.memberIds.length;
  const clubOvr = squadHasCompleteOvr
    ? Math.round(clubOvrValues.reduce((sum, value) => sum + value, 0) / clubOvrValues.length)
    : null;

  return (
    <main className="clubs-app">
      <header className="clubs-topbar">
        <div>
          <p className="clubs-eyebrow">GG MATCHDAY / CLUBS</p>
          <h1>Ultimate Clubs</h1>
          <p className="clubs-subtitle">
            Your Club world — squad identity, player market, matchday economy and competitive history.
          </p>
        </div>
        <button type="button" className="clubs-return-button" onClick={onReturnToMatchday}>
          ← Matchday
        </button>
      </header>

      {adminOnlyView ? (
        <nav className="clubs-nav" aria-label="Clubs admin navigation">
          <button aria-current={activeSection === "adminDashboard" ? "page" : undefined} className={activeSection === "adminDashboard" ? "active" : ""} type="button" onClick={() => setActiveSection("adminDashboard")}>Dashboard</button>
          <button aria-current={activeSection === "adminApplications" ? "page" : undefined} className={activeSection === "adminApplications" ? "active" : ""} type="button" onClick={() => setActiveSection("adminApplications")}>
            Applications{adminApplications.length > 0 && <span className="clubs-nav-badge">{adminApplications.length}</span>}
          </button>
          <button aria-current={activeSection === "adminClubs" ? "page" : undefined} className={activeSection === "adminClubs" ? "active" : ""} type="button" onClick={() => setActiveSection("adminClubs")}>Clubs</button>
          <button aria-current={activeSection === "adminMatches" ? "page" : undefined} className={activeSection === "adminMatches" ? "active" : ""} type="button" onClick={() => setActiveSection("adminMatches")}>Matches</button>
        </nav>
      ) : (
        <nav className="clubs-nav" aria-label="Clubs navigation">
          <button aria-current={activeSection === "overview" ? "page" : undefined} className={activeSection === "overview" ? "active" : ""} type="button" onClick={() => { setActiveSection("overview"); setUltimateSubsection("overview"); }}>Ultimate Clubs</button>
          <button aria-current={activeSection === "myClub" ? "page" : undefined} className={activeSection === "myClub" ? "active" : ""} type="button" onClick={() => { setActiveSection("myClub"); setMyClubSubsection("squad"); }}>My Club</button>
          <button aria-current={activeSection === "players" ? "page" : undefined} className={activeSection === "players" ? "active" : ""} type="button" onClick={() => setActiveSection("players")}>Players</button>
          <button aria-current={activeSection === "reviews" ? "page" : undefined} className={activeSection === "reviews" ? "active" : ""} type="button" onClick={() => setActiveSection("reviews")}>Reviews</button>
          {isAdmin && <button aria-current={activeSection === "admin" ? "page" : undefined} className={activeSection === "admin" ? "active" : ""} type="button" onClick={() => setActiveSection("admin")}>Admin</button>}
        </nav>
      )}

      {error && <div className="clubs-error" role="alert">{error}</div>}
      <div className="clubs-screen-reader-status" aria-live="polite" aria-atomic="true">{announcement}</div>

      {activeSection === "overview" && ultimateSubsection === "overview" ? (
        <>
      <div className="clubs-section-tabs" role="tablist" aria-label="Ultimate Clubs sections"><button type="button" role="tab" aria-selected={ultimateSubsection === "overview"} className={ultimateSubsection === "overview" ? "active" : ""} onClick={() => setUltimateSubsection("overview")}>Overview</button><button type="button" role="tab" aria-selected={ultimateSubsection === "matches"} className={ultimateSubsection === "matches" ? "active" : ""} onClick={() => setUltimateSubsection("matches")}>Matches{incomingMatchRequests.length > 0 && <span className="clubs-nav-badge">{incomingMatchRequests.length}</span>}</button></div>
      {ultimateSubsection === "overview" && <section className="clubs-hero">
        <div>
          <p className="clubs-eyebrow">THE CLUBS WORLD</p>
          <h2>Build your football world.</h2>
          <p>
            Form a 4–5 player Club, discover squads, sign players, schedule Club Matches and build a permanent history. Your football performance still comes from the normal GG Match Record.
          </p>
        </div>
        <div className="clubs-balance-card">
          <span>NEW CLUB BALANCE</span>
          <strong>{meta?.clubStartingBalance ?? 3000}</strong>
          <small>starting credits</small>
        </div>
      </section>}

      {authUser && (
        <section className="clubs-section">
          <div className="clubs-section-heading"><div><p className="clubs-eyebrow">CLUBS WALLET</p><h2>Your Clubs balance</h2></div></div>
          <div className="clubs-empty">
            <strong>{wallet?.wallet?.balance ?? 0} credits</strong>
            <span>Signing payments and individual club rewards are tracked separately from Matchday GG ratings.</span>
          </div>
        </section>
      )}

      {authUser && clubs.length > 0 && (
        <section className="clubs-section">
          <div className="clubs-section-heading"><div><p className="clubs-eyebrow">JOIN A CLUB</p><h2>Available clubs</h2></div><span>{clubs.length}</span></div>
          <div className="clubs-application-list">
            {clubs.map(club => {
              const isMember = club.memberIds?.some(id => String(id) === currentPlayerId);
              const full = (club.memberIds?.length || 0) >= 5;
              return <article className="clubs-application" key={club._id}>
                <div><p className="clubs-eyebrow">OFFICIAL CLUB</p><h3>{club.name}</h3><span>{club.memberIds?.length || 0}/5 players · {club.balance} credits</span></div>
                {!isMember && !full && <button type="button" className="clubs-primary-button" disabled={busyId === club._id} onClick={() => sendJoinRequest(club._id)}>{busyId === club._id ? "Sending…" : "Request to Join"}</button>}
                {isMember && <span>Current club</span>}
                {full && !isMember && <span>Squad full</span>}
              </article>;
            })}
          </div>
        </section>
      )}

      {authUser && joinRequests.some(request => request.clubId) && (
        <section className="clubs-section">
          <div className="clubs-section-heading">
            <div><p className="clubs-eyebrow">CLUB REQUESTS</p><h2>Join requests</h2></div>
            <span>{joinRequests.length}</span>
          </div>
          <div className="clubs-application-list">
            {joinRequests.map(request => {
              const requester = players.find(player => String(player._id) === String(request.playerId));
              const club = clubs.find(item => String(item._id) === String(request.clubId));
              const isCaptain = club?.captainIds?.some(id => String(id) === currentPlayerId);
              return (
                <article className="clubs-application" key={request._id}>
                  <div>
                    <p className="clubs-eyebrow">{isCaptain ? "CAPTAIN ACTION" : "YOUR REQUEST"}</p>
                    <h3>{requester?.name || "Player"} · {club?.name || "Club"}</h3>
                    <span>{isCaptain ? "Player wants to join your club." : request.status}</span>
                  </div>
                  {isCaptain && request.status === "pending" && (
                    <div className="clubs-application-actions">
                      <input
                        value={joinDecisionReason[request._id] || ""}
                        onChange={event => setJoinDecisionReason(current => ({ ...current, [request._id]: event.target.value }))}
                        placeholder="Optional rejection reason"
                        maxLength={500}
                      />
                      <button type="button" className="clubs-primary-button" disabled={busyId === "join-" + request._id} onClick={() => respondToJoinRequest(request._id, true)}>Approve</button>
                      <button type="button" className="clubs-secondary-button" disabled={busyId === "join-" + request._id} onClick={() => respondToJoinRequest(request._id, false)}>Reject</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {authUser && (
        <section className="clubs-section">
          <div className="clubs-section-heading"><div><p className="clubs-eyebrow">SIGNING MARKET</p><h2>Make a player offer</h2></div></div>
          <form className="clubs-create-form" onSubmit={makeOffer}>
            <div className="clubs-invite-grid">
              <label><span>YOUR CLUB</span><select value={offerClub} onChange={e => setOfferClub(e.target.value)}><option value="">Choose club</option>{clubs.filter(c => c.memberIds?.some(id => String(id) === currentPlayerId) && c.captainIds?.some(id => String(id) === currentPlayerId)).map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
              <label><span>PLAYER</span><select value={offerPlayer} onChange={e => setOfferPlayer(e.target.value)}><option value="">Choose player</option>{players.filter(p => String(p._id) !== currentPlayerId).map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></label>
              <label><span>OFFER</span><input type="number" min="25" step="5" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} placeholder="Min 25 · +5" /></label>
            </div>
            <button className="clubs-primary-button" type="submit" disabled={busyId === "offer"}>{busyId === "offer" ? "Sending…" : "Send Signing Offer"}</button>
          </form>
        </section>
      )}

      {authUser ? (
        <section className="clubs-section">
          <div className="clubs-section-heading">
            <div>
              <p className="clubs-eyebrow">FORM A CLUB</p>
              <h2>Build a 4–5 player Club</h2>
            </div>
            <span>4 minimum · 5 maximum</span>
          </div>

          <form className="clubs-create-form" onSubmit={startFormation}>
            <div className="clubs-invite-grid">
              {[0, 1, 2, 3].map(index => (
                <label key={index}>
                  <span>PLAYER {index + 2}{index === 3 ? " · OPTIONAL" : ""}</span>
                  <select
                    value={selectedPlayers[index]}
                    onChange={event => updatePlayerSelection(index, event.target.value)}
                  >
                    <option value="">{index === 3 ? "No fifth player" : "Choose a player"}</option>
                    {availablePlayers.map(player => (
                      <option
                        key={player._id}
                        value={player._id}
                        disabled={selectedPlayers.some(
                          (id, selectedIndex) =>
                            selectedIndex !== index && id === player._id,
                        )}
                      >
                        {player.name}{player.position ? " · " + player.position : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="clubs-create-actions clubs-create-actions--single">
              <div className="clubs-create-note">
                <strong>Four is the minimum. Five is the maximum.</strong>
                <span>Pick three required players for a 4-player Club, or add a fourth invitee to form a 5-player Club. Everyone in the final squad must accept.</span>
              </div>
              <button type="submit" className="clubs-primary-button" disabled={formationLoading}>
                {formationLoading ? "Sending invites…" : "Start Club Formation"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="clubs-section clubs-signin-note">
          <strong>Sign in to form or join a club.</strong>
          <span>Clubs membership actions require a linked GG player profile.</span>
        </section>
      )}

      {authUser && (
        <section className="clubs-section">
          <div className="clubs-section-heading">
            <div>
              <p className="clubs-eyebrow">FORMATION PIPELINE</p>
              <h2>Your club invitations</h2>
            </div>
            <span>{applications.length}</span>
          </div>

          {applications.length === 0 ? (
            <div className="clubs-empty">
              <strong>No active formation applications.</strong>
              <span>Start a club above or wait for another player to invite you.</span>
            </div>
          ) : (
            <div className="clubs-application-list">
              {applications.map(application => {
                const membership = application.memberApprovals?.find(
                  item => String(item.playerId) === currentPlayerId,
                );
                const canRespond =
                  application.status === "pendingMutualAgreement" &&
                  membership?.status === "pending" &&
                  String(application.founderPlayerId) !== currentPlayerId;
                const canName =
                  application.status === "pendingName" &&
                  application.memberApprovals?.every(item => item.status === "accepted");

                return (
                  <article className="clubs-application" key={application._id}>
                    <div>
                      <p className="clubs-eyebrow">{statusLabel(application.status)}</p>
                      <h3>{application.proposedName || "Unnamed club"}</h3>
                      <span>{application.memberIds?.length || 0}/5 members · {application.memberIds?.length === 5 ? "five-player squad" : "four-player squad"}</span>
                      {application.rejectionReason && (
                        <small className="clubs-rejection">{application.rejectionReason}</small>
                      )}
                    </div>

                    {canRespond && (
                      <div className="clubs-application-actions">
                        <button
                          type="button"
                          className="clubs-primary-button"
                          disabled={respondingId === application._id}
                          onClick={() => respondToFormation(application._id, true)}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="clubs-secondary-button"
                          disabled={respondingId === application._id}
                          onClick={() => respondToFormation(application._id, false)}
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    {canName && (
                      <div className="clubs-name-proposal">
                        <input value={clubNameDrafts[application._id] || ""} onChange={event => setClubNameDrafts(current => ({ ...current, [application._id]: event.target.value }))} placeholder="Propose the permanent club name" maxLength={80} />
                        <button type="button" className="clubs-primary-button" disabled={nameSavingId === application._id} onClick={() => proposeName(application._id)}>
                          {nameSavingId === application._id ? "Saving…" : "Propose Name"}
                        </button>
                      </div>
                    )}
                    {application.status === "pendingCaptainVoteSetup" && (
                      <button type="button" className="clubs-primary-button" disabled={busyId === application._id} onClick={() => startCaptainVote(application._id)}>Start Captain Vote</button>
                    )}
                    {application.status === "captainVote" && (
                      <div className="clubs-application-actions">
                        {(application.captainCandidates || []).map(candidate => (
                          <button key={candidate} type="button" className="clubs-primary-button" disabled={busyId === application._id || application.captainVotes?.some(v => String(v.voterPlayerId) === currentPlayerId)} onClick={() => captainVote(application._id, candidate)}>
                            Vote {candidate === currentPlayerId ? "for yourself" : candidate.slice(-6)}
                          </button>
                        ))}
                      </div>
                    )}
                    {application.status === "pendingAdminApproval" && (
                      <div className="clubs-name-proposal">
                        <input value={detailDrafts[application._id] || ""} onChange={event => setDetailDrafts(current => ({ ...current, [application._id]: event.target.value }))} placeholder="Club details / identity" maxLength={500} />
                        <button type="button" className="clubs-primary-button" disabled={busyId === application._id} onClick={() => submitDetails(application._id)}>Approve Details</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="clubs-section">
        <div className="clubs-section-heading">
          <div>
            <p className="clubs-eyebrow">OFFICIAL CLUBS</p>
            <h2>Clubs</h2>
          </div>
          <span>{clubs.length}</span>
        </div>

        {loading ? (
          <div className="clubs-empty">Opening Clubs database…</div>
        ) : clubs.length === 0 ? (
          <div className="clubs-empty">
            <strong>No official clubs yet.</strong>
            <span>Approved 4–5 player Clubs will appear here after approval.</span>
          </div>
        ) : (
          <div className="clubs-grid">
            {clubs.map(club => (
              <article className="club-card" key={club._id}>
                <div className="club-card-mark">GG</div>
                <div>
                  <p className="clubs-eyebrow">OFFICIAL CLUB</p>
                  <h3>{club.name}</h3>
                  <span>{club.memberIds?.length || 0}/5 players · viewer formations in My Club</span>
                </div>
                <strong>{club.balance ?? 3000}</strong>
              </article>
            ))}
          </div>
        )}
      </section>

        </>
      ) : activeSection === "overview" && ultimateSubsection === "matches" ? (
      <>
      <div className="clubs-section-tabs" role="tablist" aria-label="Ultimate Clubs sections">
        <button type="button" role="tab" aria-selected={ultimateSubsection === "overview"} className={ultimateSubsection === "overview" ? "active" : ""} onClick={() => setUltimateSubsection("overview")}>Overview</button>
        <button type="button" role="tab" aria-selected={ultimateSubsection === "matches"} className={ultimateSubsection === "matches" ? "active" : ""} onClick={() => setUltimateSubsection("matches")}>Matches{incomingMatchRequests.length > 0 && <span className="clubs-nav-badge">{incomingMatchRequests.length}</span>}</button>
      </div>
      <section className="clubs-section clubs-matches-panel">
        <div className="clubs-section-heading"><div><p className="clubs-eyebrow">CLUB MATCHES</p><h2>Schedule & fixtures</h2></div><span>{clubMatches.length} recorded</span></div>
        {authUser && myCaptainClubs.length > 0 && (
          <form className="clubs-create-form clubs-match-form" onSubmit={requestClubMatch}>
            <div className="clubs-invite-grid">
              <label><span>YOUR CLUB</span><select value={matchClubA} onChange={event => setMatchClubA(event.target.value)}>
                <option value="">Choose your club</option>
                {myCaptainClubs.map(club => <option key={club._id} value={club._id}>{club.name}</option>)}
              </select></label>
              <label><span>OPPONENT CLUB</span><select value={matchClubB} onChange={event => setMatchClubB(event.target.value)}>
                <option value="">Choose opponent</option>
                {clubs.filter(club => String(club._id) !== String(matchClubA)).map(club => <option key={club._id} value={club._id}>{club.name}</option>)}
              </select></label>
              <label><span>MATCH DATE</span><input type="date" value={matchScheduledAt} onChange={event => setMatchScheduledAt(event.target.value)} /></label>
            </div>
            <button type="submit" className="clubs-primary-button" disabled={matchSubmitting}>{matchSubmitting ? "Sending request…" : "Request Club Match"}</button>
          </form>
        )}
        {authUser && myCaptainClubs.length === 0 && <div className="clubs-empty clubs-match-note"><strong>You need an approved club captain role to request a fixture.</strong><span>Incoming club-match requests will still appear below.</span></div>}
        {clubMatches.length === 0 ? (
          <div className="clubs-empty"><strong>No club fixtures yet.</strong><span>Accepted fixtures remain linked to the normal GG Match Record when played.</span></div>
        ) : (
          <div className="clubs-application-list clubs-match-list">
            {clubMatches.map(match => {
              const isReceivingClub = myCaptainClubs.some(club => String(club._id) === String(match.clubBId));
              const isRequestingClub = myCaptainClubs.some(club => String(club._id) === String(match.requestedByClubId));
              const hasCaptainResponse = match.status === "requested" && match.captainResponses?.length > 0;
              return (
                <article className="clubs-application clubs-match-card" key={match._id}>
                  <div>
                    <p className="clubs-eyebrow">{match.status}</p>
                    <h3>{clubName(match.clubAId)} <span className="clubs-match-vs">vs</span> {clubName(match.clubBId)}</h3>
                    <span>{new Date(match.scheduledAt).toLocaleDateString()} · {match.status === "completed" ? String(match.clubAScore) + "–" + String(match.clubBScore) : match.status === "accepted" ? "Accepted · waiting for Matchday record" : "Awaiting response"}</span>
                    {match.status === "requested" && isReceivingClub && (
  <div className="clubs-incoming-request" role="status">
    <strong>INCOMING MATCH REQUEST</strong>
    <small>{hasCaptainResponse ? "One captain has already responded. All required captain approvals must be complete." : "Your Club has been invited. Review the time above, then Accept or Decline."}</small>
  </div>
)}
                  </div>
                  <div className="clubs-application-actions">
                    {match.status === "requested" && isReceivingClub && <>
                      <button type="button" className="clubs-primary-button" disabled={busyId === match._id} onClick={() => respondToClubMatch(match._id, true)}>Accept</button>
                      <button type="button" className="clubs-secondary-button" disabled={busyId === match._id} onClick={() => respondToClubMatch(match._id, false)}>Decline</button>
                    </>}
                    {["requested", "accepted"].includes(match.status) && isRequestingClub && <button type="button" className="clubs-secondary-button" disabled={busyId === match._id} onClick={() => cancelClubMatch(match._id)}>Cancel request</button>}
                    {match.status === "completed" && <span className="clubs-match-linked">Linked to Matchday</span>}
                    {["accepted", "completed"].includes(match.status) && (
                      <div className="clubs-match-market">
                        <div className="clubs-prediction">
                          <span>PREDICTION</span>
                          <strong>{matchMarkets[String(match._id)]?.prediction?.clubAPercent ?? match.prediction?.clubAPercent ?? "—"}% — {matchMarkets[String(match._id)]?.prediction?.clubBPercent ?? match.prediction?.clubBPercent ?? "—"}%</strong>
                          <small>{clubName(match.clubAId)} · {clubName(match.clubBId)}</small>
                        </div>
                        {match.status === "accepted" &&
                        authUser &&
                        !matchMarkets[String(match._id)]?.bet &&
                        !(currentClub && [String(match.clubAId), String(match.clubBId)].includes(String(currentClub._id))) && (
                          <div className="clubs-bet-form">
                            <select
                              value={betDrafts[match._id]?.clubId || ""}
                              onChange={event => setBetDrafts(current => ({ ...current, [match._id]: { ...(current[match._id] || {}), clubId: event.target.value } }))}
                            >
                              <option value="">Choose club</option>
                              {[match.clubAId, match.clubBId].map(id => <option key={String(id)} value={id}>{clubName(id)}</option>)}
                            </select>
                            <input
                              type="number"
                              min="10"
                              max="100"
                              step="1"
                              placeholder="10–100"
                              value={betDrafts[match._id]?.stake || ""}
                              onChange={event => setBetDrafts(current => ({ ...current, [match._id]: { ...(current[match._id] || {}), stake: event.target.value } }))}
                            />
                            <button type="button" className="clubs-primary-button" disabled={busyId === "bet-" + match._id} onClick={() => placeBet(match)}>
                              {busyId === "bet-" + match._id ? "Placing…" : "Place Bet"}
                            </button>
                          </div>
                        )}
                        {matchMarkets[String(match._id)]?.bet && (
                          <small className="clubs-match-bet-status">Your bet: {matchMarkets[String(match._id)].bet.stake} credits on {clubName(matchMarkets[String(match._id)].bet.clubId)} · {matchMarkets[String(match._id)].bet.status}</small>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      </>
      ) : activeSection === "players" ? (
        <>
        <section className="clubs-section">
          <div className="clubs-section-heading">
            <div><p className="clubs-eyebrow">PLAYERS</p><h2>{playersSubsection === "history" ? "Player History" : "Player discovery"}</h2></div>
            <div className="clubs-subnav" role="tablist" aria-label="Players sections">
              <button type="button" role="tab" aria-selected={playersSubsection === "directory"} className={playersSubsection === "directory" ? "active" : ""} onClick={() => setPlayersSubsection("directory")}>Discovery</button>
              <button type="button" role="tab" aria-selected={playersSubsection === "history"} className={playersSubsection === "history" ? "active" : ""} onClick={() => setPlayersSubsection("history")}>Player History</button>
            </div>
          </div>
          {playersSubsection === "directory" ? (
            <div className="clubs-application-list">
              {players.map(player => <article className="clubs-application" key={player._id}><div><p className="clubs-eyebrow">{player.position || "PLAYER"}</p><h3>{player.name}</h3><span>{player.jerseyNumber ? "#" + player.jerseyNumber + " · " : ""}Open to Club approaches</span></div></article>)}
            </div>
          ) : !authUser ? (
            <div className="clubs-empty">Sign in to view your Player History.</div>
          ) : !playerHistory ? (
            <div className="clubs-empty">No Club career data is available yet.</div>
          ) : (
            <div className="clubs-player-history">
              <div className="clubs-history-summary-grid">
                {[["Clubs",playerHistory.careerSummary?.clubCount],["Matches",playerHistory.careerSummary?.matches],["W-D-L",(playerHistory.careerSummary?.wins||0)+"–"+(playerHistory.careerSummary?.draws||0)+"–"+(playerHistory.careerSummary?.losses||0)],["Goals",playerHistory.careerSummary?.goals],["Assists",playerHistory.careerSummary?.assists],["MOTM",playerHistory.careerSummary?.motm],["Avg Rating",playerHistory.careerSummary?.averageRating ?? "—"],["Club Earnings",playerHistory.privacy?.privateEarningsVisible ? (playerHistory.careerSummary?.earnings ?? 0)+" cr" : "Private"]].map(([label,value])=><div className="clubs-history-stat" key={label}><strong>{value ?? 0}</strong><span>{label}</span></div>)}
              </div>
              {(playerHistory.tenures || []).map(tenure => (
                <article className="clubs-history-tenure" key={tenure.clubId + ":" + tenure.joinedAt}>
                  <div className="clubs-history-tenure-head"><div><p className="clubs-eyebrow">{tenure.current ? "CURRENT CLUB" : "FORMER CLUB"}</p><h3>{tenure.clubName}</h3><span>{new Date(tenure.joinedAt).toLocaleDateString()} → {tenure.current ? "Present" : new Date(tenure.leftAt).toLocaleDateString()} · {tenure.totalTimeLabel}</span></div><strong>{tenure.contribution.matches} matches</strong></div>
                  <div className="clubs-history-metrics">
                    {[["W-D-L",tenure.contribution.wins+"–"+tenure.contribution.draws+"–"+tenure.contribution.losses],["WIN RATE",tenure.contribution.winRate+"%"],["GOALS",tenure.contribution.goals],["ASSISTS",tenure.contribution.assists],["MOTM",tenure.contribution.motm],["AVG GG RATING",tenure.contribution.averageRating ?? "—"],["RATED MATCHES",tenure.contribution.ratedMatches],["CLEAN SHEETS",tenure.contribution.cleanSheets],["AVG DEF RATING",tenure.contribution.averageDefensiveRating ?? "—"]].map(([label,value])=><span key={label}><b>{value}</b><small>{label}</small></span>)}
                  </div>
                  <div className="clubs-history-bottom">
                    <div><p className="clubs-eyebrow">CLUB EARNINGS</p><strong>{playerHistory.privacy?.privateEarningsVisible ? tenure.earnings.total+" credits" : "Private"}</strong><span>{tenure.earnings.signingPayment} signing · {tenure.earnings.matchRewards} match · {tenure.earnings.motmRewards} MOTM · {tenure.earnings.cleanSheetRewards} clean sheet · {tenure.earnings.competitionRewards} competition</span></div>
                    <div><p className="clubs-eyebrow">ACHIEVEMENTS</p><span>{tenure.contribution.achievements.length ? tenure.contribution.achievements.map(item => item.description || item.type).join(" · ") : "No player-specific achievements recorded."}</span></div>
                  </div>
                </article>
              ))}
              <div className="clubs-subsection"><div className="clubs-section-heading"><div><p className="clubs-eyebrow">CAREER TIMELINE</p><h3>Club career events</h3></div><span>{playerHistory.timeline?.length || 0}</span></div>{(playerHistory.timeline || []).slice(0,30).map(event=><div className="clubs-history-row" key={event.id}><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleDateString()}</time><div><strong>{event.clubName}</strong><span>{event.description}</span></div></div>)}</div>
            </div>
          )}
        </section>
        </>
      ) : activeSection === "myClub" && myClubSubsection === "auctions" ? (
        <>
        <div className="clubs-section-tabs" role="tablist" aria-label="My Club sections">
          <button type="button" role="tab" aria-selected={myClubSubsection === "squad"} className={myClubSubsection === "squad" ? "active" : ""} onClick={() => setMyClubSubsection("squad")}>Squad & History</button>
          <button type="button" role="tab" aria-selected={myClubSubsection === "auctions"} className={myClubSubsection === "auctions" ? "active" : ""} onClick={() => setMyClubSubsection("auctions")}>Auctions</button>
        </div>
        <section className="clubs-section">
          <div className="clubs-section-heading"><div><p className="clubs-eyebrow">AUCTION DESK</p><h2>Your signing activity</h2></div><span>{auctionLoading ? "Loading…" : ""}</span></div>
          {!authUser ? <div className="clubs-empty">Sign in to view your signing activity.</div> : auctionLoading ? <div className="clubs-empty">Loading auction activity…</div> : (
            <>
              <section className="clubs-subsection">
                <div className="clubs-section-heading"><div><p className="clubs-eyebrow">YOUR OFFERS</p><h3>Offers made to you</h3></div><span>{auctionState?.ownOffers?.length || 0}</span></div>
                {(auctionState?.ownOffers || []).length === 0 ? <div className="clubs-empty">No active signing offers for you.</div> : (
                  <div className="clubs-application-list">
                    {auctionState.ownOffers.map(offer => (
                      <article className="clubs-application" key={offer._id}>
                        <div><p className="clubs-eyebrow">{offer.status}</p><h3>{offer.amount} credits</h3><span>{clubName(offer.clubId)} · {offer.status === "active" ? "Your decision is required" : "Offer selected"}</span></div>
                        {offer.status === "active" && <button type="button" className="clubs-primary-button" disabled={busyId === "auction-" + offer._id} onClick={() => chooseAuctionOffer(offer._id)}>Choose this club</button>}
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <section className="clubs-subsection">
                <div className="clubs-section-heading"><div><p className="clubs-eyebrow">CAPTAIN APPROVALS</p><h3>Players who chose your club</h3></div><span>{auctionState?.incomingOffers?.length || 0}</span></div>
                {(auctionState?.incomingOffers || []).length === 0 ? <div className="clubs-empty">No player-selected offers are waiting for captain approval.</div> : (
                  <div className="clubs-application-list">
                    {auctionState.incomingOffers.map(offer => {
                      const player = auctionState.offeredPlayers?.find(item => String(item._id) === String(offer.playerId));
                      const club = auctionState.captainClubs?.find(item => String(item._id) === String(offer.clubId));
                      const approved = (offer.captainApprovalIds || []).some(id => String(id) === currentPlayerId);
                      return <article className="clubs-application" key={offer._id}>
                        <div><p className="clubs-eyebrow">{player?.position || "PLAYER"}</p><h3>{player?.name || "Player"} · {offer.amount} credits</h3><span>{club?.name || clubName(offer.clubId)} · {approved ? "Your approval recorded" : "Captain approval needed"}</span></div>
                        {!approved && <button type="button" className="clubs-primary-button" disabled={busyId === "auction-" + offer._id} onClick={() => approveAuctionOffer(offer._id)}>Approve signing</button>}
                      </article>;
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </section>
        </>
      ) : adminOnlyView && activeSection === "adminDashboard" ? (
        <section className="clubs-section">
          <div className="clubs-section-heading">
            <div><p className="clubs-eyebrow">CLUBS CONTROL CENTER</p><h2>Administration dashboard</h2><span>Manage approvals, monitor every Club, and track Club Match synchronization.</span></div>
            <button type="button" className="clubs-secondary-button" onClick={async () => {
              try {
                const [overviewData, clubData, matchData, applicationData] = await Promise.all([
                  api("/clubs/admin/overview"), api("/clubs/admin/clubs"), api("/clubs/admin/matches"), api("/clubs/admin/applications"),
                ]);
                setAdminOverview(overviewData || null);
                setAdminClubs(Array.isArray(clubData) ? clubData : []);
                setAdminMatches(Array.isArray(matchData) ? matchData : []);
                setAdminApplications(Array.isArray(applicationData) ? applicationData : []);
              } catch (e) { setError(e.message); }
            }}>Refresh</button>
          </div>
          <div className="clubs-history-summary-grid">
            {[
              ["Active Clubs", adminOverview?.counts?.activeClubs ?? 0],
              ["Pending Approvals", adminOverview?.counts?.pendingApplications ?? 0],
              ["Active Players", adminOverview?.counts?.activeMembers ?? 0],
              ["Club Matches", adminOverview?.counts?.upcomingMatches ?? 0],
              ["Completed", adminOverview?.counts?.completedMatches ?? 0],
              ["Archived Clubs", adminOverview?.counts?.archivedClubs ?? 0],
            ].map(([label, value]) => <div className="clubs-history-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}
          </div>
          <section className="clubs-subsection">
            <div className="clubs-section-heading"><div><p className="clubs-eyebrow">LATEST CLUBS</p><h3>Recently changed Clubs</h3></div><span>{adminOverview?.recentClubs?.length || 0}</span></div>
            <div className="clubs-application-list">
              {(adminOverview?.recentClubs || []).map(club => (
                <article className="clubs-application" key={String(club._id)}>
                  <div><p className="clubs-eyebrow">{String(club.status || "").toUpperCase()}</p><h3>{club.name}</h3><span>{club.memberIds?.length || 0}/5 members · {club.captainIds?.length || 0} captain(s) · {club.balance ?? 0} credits</span></div>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : adminOnlyView && activeSection === "adminApplications" ? (
        <section className="clubs-section">
          <div className="clubs-section-heading">
            <div><p className="clubs-eyebrow">PERMISSIONS</p><h2>Club formation approvals</h2></div>
            <span>{adminLoading ? "Loading…" : adminApplications.length + " pending"}</span>
          </div>
          {adminApplications.length === 0 ? (
            <div className="clubs-empty">No Club formations are waiting for admin action.</div>
          ) : (
            <div className="clubs-application-list">
              {adminApplications.map(application => (
                <article className="clubs-application" key={application._id}>
                  <div>
                    <p className="clubs-eyebrow">{statusLabel(application.status)}</p>
                    <h3>{application.proposedName || "Unnamed Club"}</h3>
                    <span>{application.memberCount || application.memberIds?.length || 0}/5 members · every member has completed the mutual-agreement stage</span>
                    <div className="clubs-history-metrics">
                      {(application.members || []).map(member => <span key={String(member?._id)}><b>{member?.name || "Player"}</b><small>OVR {member?.ovr ?? "—"}{member?.isCaptain ? " · CAPTAIN" : ""}</small></span>)}
                    </div>
                    <small>Captain candidates: {(application.captainCandidates || []).map(id => String(id).slice(-6)).join(" · ") || "Not set"} · Elected: {(application.electedCaptainIds || []).map(id => String(id).slice(-6)).join(" · ") || "Not elected"}</small>
                  </div>
                  <div className="clubs-application-actions">
                    <button type="button" className="clubs-primary-button" disabled={busyId === "admin-" + application._id} onClick={() => respondToAdminApplication(application._id, "approve")}>Approve</button>
                    <input
                      value={adminRejectReasons[application._id] || ""}
                      onChange={event => setAdminRejectReasons(current => ({ ...current, [application._id]: event.target.value }))}
                      placeholder="Reason required to reject"
                      maxLength={500}
                      aria-label={"Rejection reason for " + (application.proposedName || "Club application")}
                    />
                    <button type="button" className="clubs-secondary-button" disabled={busyId === "admin-" + application._id || !(adminRejectReasons[application._id] || "").trim()} onClick={() => respondToAdminApplication(application._id, "reject")}>Reject</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : adminOnlyView && activeSection === "adminClubs" ? (
        <section className="clubs-section">
          <div className="clubs-section-heading"><div><p className="clubs-eyebrow">CLUB DIRECTORY</p><h2>Every Club formed</h2></div><span>{adminClubs.length}</span></div>
          {adminClubs.length === 0 ? <div className="clubs-empty">No Club records exist yet.</div> : (
            <div className="clubs-grid">
              {adminClubs.map(club => (
                <article className="club-card" key={String(club._id)}>
                  <div className="club-card-mark">GG</div>
                  <div>
                    <p className="clubs-eyebrow">{String(club.status || "").toUpperCase()}</p>
                    <h3>{club.name}</h3>
                    <span>{club.memberCount || club.memberIds?.length || 0}/5 members · {club.captainCount || club.captainIds?.length || 0} captain(s) · squad OVR {club.squadOvr ?? "—"}</span>
                    <div className="clubs-roster-premium">
                      {(club.members || []).map(member => <span key={String(member?._id)}>{member?.name || "Player"} · {member?.ovr ?? "—"}{member?.isCaptain ? " ★" : ""}</span>)}
                    </div>
                  </div>
                  <strong>{club.balance ?? 0}</strong>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : adminOnlyView && activeSection === "adminMatches" ? (
        <section className="clubs-section">
          <div className="clubs-section-heading"><div><p className="clubs-eyebrow">MATCHDAY OVERSIGHT</p><h2>Club Matches</h2><span>Track scheduled fixtures and their Matchday linkage.</span></div><span>{adminMatches.length}</span></div>
          {adminMatches.length === 0 ? <div className="clubs-empty">No Club Matches recorded yet.</div> : (
            <div className="clubs-application-list">
              {adminMatches.map(match => (
                <article className="clubs-application clubs-match-card" key={String(match._id)}>
                  <div>
                    <p className="clubs-eyebrow">{String(match.status || "").toUpperCase()} · {String(match.source || "booked").toUpperCase()}</p>
                    <h3>{match.clubAId?.name || "Club"} <span className="clubs-match-vs">vs</span> {match.clubBId?.name || "Club"}</h3>
                    <span>{match.fixtureDate || new Date(match.scheduledAt).toLocaleDateString()} · {match.mainMatchId ? "Linked to Matchday" : "Awaiting Matchday record"}</span>
                  </div>
                  <strong>{match.status === "completed" ? String(match.clubAScore ?? 0) + "–" + String(match.clubBScore ?? 0) : "—"}</strong>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : activeSection === "admin" ? (
        <section className="clubs-section">
          <div className="clubs-empty">Use the new Clubs Control Center for administration.</div>
        </section>
      ) : activeSection === "reviews" ? (
        <section className="clubs-section">
          <div className="clubs-section-heading">
            <div><p className="clubs-eyebrow">PLAYER REVIEWS</p><h2>Review players you actually played with or against</h2></div>
            <span>{reviewLoading ? "Loading…" : reviewCandidates.length}</span>
          </div>
          {!authUser ? (
            <div className="clubs-empty">Sign in to write player reviews.</div>
          ) : reviewLoading ? (
            <div className="clubs-empty">Loading eligible players…</div>
          ) : reviewCandidates.length === 0 ? (
            <div className="clubs-empty">No eligible reviews right now. Complete a Club Match with another player first.</div>
          ) : (
            <form className="clubs-review-form" onSubmit={submitReview}>
              <label>
                Player
                <select value={reviewForm.candidateKey} onChange={event => setReviewForm(current => ({ ...current, candidateKey: event.target.value }))} required>
                  <option value="">Choose a player</option>
                  {reviewCandidates.map(candidate => (
                    <option key={candidate.playerId + ":" + candidate.relationship} value={candidate.playerId + ":" + candidate.relationship}>
                      {candidate.player?.name || "Player"} · {candidate.relationship} · {candidate.matchCount} match{candidate.matchCount === 1 ? "" : "es"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Stars
                <select value={reviewForm.stars} onChange={event => setReviewForm(current => ({ ...current, stars: Number(event.target.value) }))}>
                  {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{"★".repeat(value)} ({value}/5)</option>)}
                </select>
              </label>
              <label>
                Observation
                <textarea value={reviewForm.observation} onChange={event => setReviewForm(current => ({ ...current, observation: event.target.value }))} maxLength={1000} rows={5} placeholder="Write a useful observation about their play." required />
              </label>
              <button type="submit" className="clubs-primary-button" disabled={busyId === "review"}>{busyId === "review" ? "Submitting…" : "Submit review"}</button>
            </form>
          )}
        </section>
      ) : activeSection === "myClub" && myClubSubsection === "squad" ? (
        <>
        <div className="clubs-section-tabs" role="tablist" aria-label="My Club sections"><button type="button" role="tab" aria-selected={myClubSubsection === "squad"} className={myClubSubsection === "squad" ? "active" : ""} onClick={() => setMyClubSubsection("squad")}>Squad & History</button><button type="button" role="tab" aria-selected={myClubSubsection === "auctions"} className={myClubSubsection === "auctions" ? "active" : ""} onClick={() => setMyClubSubsection("auctions")}>Auctions</button></div>
      <section className="clubs-section clubs-my-club-panel">
          {!currentClub ? (
            <div className="clubs-empty clubs-empty--hero">
              <span className="clubs-empty-icon">⚽</span>
              <strong>You are not currently under a Club contract.</strong>
              <span>Your previous Club history remains preserved. Explore the Clubs world to form a squad or join an existing Club.</span>
              <button type="button" className="clubs-primary-button" onClick={() => setActiveSection("overview")}>Explore Clubs</button>
            </div>
          ) : (
            <>
              <header className="clubs-command-header">
                <div className="clubs-command-title">
                  <p className="clubs-eyebrow">MY CLUB / SQUAD HQ</p>
                  <div className="clubs-title-row">
                    <div className="clubs-club-crest" aria-hidden="true">GG</div>
                    <div>
                      <h2>{currentClub.name}</h2>
                      <span>{currentClub.memberIds?.length || 0}/5 players · {currentClub.captainIds?.length || 0} captain(s)</span>
                    </div>
                  </div>
                </div>
                <div className="clubs-command-balance">
                  <span>CLUB BALANCE</span>
                  <strong>{currentClub.balance ?? 0}</strong>
                  <small>credits</small>
                </div>
              </header>

              <div className="clubs-command-grid">
                <section className="clubs-squad-panel">
                  <div className="clubs-squad-panel-head">
                    <div>
                      <p className="clubs-eyebrow">SQUAD VIEW</p>
                      <h3>Your {currentClub.memberIds?.length === 5 ? "five-player" : "four-player"} field</h3>
                    </div>
                    <span>{squadHasCompleteOvr ? "Squad OVR ready" : "OVR developing…"}</span>
                  </div>

                  <div className="clubs-pitch-wrap">
                    <div className="clubs-pitch">
                      <div className="clubs-pitch-mark clubs-pitch-mark--half"></div>
                      <div className="clubs-pitch-mark clubs-pitch-mark--box clubs-pitch-mark--top"></div>
                      <div className="clubs-pitch-mark clubs-pitch-mark--box clubs-pitch-mark--bottom"></div>
                      <div className="clubs-pitch-circle"></div>
                      <div className="clubs-pitch-dot clubs-pitch-dot--top"></div>
                      <div className="clubs-pitch-dot clubs-pitch-dot--bottom"></div>

                      {(currentClub.memberIds || []).map((playerId, index) => {
                        const player = players.find(item => String(item._id) === String(playerId));
                        const attribute = playerAttributes[String(playerId)];
                        const slot = (formationSlots[safeFormation] || formationSlots["1-2-1"])[index];
                        const stats = attribute?.attributes || {};
                        const statItems = [
                          ["PAC", stats.pace],
                          ["SHO", stats.shooting],
                          ["PAS", stats.passing],
                          ["DRI", stats.dribbling],
                          ["DEF", stats.defending],
                          ["PHY", stats.physical],
                        ];
                        return (
                          <article
                            className="clubs-field-card"
                            role="group"
                            aria-label={"Player card: " + (player?.name || "Club player") + ", OVR " + (attribute?.ovr ?? "not available")}
                            key={String(playerId)}
                            style={{
                              "--slot-x": slot?.x + "%",
                              "--slot-y": slot?.y + "%",
                              "--card-index": index,
                            }}
                            title={player?.name || "Club player"}
                          >
                            <span className="clubs-field-card-glow" aria-hidden="true"></span>
                            <span className="clubs-field-card-topline">
                              <strong>{attribute?.currentOvr ?? attribute?.ovr ?? "—"}</strong>
                              {attribute?.confidence != null && (
                                <span
                                  className="clubs-field-card-confidence"
                                  title={`OVR confidence: ${attribute.confidence}%. Based on ${attribute.matchesPlayed || 0} recorded matches.`}
                                  aria-label={`OVR confidence ${attribute.confidence} percent`}
                                >
                                  ⓘ
                                </span>
                              )}
                              <span>{positionCode(player?.position)}</span>
                            </span>
                            <span className="clubs-field-card-face">
                              {player?.profileImage ? (
                                <img src={player.profileImage} alt="" />
                              ) : (
                                <span>{playerInitials(player?.name)}</span>
                              )}
                            </span>
                            <span className="clubs-field-card-name">{player?.name || "Club player"}</span>
                            <span className="clubs-field-card-meta">
                              {player?.jerseyNumber != null ? "#" + player.jerseyNumber : "GG Player"}
                            </span>
                            <span className="clubs-field-card-stats">
                              {statItems.map(([label, value]) => (
                                <span key={label}><b>{value == null ? "—" : Math.round(value)}</b><small>{label}</small></span>
                              ))}
                            </span>
                          </article>
                        );
                      })}
                    </div>

                    <div className="clubs-formation-control" aria-label="Squad formation view">
                      <div>
                        <span>VIEW FORMATION</span>
                        <strong>{safeFormation}</strong>
                      </div>
                      <div className="clubs-formation-pills">
                        {formations.map(value => (
                          <button
                            type="button"
                            key={value}
                            className={safeFormation === value ? "active" : ""}
                            onClick={() => setFormation(value)}
                            aria-pressed={safeFormation === value}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <aside className="clubs-squad-rail">
                  <div className="clubs-squad-panel-head">
                    <div>
                      <p className="clubs-eyebrow">PLAYER IDENTITY</p>
                      <h3>Squad cards</h3>
                    </div>
                    <span>{currentClub.memberIds?.length || 0}</span>
                  </div>
                  <div className="clubs-roster-premium">
                    {(currentClub.memberIds || []).map(playerId => {
                      const player = players.find(item => String(item._id) === String(playerId));
                      const attribute = playerAttributes[String(playerId)];
                      const stat = clubStats.find(item => String(item.playerId?._id || item.playerId) === String(playerId));
                      const average = stat?.ratedMatches ? (Number(stat.ratingTotal) / Number(stat.ratedMatches)).toFixed(2) : "—";
                      const captain = currentClub.captainIds?.some(id => String(id) === String(playerId));
                      return (
                        <article className="clubs-roster-premium-row" key={String(playerId)} data-captain={captain ? "true" : "false"}>
                          <div className="clubs-roster-avatar">
                            {player?.profileImage ? <img src={player.profileImage} alt="" /> : playerInitials(player?.name)}
                          </div>
                          <div className="clubs-roster-primary">
                            <strong>{player?.name || "Club player"}</strong>
                            <span>{positionCode(player?.position)} {captain ? "· CAPTAIN" : "· PLAYER"}</span>
                          </div>
                          <div className="clubs-roster-ovr">
                            <strong>{attribute?.currentOvr ?? attribute?.ovr ?? "—"}</strong>
                            <span>OVR</span>
                          </div>
                          <div className="clubs-roster-rating">
                            <strong>{average}</strong>
                            <span>AVG</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="clubs-squad-stat-strip">
                    <div><strong>{clubOvr ?? "—"}</strong><span>TEAM OVR</span></div>
                    <div><strong>{clubStats.reduce((sum, row) => sum + Number(row.matches || 0), 0)}</strong><span>MATCHES</span></div>
                    <div><strong>{clubStats.reduce((sum, row) => sum + Number(row.goals || 0), 0)}</strong><span>GOALS</span></div>
                    <div><strong>{clubStats.reduce((sum, row) => sum + Number(row.motm || 0), 0)}</strong><span>MOTM</span></div>
                  </div>
                </aside>
              </div>

              <div className="clubs-myclub-lower-grid">
                <section className="clubs-subsection clubs-renewal-panel">
                  <div className="clubs-section-heading">
                    <div><p className="clubs-eyebrow">CONTRACT CONTROL</p><h3>Renewal room</h3></div>
                    <span>{renewalLoading ? "Loading…" : renewalState?.boundaryAt ? new Date(renewalState.boundaryAt).toLocaleDateString() : "—"}</span>
                  </div>
                  {renewalLoading ? (
                    <div className="clubs-empty">Loading renewal state…</div>
                  ) : !renewalState?.boundaryAt ? (
                    <div className="clubs-empty">No active renewal boundary is available.</div>
                  ) : (
                    <>
                      <div className="clubs-renewal-copy">
                        <strong>{renewalState.isCaptain ? "Captain control" : "Squad view"}</strong>
                        <span>Captains jointly decide who is retained at the contract boundary.</span>
                      </div>
                      <div className="clubs-renewal-list">
                        {(currentClub.memberIds || []).map(playerId => {
                          const player = players.find(item => String(item._id) === String(playerId));
                          const retained = retainedPlayers.includes(String(playerId));
                          return (
                            <article className="clubs-renewal-row" key={String(playerId)}>
                              <span>{playerInitials(player?.name)}</span>
                              <div><strong>{player?.name || "Club player"}</strong><small>{retained ? "Selected to retain" : "Selected for release if captains agree"}</small></div>
                              {renewalState.isCaptain && (
                                <button
                                  type="button"
                                  className={retained ? "clubs-primary-button is-retained" : "clubs-secondary-button"}
                                  onClick={() => setRetainedPlayers(current => retained ? current.filter(id => id !== String(playerId)) : current.length < 2 ? [...current, String(playerId)] : current)}
                                >
                                  {retained ? "Retain" : "Select"}
                                </button>
                              )}
                            </article>
                          );
                        })}
                      </div>
                      {renewalState.isCaptain && (
                        <div className="clubs-renewal-action">
                          <span>Retaining fewer than 2 dissolves the Club at the boundary.</span>
                          <button type="button" className="clubs-primary-button" disabled={busyId === "renewal"} onClick={submitRenewal}>
                            {busyId === "renewal" ? "Submitting…" : "Submit Renewal Decision"}
                          </button>
                        </div>
                      )}
                      {renewalState.decision && (
                        <div className="clubs-empty">
                          <strong>{renewalState.decision.status === "applied" ? "Renewal applied." : "Renewal decision recorded."}</strong>
                          <span>Captain approvals: {renewalState.decision.captainApprovalIds?.length || 0}/{currentClub.captainIds?.length || 0}</span>
                        </div>
                      )}
                    </>
                  )}
                </section>

                <section className="clubs-subsection">
                  <div className="clubs-section-heading">
                    <div><p className="clubs-eyebrow">PERMANENT HISTORY</p><h3>Club timeline</h3></div>
                    <span>{clubHistory.length} events</span>
                  </div>
                  {clubHistory.length === 0 ? (
                    <div className="clubs-empty">No Club history events recorded yet.</div>
                  ) : (
                    <div className="clubs-history-list">
                      {clubHistory.map(event => (
                        <article className="clubs-history-row" key={String(event._id)}>
                          <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
                          <div><strong>{event.eventType}</strong><span>{event.description || "Club history event recorded."}</span></div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </section>
        </>
      ) : null}
      <footer className="clubs-footer">
        <span>Made by</span>
        <strong>Jeswin</strong>
      </footer>
    </main>
  );
}
