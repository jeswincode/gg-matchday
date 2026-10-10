import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import "./clubs-mode.css";

const formationLabels4 = ["1-2-1", "2-1-1", "1-3", "3-1", "2-2"];
const formationLabels5 = ["1-2-2", "2-2-1", "2-1-2", "1-3-1", "3-1-1"];

const formationSteps = [
  ["pendingMutualAgreement", "Players selected"],
  ["pendingMutualAgreement", "All members accepted"],
  ["pendingName", "Club name"],
  ["captainVote", "Captain election"],
  ["pendingCaptainDetailsApproval", "Club details"],
  ["pendingAdminApproval", "Admin approval"],
];

function formationProgress(status) {
  if (status === "rejected") return 0;
  if (status === "approved") return formationSteps.length;
  const order = {
    pendingMutualAgreement: 1,
    pendingName: 3,
    pendingCaptainVoteSetup: 4,
    captainVote: 4,
    pendingCaptainDetailsApproval: 5,
    pendingAdminApproval: 6,
  };
  return order[status] || 1;
}

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
    pendingCaptainDetailsApproval: "Waiting for captain details approval",
    pendingAdminApproval: "Waiting for admin approval",
    approved: "Club approved",
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
  const [showFormationForm, setShowFormationForm] = useState(false);
  const [showClubGuide, setShowClubGuide] = useState(false);
  const swipeStartRef = useRef(null);
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
  const [activeSection, setActiveSection] = useState(() => {
    if (isAdmin && !authUser?.playerProfile) return "adminDashboard";
    try {
      const focus = localStorage.getItem("gg-clubs-focus");
      return ["overview", "myClub", "players", "reviews"].includes(focus) ? focus : "overview";
    } catch {
      return "overview";
    }
  });
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
  const [clubWallet, setClubWallet] = useState(null);
  const [clubHistory, setClubHistory] = useState([]);
  const [playerAttributes, setPlayerAttributes] = useState({});
  const [auctionState, setAuctionState] = useState(null);
  const [auctionLoading, setAuctionLoading] = useState(false);
  const [joinDecisionReason, setJoinDecisionReason] = useState({});
  const [renewalState, setRenewalState] = useState(null);
  const [retainedPlayers, setRetainedPlayers] = useState(null);
  const [renewalDraftClubId, setRenewalDraftClubId] = useState(null);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [reviewCandidates, setReviewCandidates] = useState([]);
  const [reviewForm, setReviewForm] = useState({ candidateKey: "", stars: 5, observation: "" });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [matchMarkets, setMatchMarkets] = useState({});
  const [betDrafts, setBetDrafts] = useState({});
  const [announcement, setAnnouncement] = useState("");
  const [commandCenter, setCommandCenter] = useState(null);
  const [commandCenterLoading, setCommandCenterLoading] = useState(false);
  const [receivedReviews, setReceivedReviews] = useState([]);
  const [clubDiscovery, setClubDiscovery] = useState([]);
  const [adminAttentionDetail, setAdminAttentionDetail] = useState(null);

  const announce = message => {
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(message), 20);
  };

  useEffect(() => {
    try {
      localStorage.removeItem("gg-clubs-focus");
    } catch {
      // Local storage is optional in restricted browser contexts.
    }
  }, []);

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

    Promise.allSettled(requests)
      .then(settled => {
        if (!active) return;

        const valueAt = index => settled[index]?.status === "fulfilled" ? settled[index].value : null;
        const failed = settled
          .map((result, index) => result.status === "rejected" ? index : -1)
          .filter(index => index >= 0);

        setMeta(valueAt(0));

        if (adminOnlyView) {
          const overview = valueAt(1) || {};
          setAdminOverview(overview);
          setAdminClubs(Array.isArray(valueAt(2)) ? valueAt(2) : []);
          setAdminMatches(Array.isArray(valueAt(3)) ? valueAt(3) : []);
          setAdminApplications(Array.isArray(valueAt(4)) ? valueAt(4) : []);
          setClubs(Array.isArray(valueAt(2)) ? valueAt(2).filter(club => club.status === "approved") : []);
          setClubMatches(Array.isArray(valueAt(3)) ? valueAt(3) : []);
          setPlayers([]);
          setApplications([]);

          const adminLabels = ["Clubs configuration", "Admin overview", "Club directory", "Club matches", "Applications"];
          const adminFailures = failed.map(index => adminLabels[index]).filter(Boolean);
          if (adminFailures.length) {
            setError("Couldn’t load " + adminFailures.join(", ").toLowerCase() + ". Use Refresh to retry.");
          } else {
            setError("");
          }
        } else {
          setClubs(Array.isArray(valueAt(1)) ? valueAt(1) : []);
          setPlayers(Array.isArray(valueAt(2)) ? valueAt(2) : []);
          setClubMatches(Array.isArray(valueAt(3)) ? valueAt(3) : []);
          setApplications(authUser && Array.isArray(valueAt(4)) ? valueAt(4) : []);

          const viewerLabels = ["Clubs configuration", "Club directory", "Players", "Club matches", "Formation status"];
          const criticalFailures = failed.filter(index => index === 0 || index === 1);
          if (criticalFailures.length) {
            const labels = criticalFailures.map(index => viewerLabels[index]).filter(Boolean);
            setError("Couldn’t load " + labels.join(" or ").toLowerCase() + ". Please refresh.");
          } else {
            // Formation/match data is supplemental. Do not block the whole UI
            // or flash a generic global error when one optional request fails.
            setError("");
          }

          if (authUser) {
            Promise.allSettled([api("/clubs/wallet/me"), api("/clubs/join-requests/me")])
              .then(([walletResult, joinResult]) => {
                if (!active) return;
                if (walletResult.status === "fulfilled") setWallet(walletResult.value);
                if (joinResult.status === "fulfilled") setJoinRequests(Array.isArray(joinResult.value) ? joinResult.value : []);
              });
          }
        }
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

  const refreshCommandCenter = async () => {
    if (!authUser?.playerProfile) {
      setCommandCenter(null);
      return null;
    }
    try {
      setCommandCenterLoading(true);
      const data = await api("/clubs/home");
      setCommandCenter(data || null);
      return data || null;
    } catch (e) {
      console.warn("Clubs command center refresh failed:", e.message);
      return null;
    } finally {
      setCommandCenterLoading(false);
    }
  };

  const openCommandAction = action => {
    if (!action) return;
    if (action.section === "myClub" && action.subsection === "auctions") {
      setActiveSection("market");
    } else if (action.section === "myClub") {
      setActiveSection("myClub");
      setMyClubSubsection("squad");
    } else if (action.subsection === "matches") {
      setActiveSection("overview");
      setUltimateSubsection("matches");
    } else {
      setActiveSection("overview");
      setUltimateSubsection("overview");
    }
    window.setTimeout(() => {
      const target = document.getElementById(
        action.type === "renewal"
          ? "clubs-renewal-room"
          : action.type === "auction-choose" || action.type === "auction-approve"
            ? "clubs-auction-desk"
            : action.type === "match-today" || action.type === "match-upcoming" || action.type === "match-respond"
              ? "clubs-match-center"
              : action.type === "join-request"
                ? "clubs-join-requests"
                : "clubs-formation-pipeline",
      );
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const refreshReviews = async () => {
    if (!authUser) return;
    try {
      setReviewLoading(true);
      const [eligible, received] = await Promise.all([
        api("/clubs/reviews/eligible/me"),
        api("/clubs/reviews/player/" + authUser.playerProfile),
      ]);
      setReviewCandidates(Array.isArray(eligible) ? eligible : []);
      setReceivedReviews(Array.isArray(received) ? received : []);
    } catch (e) {
      setError(e.message || "Couldn’t load your Club reviews.");
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
      if (data?.club?.memberIds && renewalDraftClubId !== String(data.club._id)) {
        setRetainedPlayers((data.decision?.retainedPlayerIds || data.club.memberIds).map(String));
        setRenewalDraftClubId(String(data.club._id));
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
      await refreshCommandCenter();
      announce("Renewal decision submitted.");
      const clubsData = await api("/clubs");
      setClubs(Array.isArray(clubsData) ? clubsData : []);
      await refreshCommandCenter();
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
      await refreshCommandCenter();
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
      await refreshCommandCenter();
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
      await refreshCommandCenter();
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
      await refreshCommandCenter();
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
      await refreshCommandCenter();
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
  const activeFormationApplication = applications.find(application => !["approved", "rejected"].includes(application.status)) || null;
  const currentClubMatches = currentClub
    ? clubMatches.filter(match => [String(match.clubAId), String(match.clubBId)].includes(String(currentClub._id)))
    : [];
  const nextClubMatch = currentClubMatches
    .filter(match => ["requested", "accepted"].includes(match.status))
    .sort((a, b) => new Date(a.scheduledAt || a.fixtureDate || 0) - new Date(b.scheduledAt || b.fixtureDate || 0))[0] || null;
  const completedClubMatches = currentClubMatches.filter(match => match.status === "completed");
  const playerCredits = Math.max(0, Number(wallet?.wallet?.balance ?? 0));
  const recentPlayerTransactions = Array.isArray(wallet?.transactions) ? wallet.transactions.slice(0, 3) : [];
  const clubTotalBudget = Math.max(0, Number(clubWallet?.club?.balance ?? currentClub?.balance ?? 0));
  const clubCommittedBudget = Math.max(0, Number(clubWallet?.club?.committedBalance ?? currentClub?.committedBalance ?? 0));
  const clubAvailableBudget = Math.max(0, clubTotalBudget - clubCommittedBudget);
  const clubReservedPercent = clubTotalBudget > 0
    ? Math.min(100, Math.round((clubCommittedBudget / clubTotalBudget) * 100))
    : 0;
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

  const primaryTabKeys = adminOnlyView
    ? ["adminDashboard", "adminApplications", "adminClubs", "adminMatches"]
    : ["overview", "myClub", "market", "matches", "players", "reviews", ...(isAdmin ? ["admin"] : [])];
  const activePrimaryTabKey = adminOnlyView
    ? activeSection
    : activeSection === "overview"
      ? ultimateSubsection === "matches" ? "matches" : "overview"
      : activeSection;
  const primaryTabLabels = {
    overview: "Club Hub", myClub: "My Club", market: "Market", matches: "Matches",
    players: "Players", reviews: "Reviews", admin: "Admin",
    adminDashboard: "Dashboard", adminApplications: "Applications", adminClubs: "Clubs", adminMatches: "Matches",
  };
  const navigatePrimaryTab = key => {
    if (adminOnlyView) {
      setActiveSection(key);
      return;
    }
    if (key === "overview") {
      setActiveSection("overview");
      setUltimateSubsection("overview");
    } else if (key === "matches") {
      setActiveSection("overview");
      setUltimateSubsection("matches");
    } else if (key === "myClub") {
      setActiveSection("myClub");
      setMyClubSubsection("squad");
    } else {
      setActiveSection(key);
    }
    announce("Opened " + (primaryTabLabels[key] || "Club") + ".");
  };
  const handleClubsTouchStart = event => {
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    if (target?.closest?.("input, textarea, select, button, a, [contenteditable='true'], [data-no-tab-swipe], .clubs-nav, .clubs-section-tabs, .clubs-subnav")) {
      swipeStartRef.current = null;
      return;
    }
    const touch = event.changedTouches?.[0];
    swipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const handleClubsTouchEnd = event => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    const currentIndex = primaryTabKeys.indexOf(activePrimaryTabKey);
    if (currentIndex < 0) return;
    const nextIndex = dx < 0 ? Math.min(primaryTabKeys.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
    if (nextIndex !== currentIndex) navigatePrimaryTab(primaryTabKeys[nextIndex]);
  };
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
      api("/clubs/" + currentClub._id + "/wallet"),
      ...memberIds.map(playerId =>
        api("/players/" + playerId + "/attributes").catch(() => null),
      ),
    ])
      .then(([statsData, historyData, clubWalletData, ...attributeRows]) => {
        if (!active) return;
        setClubWallet(clubWalletData || null);
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
      await refreshCommandCenter();
      announce(accept ? "Club formation invitation accepted." : "Club formation invitation declined.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRespondingId(null);
    }
  };

  const startCaptainVote = async applicationId => { setError(""); try { setBusyId(applicationId); await api("/clubs/formation/" + applicationId + "/captain/setup", { method: "POST" }); await refreshApplications(); await refreshCommandCenter(); announce("Captain vote is ready."); } catch (e) { setError(e.message); } finally { setBusyId(null); } };

  const captainVote = async (applicationId, candidatePlayerId) => { setError(""); try { setBusyId(applicationId); await api("/clubs/formation/" + applicationId + "/captain/vote", { method: "POST", body: { candidatePlayerId } }); await refreshApplications(); await refreshCommandCenter(); announce("Captain vote recorded."); } catch (e) { setError(e.message); } finally { setBusyId(null); } };

  const submitDetails = async (applicationId, savedDetails = "") => {
    const details = String(detailDrafts[applicationId] ?? savedDetails ?? "").trim();
    if (!details) {
      setError("Add the Club details before approving them.");
      return;
    }
    setError("");
    try {
      setBusyId(applicationId);
      await api("/clubs/formation/" + applicationId + "/details", {
        method: "POST",
        body: { details },
      });
      await refreshApplications();
      announce("Club details approval recorded.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

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
      await refreshCommandCenter();
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
    if (!authUser?.playerProfile) return undefined;

    let active = true;
    const timer = window.setTimeout(async () => {
      if (!active) return;
      setCommandCenterLoading(true);
      try {
        const data = await api("/clubs/home");
        if (active) setCommandCenter(data || null);
      } catch (error) {
        console.warn("Clubs command center refresh failed:", error?.message || error);
      } finally {
        if (active) setCommandCenterLoading(false);
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser || activeSection !== "reviews") return undefined;
    let active = true;
    api("/clubs/reviews/eligible/me")
      .then(data => {
        if (active) setReviewCandidates(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        if (active) setError(e.message || "Couldn’t load your Club reviews.");
      });
    return () => {
      active = false;
    };
  }, [authUser, activeSection]);

  useEffect(() => {
    if (!authUser || activeSection !== "players" || playersSubsection !== "directory") return undefined;
    let active = true;
    api("/clubs/players/discovery")
      .then(data => {
        if (active) setClubDiscovery(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        if (active) setError(e.message || "Couldn’t load player discovery. Please retry.");
      });
    return () => {
      active = false;
    };
  }, [authUser, activeSection, playersSubsection]);

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
    if (!authUser || activeSection !== "market") return undefined;
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
  }, [authUser, activeSection]);

  useEffect(() => {
    if (!authUser || activeSection !== "myClub" || myClubSubsection !== "squad" || !currentClub?._id) return undefined;
    let active = true;
    api("/clubs/" + currentClub._id + "/renewal")
      .then(data => {
        if (!active) return;
        setRenewalState(data || null);
        if (data?.club?.memberIds && renewalDraftClubId !== String(data.club._id)) {
          setRetainedPlayers((data.decision?.retainedPlayerIds || data.club.memberIds).map(String));
          setRenewalDraftClubId(String(data.club._id));
        }
      })
      .catch(e => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [authUser, activeSection, myClubSubsection, currentClub?._id, renewalDraftClubId]);

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

  useEffect(() => {
    const activeTab = document.querySelector('.clubs-nav [data-primary-tab="' + activePrimaryTabKey + '"]');
    activeTab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activePrimaryTabKey]);

  return (
    <main className="clubs-app" onTouchStart={handleClubsTouchStart} onTouchEnd={handleClubsTouchEnd} onTouchCancel={() => { swipeStartRef.current = null; }}>
      <header className="clubs-topbar">
        <div>
          <p className="clubs-eyebrow">GG MATCHDAY / ULTIMATE CLUBS</p>
          <h1>{adminOnlyView ? "Clubs Admin" : "Club Hub"}</h1>
          <p className="clubs-subtitle">
            {adminOnlyView
              ? "Approvals, Club operations and matchday oversight."
              : "Explore, form and manage your football world."}
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
        <>
          <nav className="clubs-nav" aria-label="Clubs navigation">
            <button data-primary-tab="overview" aria-current={activeSection === "overview" && ultimateSubsection === "overview" ? "page" : undefined} className={activeSection === "overview" && ultimateSubsection === "overview" ? "active" : ""} type="button" onClick={() => navigatePrimaryTab("overview")}>Club Hub</button>
            <button data-primary-tab="myClub" aria-current={activeSection === "myClub" ? "page" : undefined} className={activeSection === "myClub" ? "active" : ""} type="button" onClick={() => navigatePrimaryTab("myClub")}>My Club</button>
            <button data-primary-tab="market" aria-current={activeSection === "market" ? "page" : undefined} className={activeSection === "market" ? "active" : ""} type="button" onClick={() => navigatePrimaryTab("market")}>Market</button>
            <button data-primary-tab="matches" aria-current={activeSection === "overview" && ultimateSubsection === "matches" ? "page" : undefined} className={activeSection === "overview" && ultimateSubsection === "matches" ? "active" : ""} type="button" onClick={() => navigatePrimaryTab("matches")}>Matches{incomingMatchRequests.length > 0 && <span className="clubs-nav-badge">{incomingMatchRequests.length}</span>}</button>
            <button data-primary-tab="players" aria-current={activeSection === "players" ? "page" : undefined} className={activeSection === "players" ? "active" : ""} type="button" onClick={() => navigatePrimaryTab("players")}>Players</button>
            <button data-primary-tab="reviews" aria-current={activeSection === "reviews" ? "page" : undefined} className={activeSection === "reviews" ? "active" : ""} type="button" onClick={() => navigatePrimaryTab("reviews")}>Reviews</button>
            {isAdmin && <button data-primary-tab="admin" aria-current={activeSection === "admin" ? "page" : undefined} className={activeSection === "admin" ? "active" : ""} type="button" onClick={() => navigatePrimaryTab("admin")}>Admin</button>}
          </nav>
          <p className="clubs-swipe-hint" aria-hidden="true">Swipe left or right to switch tabs</p>
        </>
      )}

      {error && <div className="clubs-error" role="alert">{error}</div>}
      <div className="clubs-screen-reader-status" aria-live="polite" aria-atomic="true">{announcement}</div>

      {activeSection === "overview" && ultimateSubsection === "overview" ? (
        <>
      {authUser && (
        <section id="clubs-formation-pipeline" className="clubs-section clubs-hub-pipeline">
          <div className="clubs-section-heading">
            <div>
              <p className="clubs-eyebrow">FORMATION PIPELINE</p>
              <h2>Your formation progress</h2>
            </div>
            <div className="clubs-hub-pipeline-actions">
              <span>{applications.filter(application => !["approved", "rejected"].includes(application.status)).length} active</span>
              <button type="button" className="clubs-primary-button" onClick={() => {
                setShowFormationForm(true);
                window.setTimeout(() => document.getElementById("clubs-formation-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
              }}>＋ Form a Club</button>
            </div>
          </div>

          {applications.length === 0 ? (
            <div className="clubs-empty">
              <strong>No active formation applications.</strong>
              <span>Use Form a Club to invite a squad, or wait for an incoming invitation. Your next action appears here.</span>
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
                const isElectedCaptain = application.electedCaptainIds?.some(
                  id => String(id) === currentPlayerId,
                );
                const hasApprovedDetails = application.detailsApprovedBy?.some(
                  id => String(id) === currentPlayerId,
                );
                const detailsAreComplete = Boolean(String(application.details || "").trim()) &&
                  (application.electedCaptainIds || []).length > 0 &&
                  application.electedCaptainIds.every(id =>
                    application.detailsApprovedBy?.some(approved => String(approved) === String(id)),
                  );
                const canApproveDetails =
                  application.status === "pendingCaptainDetailsApproval" &&
                  isElectedCaptain &&
                  !hasApprovedDetails;
                const waitingForCaptainDetails =
                  application.status === "pendingCaptainDetailsApproval" &&
                  !isElectedCaptain;
                const waitingForCoCaptain =
                  application.status === "pendingCaptainDetailsApproval" &&
                  isElectedCaptain &&
                  hasApprovedDetails;
                const legacyDetailsStage =
                  application.status === "pendingAdminApproval" &&
                  !detailsAreComplete &&
                  isElectedCaptain &&
                  !hasApprovedDetails;

                return (
                  <article className="clubs-application" key={application._id}>
                    <div className="clubs-formation-application-body">
                      <p className="clubs-eyebrow">{statusLabel(application.status)}</p>
                      <h3>{application.proposedName || "Unnamed club"}</h3>
                      <span>{application.memberIds?.length || 0}/5 members · {application.memberIds?.length === 5 ? "five-player squad" : "four-player squad"}</span>
                      <div className="clubs-formation-stepper" aria-label={"Formation progress: step " + formationProgress(application.status) + " of " + formationSteps.length}>
                        {formationSteps.map(([stepStatus, label], index) => {
                          const step = index + 1;
                          const progress = formationProgress(application.status);
                          const state = application.status === "approved"
                            ? "done"
                            : step < progress ? "done" : step === progress ? "current" : "todo";
                          return <span key={stepStatus + label} data-state={state}><b>{state === "done" ? "✓" : step}</b>{label}</span>;
                        })}
                      </div>
                      <small className="clubs-formation-step-caption">STEP {Math.min(formationProgress(application.status), formationSteps.length)} / {formationSteps.length} · {statusLabel(application.status)}</small>
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
                      <div className="clubs-captain-vote">
                        <div className="clubs-captain-vote-head">
                          <div><p className="clubs-eyebrow">CAPTAIN ELECTION</p><strong>{application.captainVotes?.length || 0}/{application.memberIds?.length || 0} votes cast</strong></div>
                          <span>{application.captainVotes?.some(v => String(v.voterPlayerId) === currentPlayerId) ? "Your vote is recorded" : "Your vote is needed"}</span>
                        </div>
                        <div className="clubs-vote-candidates">
                          {(application.captainCandidates || []).map(candidate => {
                            const member = (application.members || []).find(item => String(item?._id) === String(candidate));
                            const votes = (application.captainVotes || []).filter(v => String(v.candidatePlayerId) === String(candidate)).length;
                            return (
                              <button key={candidate} type="button" className="clubs-vote-candidate" disabled={busyId === application._id || application.captainVotes?.some(v => String(v.voterPlayerId) === currentPlayerId)} onClick={() => captainVote(application._id, candidate)}>
                                <span className="clubs-roster-avatar">{member?.profileImage ? <img src={member.profileImage} alt="" /> : playerInitials(member?.name)}</span>
                                <span><strong>{member?.name || "Captain candidate"}</strong><small>OVR {member?.ovr ?? "—"} · {votes} vote{votes === 1 ? "" : "s"}</small></span>
                                <b>{application.captainVotes?.some(v => String(v.candidatePlayerId) === String(candidate)) ? "VOTED" : "VOTE"}</b>
                              </button>
                            );
                          })}
                        </div>
                        <small className="clubs-captain-vote-note">Candidates are the two highest-OVR players in this formation. Every member must vote; a tie creates co-captains.</small>
                      </div>
                    )}
                    {canApproveDetails && (
                      <div className="clubs-name-proposal">
                        <label className="clubs-field-label" htmlFor={"club-details-" + application._id}>Club details / identity</label>
                        <textarea
                          id={"club-details-" + application._id}
                          value={detailDrafts[application._id] ?? application.details ?? ""}
                          onChange={event => setDetailDrafts(current => ({ ...current, [application._id]: event.target.value }))}
                          placeholder="Describe your Club identity, values, or squad focus"
                          maxLength={500}
                          rows={3}
                        />
                        <small>All elected captain(s) must approve the same non-empty details before admin review.</small>
                        <button type="button" className="clubs-primary-button" disabled={busyId === application._id} onClick={() => submitDetails(application._id, application.details)}>
                          {busyId === application._id ? "Saving…" : "Approve Details"}
                        </button>
                      </div>
                    )}
                    {waitingForCoCaptain && (
                      <p className="clubs-formation-status-note">Your details approval is recorded. Waiting for the other elected captain to approve the same details.</p>
                    )}
                    {waitingForCaptainDetails && (
                      <p className="clubs-formation-status-note">Waiting for the elected captain(s) to confirm the Club details.</p>
                    )}
                    {legacyDetailsStage && (
                      <div className="clubs-name-proposal">
                        <label className="clubs-field-label" htmlFor={"club-details-" + application._id}>Club details / identity</label>
                        <textarea
                          id={"club-details-" + application._id}
                          value={detailDrafts[application._id] ?? application.details ?? ""}
                          onChange={event => setDetailDrafts(current => ({ ...current, [application._id]: event.target.value }))}
                          placeholder="Describe your Club identity, values, or squad focus"
                          maxLength={500}
                          rows={3}
                        />
                        <small>All elected captain(s) must approve the same non-empty details before admin review.</small>
                        <button type="button" className="clubs-primary-button" disabled={busyId === application._id} onClick={() => submitDetails(application._id, application.details)}>Approve Details</button>
                      </div>
                    )}
                    {application.status === "pendingAdminApproval" && detailsAreComplete && (
                      <p className="clubs-formation-status-note">All elected captain(s) approved the details. Waiting for administrator approval.</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
      {(commandCenterLoading && !commandCenter) || (commandCenter?.nextAction && commandCenter.nextAction.type !== "all-clear") ? (
        <section className="clubs-hub-next-action" aria-live="polite">
          <div className="clubs-hub-next-action-icon" aria-hidden="true">{commandCenterLoading && !commandCenter ? "…" : "!"}</div>
          <div className="clubs-hub-next-action-copy">
            <p className="clubs-eyebrow">{commandCenter?.nextAction?.eyebrow || "YOUR NEXT ACTION"}</p>
            <h3>{commandCenterLoading && !commandCenter ? "Checking your next step…" : commandCenter.nextAction.title}</h3>
            <p>{commandCenterLoading && !commandCenter ? "Loading formation, fixtures and Club decisions." : commandCenter.nextAction.description}</p>
          </div>
          {commandCenter?.nextAction && commandCenter.nextAction.type !== "all-clear" && (
            <button type="button" className="clubs-secondary-button" onClick={() => openCommandAction(commandCenter.nextAction)}>
              {commandCenter.nextAction.actionLabel || "Open next step →"}
            </button>
          )}
        </section>
      ) : null}


      <section className="clubs-hub-stat-grid" aria-label="Club overview">
        <article className="clubs-hub-stat"><span>OFFICIAL CLUBS</span><strong>{loading ? "—" : clubs.length}</strong><small>Browse available Clubs</small></article>
        <article className="clubs-hub-stat"><span>YOUR FORMATIONS</span><strong>{applications.filter(application => !["approved", "rejected"].includes(application.status)).length}</strong><small>Applications in progress</small></article>
        <article className="clubs-hub-stat"><span>UPCOMING MATCHES</span><strong>{clubMatches.filter(match => match.status === "accepted").length}</strong><small>Confirmed fixtures and matchday plans</small></article>
      </section>

      <section className="clubs-hub-discovery-grid" aria-label="Club discovery and help">
        <article className="clubs-hub-discovery-card">
          <div className="clubs-hub-discovery-icon" aria-hidden="true">⌕</div>
          <div className="clubs-hub-discovery-copy"><p className="clubs-eyebrow">DISCOVER</p><h3>Find your Club</h3><p>Browse official Clubs, learn about their squads and explore available opportunities.</p></div>
          <button type="button" className="clubs-secondary-button" onClick={() => window.setTimeout(() => document.getElementById("clubs-official-directory")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40)}>Browse directory →</button>
        </article>
        <article className="clubs-hub-discovery-card">
          <div className="clubs-hub-discovery-icon" aria-hidden="true">?</div>
          <div className="clubs-hub-discovery-copy"><p className="clubs-eyebrow">NEW TO ULTIMATE CLUBS?</p><h3>Know how it works</h3><p>Formation, member acceptance, captain elections, shared credits and contracts—all in one quick guide.</p></div>
          <button type="button" className="clubs-secondary-button" aria-expanded={showClubGuide} onClick={() => setShowClubGuide(open => !open)}>{showClubGuide ? "Hide guide ↑" : "How it works →"}</button>
        </article>
      </section>
      {showClubGuide && (
        <section className="clubs-hub-guide" aria-label="How Ultimate Clubs works">
          <div><span>01</span><strong>Build your squad</strong><small>Choose 4–5 linked player profiles.</small></div>
          <div><span>02</span><strong>Agree as a team</strong><small>Every member accepts, then the squad elects captain(s).</small></div>
          <div><span>03</span><strong>Confirm and approve</strong><small>Captain(s) approve Club details before an administrator creates the official Club.</small></div>
          <p>A newly approved Club starts with <strong>3,000 shared Club credits</strong>. Those funds belong to the Club and are separate from your personal Player Wallet.</p>
        </section>
      )}

      <section id="clubs-formation-form" className="clubs-section clubs-hub-form-section">
        <div className="clubs-section-heading clubs-hub-form-heading">
          <div><p className="clubs-eyebrow">CREATE A SQUAD</p><h2>Form a 4–5 player Club</h2><p>Choose the players you want to invite. Their acceptance and later approval steps are tracked above.</p></div>
          {authUser && <button type="button" className="clubs-secondary-button" aria-expanded={showFormationForm} onClick={() => setShowFormationForm(open => !open)}>{showFormationForm ? "Hide form" : "Configure squad"}</button>}
        </div>
        {authUser ? showFormationForm ? (
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
        ) : (
          <div className="clubs-hub-collapsed-form"><span className="clubs-hub-collapsed-icon" aria-hidden="true">＋</span><div><strong>Ready to put a squad together?</strong><small>Pick three required invitees for a four-player Club, or four invitees for a five-player Club.</small></div><button type="button" className="clubs-primary-button" onClick={() => setShowFormationForm(true)}>Choose players</button></div>
        ) : (
          <div className="clubs-empty clubs-signin-note"><strong>Sign in to form a Club.</strong><span>Formation actions require a linked GG player profile.</span></div>
        )}
      </section>

      <section id="clubs-official-directory" className="clubs-section clubs-hub-directory">
        <div className="clubs-section-heading"><div><p className="clubs-eyebrow">OFFICIAL CLUB DIRECTORY</p><h2>Find your next squad</h2><p>Browse approved Clubs and request to join an open squad.</p></div><span>{loading ? "Loading…" : clubs.length + " Clubs"}</span></div>
        {loading ? <div className="clubs-empty">Loading the official Club directory…</div> : clubs.length === 0 ? (
          <div className="clubs-empty clubs-hub-empty-directory"><strong>No official Clubs yet.</strong><span>Approved 4–5 player squads will appear here. You can form one while the directory grows.</span>{authUser && <button type="button" className="clubs-secondary-button" onClick={() => { setShowFormationForm(true); window.setTimeout(() => document.getElementById("clubs-formation-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }}>Form the first Club →</button>}</div>
        ) : (
          <div className="clubs-grid clubs-hub-club-grid">{clubs.map(club => {
            const isMember = club.memberIds?.some(id => String(id) === currentPlayerId);
            const full = (club.memberIds?.length || 0) >= 5;
            const requested = joinRequests.some(request => String(request.clubId) === String(club._id) && String(request.playerId) === currentPlayerId && request.status === "pending");
            return <article className="club-card clubs-hub-club-card" key={club._id}>
              <div className="club-card-mark">GG</div>
              <div className="clubs-hub-club-card-main"><p className="clubs-eyebrow">OFFICIAL CLUB</p><h3>{club.name}</h3><p>{club.description || "A GG Matchday Club with a permanent squad, match history and shared budget."}</p><span>{club.memberIds?.length || 0}/5 players · {full ? "Squad full" : "Open roster"}</span></div>
              <div className="clubs-hub-club-card-action">{isMember ? <span className="clubs-hub-membership-state">Your Club</span> : full ? <span className="clubs-hub-membership-state">Squad full</span> : !authUser ? <span className="clubs-hub-membership-state">Sign in to request</span> : requested ? <span className="clubs-hub-membership-state">Request pending</span> : <button type="button" className="clubs-primary-button" disabled={busyId === club._id} onClick={() => sendJoinRequest(club._id)}>{busyId === club._id ? "Sending…" : "Request to Join"}</button>}</div>
            </article>;
          })}</div>
        )}
      </section>

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
        </>
      ) : activeSection === "overview" && ultimateSubsection === "matches" ? (
      <>
      <section id="clubs-match-center" className="clubs-section clubs-matches-panel">
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
            <div className="clubs-scout-grid">
              {(clubDiscovery.length ? clubDiscovery : players.map(player => ({ ...player, available: true }))).map(player => {
                const current = String(player._id) === currentPlayerId;
                const canOffer = Boolean(currentClub && myCaptainClubs.length && player.available && !current);
                return (
                  <article className="clubs-scout-card" key={player._id}>
                    <div className="clubs-scout-top">
                      <span className="clubs-scout-avatar">{player.profileImage ? <img src={player.profileImage} alt="" /> : playerInitials(player.name)}</span>
                      <div><p className="clubs-eyebrow">{player.position || "PLAYER"}</p><h3>{player.name}</h3><span>{player.jerseyNumber ? "#" + player.jerseyNumber : "GG PLAYER"}</span></div>
                      <strong>{player.currentOvr ?? player.ovrSnapshot?.currentOvr ?? "—"}<small>OVR</small></strong>
                    </div>
                    <div className="clubs-scout-metrics">
                      <span><b>{player.matchesPlayed ?? 0}</b><small>MATCHES</small></span>
                      <span><b>{player.goals ?? 0}</b><small>GOALS</small></span>
                      <span><b>{player.assists ?? 0}</b><small>ASSISTS</small></span>
                      <span><b>{player.formAverage ?? "—"}</b><small>FORM</small></span>
                    </div>
                    <div className="clubs-scout-footer">
                      <span data-availability={player.available ? "available" : "contracted"}>{player.available ? "Available for approach" : "Under Club contract"}</span>
                      {canOffer && <button type="button" className="clubs-secondary-button" onClick={() => {
                        setOfferPlayer(String(player._id));
                        setActiveSection("market"); window.setTimeout(() => document.getElementById("clubs-auction-desk")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
                      }}>Make Offer</button>}
                      {current && <span>That’s you</span>}
                    </div>
                  </article>
                );
              })}
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
      ) : activeSection === "market" ? (
        <>
        {authUser && myCaptainClubs.length > 0 ? (
        <section id="clubs-auction-desk" className="clubs-section clubs-market-offer-panel">
          <div className="clubs-section-heading"><div><p className="clubs-eyebrow">SIGNING MARKET</p><h2>Send a signing offer</h2></div></div>
          <form className="clubs-create-form" onSubmit={makeOffer}>
            <div className="clubs-invite-grid">
              <label><span>YOUR CLUB</span><select value={offerClub} onChange={e => setOfferClub(e.target.value)}><option value="">Choose club</option>{clubs.filter(c => c.memberIds?.some(id => String(id) === currentPlayerId) && c.captainIds?.some(id => String(id) === currentPlayerId)).map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
              <label><span>PLAYER</span><select value={offerPlayer} onChange={e => setOfferPlayer(e.target.value)}><option value="">Choose player</option>{players.filter(p => String(p._id) !== currentPlayerId).map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></label>
              <label><span>OFFER</span><input type="number" min="25" step="5" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} placeholder="Min 25 · +5" /></label>
            </div>
            <button className="clubs-primary-button" type="submit" disabled={busyId === "offer"}>{busyId === "offer" ? "Sending…" : "Send Signing Offer"}</button>
          </form>
        </section>
        ) : (
          <section id="clubs-auction-desk" className="clubs-section clubs-market-offer-panel">
            <div className="clubs-section-heading"><div><p className="clubs-eyebrow">SIGNING MARKET</p><h2>Send a signing offer</h2></div></div>
            <div className="clubs-empty"><strong>{authUser ? "Captain access required" : "Sign in to manage offers"}</strong><span>{authUser ? "Only a captain of an approved Club can submit a signing offer. Your existing offers and player decisions remain below." : "Signing offers are available to signed-in members who have an approved Club captain role."}</span></div>
          </section>
        )}

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
        <section className="clubs-section clubs-admin-dashboard">
          <div className="clubs-admin-hero">
            <div className="clubs-admin-hero-copy">
              <p className="clubs-eyebrow">CLUBS CONTROL CENTER</p>
              <h2>Administration dashboard</h2>
              <p>Approve formations, monitor Club health, resolve synchronization issues and keep the entire Clubs ecosystem moving.</p>
            </div>
            <button type="button" className="clubs-secondary-button clubs-admin-refresh" onClick={async () => {
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
          <div className="clubs-history-summary-grid" aria-label="Clubs operational metrics">
            {[
              ["Active Clubs", adminOverview?.counts?.activeClubs ?? 0, false],
              ["Pending Approvals", adminOverview?.counts?.pendingApplications ?? 0, true],
              ["Active Players", adminOverview?.counts?.activeMembers ?? 0, false],
              ["Club Matches", adminOverview?.counts?.upcomingMatches ?? 0, false],
              ["Completed", adminOverview?.counts?.completedMatches ?? 0, false],
              ["Archived Clubs", adminOverview?.counts?.archivedClubs ?? 0, false],
              ["Sync Failures", adminOverview?.counts?.syncFailures ?? 0, true],
              ["Renewal Risks", adminOverview?.counts?.renewalRisks ?? 0, true],
            ].map(([label, value, attention]) => (
              <div className="clubs-history-stat" data-alert={attention && Number(value) > 0 ? "true" : undefined} key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <section className="clubs-subsection clubs-admin-attention">
            <div className="clubs-section-heading"><div><p className="clubs-eyebrow">NEEDS ATTENTION</p><h3>Operational queue</h3><span>Every item points to the workflow that needs review.</span></div><span>{adminOverview?.attention?.length || 0}</span></div>
            {adminAttentionDetail && (
              <div className="clubs-admin-attention-detail" role="status">
                <div><p className="clubs-eyebrow">{String(adminAttentionDetail.severity || "info").toUpperCase()} · {adminAttentionDetail.type}</p><strong>{adminAttentionDetail.title}</strong><span>{adminAttentionDetail.subtitle}</span><p>{adminAttentionDetail.detail}</p></div>
                <button type="button" className="clubs-secondary-button" onClick={() => setAdminAttentionDetail(null)}>Dismiss</button>
              </div>
            )}
            {(adminOverview?.attention || []).length === 0 ? (
              <div className="clubs-empty"><strong>Everything is clear.</strong><span>No formation, sync, renewal or fixture items currently need administrator attention.</span></div>
            ) : (
              <div className="clubs-admin-attention-list">
                {(adminOverview?.attention || []).map(item => (
                  <button type="button" className="clubs-admin-attention-item" data-severity={item.severity} key={item.type + ":" + item.entityId + ":" + item.title} onClick={() => {
                    if (item.target === "adminApplications") setActiveSection("adminApplications");
                    else if (item.target === "adminClubs") setActiveSection("adminClubs");
                    else if (item.target === "adminMatches") setActiveSection("adminMatches");
                    setAdminAttentionDetail(item);
                  }}>
                    <span className="clubs-admin-attention-severity">{item.severity === "high" ? "!" : item.severity === "medium" ? "•" : "○"}</span>
                    <span><strong>{item.title}</strong><small>{item.subtitle}</small><em>{item.detail}</em></span>
                    <b>{item.actionLabel || "OPEN →"}</b>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="clubs-subsection clubs-admin-latest">
            <div className="clubs-section-heading">
              <div><p className="clubs-eyebrow">LATEST CLUBS</p><h3>Recently changed Clubs</h3></div>
              <span>{adminOverview?.recentClubs?.length || 0}</span>
            </div>
            {(adminOverview?.recentClubs || []).length === 0 ? (
              <div className="clubs-empty"><strong>No Club changes yet.</strong><span>Approved, archived and recently created Clubs will appear here.</span></div>
            ) : (
              <div className="clubs-admin-latest-grid">
                {(adminOverview?.recentClubs || []).map(club => (
                  <article className="clubs-admin-club-card" key={String(club._id)}>
                    <span className="clubs-admin-club-mark">GG</span>
                    <div className="clubs-admin-club-copy">
                      <strong>{club.name || "Unnamed Club"}</strong>
                      <span>{club.memberIds?.length || 0}/5 players · {club.captainIds?.length || 0} captain{(club.captainIds?.length || 0) === 1 ? "" : "s"} · updated {club.updatedAt ? new Date(club.updatedAt).toLocaleDateString() : "recently"}</span>
                    </div>
                    <span className="clubs-admin-club-status" data-status={club.status}>{String(club.status || "unknown").replace(/([A-Z])/g, " $1")}</span>
                  </article>
                ))}
              </div>
            )}
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
            <div className="clubs-review-grid">
              <form className="clubs-review-form" onSubmit={submitReview}>
                <div className="clubs-review-form-intro"><p className="clubs-eyebrow">WRITE A REVIEW</p><strong>Keep it useful and match-specific.</strong><span>Reviews are limited to players you actually played with or against in a completed Club Match.</span></div>
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
                  <textarea value={reviewForm.observation} onChange={event => setReviewForm(current => ({ ...current, observation: event.target.value }))} maxLength={1000} rows={5} placeholder="Example: excellent close control under pressure, kept making progressive passes." required />
                </label>
                <div className="clubs-review-character-count">{reviewForm.observation.length}/1000</div>
                <button type="submit" className="clubs-primary-button" disabled={busyId === "review"}>{busyId === "review" ? "Submitting…" : "Publish review"}</button>
              </form>
              <section className="clubs-review-received">
                <div className="clubs-section-heading"><div><p className="clubs-eyebrow">YOUR REVIEWS</p><h3>What other Club players said</h3></div><span>{receivedReviews.length}</span></div>
                {receivedReviews.length === 0 ? <div className="clubs-empty">No reviews received yet. Complete Club Matches and your feedback history will build here.</div> : (
                  <div className="clubs-received-list">
                    {receivedReviews.slice(0, 8).map(review => (
                      <article className="clubs-received-review" key={String(review._id)}>
                        <div className="clubs-received-review-head"><strong>{review.reviewerPlayerId?.name || "Player"}</strong><span>{"★".repeat(Number(review.stars || 0))}</span></div>
                        <small>{review.relationship} · {new Date(review.createdAt).toLocaleDateString()}</small>
                        <p>{review.observation}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      ) : activeSection === "myClub" && myClubSubsection === "squad" ? (
        <>
      {authUser && (
        <section className="clubs-section clubs-wallet-dashboard">
          <div className="clubs-section-heading">
            <div><p className="clubs-eyebrow">PLAYER WALLET</p><h2>Your individual budget</h2></div>
            <span>Personal credits · separate from Club funds</span>
          </div>
          <div className="clubs-wallet-grid clubs-wallet-grid-budget">
            <article className="clubs-wallet-card clubs-wallet-card-primary">
              <div className="clubs-wallet-card-head">
                <span>SPENDABLE PLAYER CREDITS</span>
                <span className="clubs-wallet-status">Available now</span>
              </div>
              <strong className="clubs-wallet-main-value">{playerCredits.toLocaleString("en-IN")}</strong>
              <small>Your personal balance for eligible Club activities, including placing match bets.</small>
              <div className="clubs-wallet-balance-note">
                <span>Available to you</span>
                <strong>{playerCredits.toLocaleString("en-IN")} credits</strong>
              </div>
            </article>
            <article className="clubs-wallet-card clubs-wallet-card-muted">
              <div className="clubs-wallet-card-head">
                <span>RECENT ACTIVITY</span>
                <span className="clubs-wallet-status clubs-wallet-status-muted">{recentPlayerTransactions.length} recent</span>
              </div>
              {recentPlayerTransactions.length ? (
                <ul className="clubs-wallet-activity">
                  {recentPlayerTransactions.map((transaction, index) => {
                    const amount = Number(transaction.amount || 0);
                    return (
                      <li key={transaction._id || transaction.idempotencyKey || index}>
                        <div>
                          <strong>{transaction.description || String(transaction.type || "Wallet transaction").replaceAll("_", " ")}</strong>
                          <small>{transaction.createdAt ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(transaction.createdAt)) : "Recent transaction"}</small>
                        </div>
                        <span className={amount >= 0 ? "clubs-wallet-amount-positive" : "clubs-wallet-amount-negative"}>
                          {amount > 0 ? "+" : amount < 0 ? "−" : ""}{Math.abs(amount).toLocaleString("en-IN")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="clubs-wallet-empty-activity">
                  <strong>No wallet activity yet</strong>
                  <small>Signing rewards, match rewards and eligible betting winnings will appear here.</small>
                </div>
              )}
            </article>
          </div>
          <p className="clubs-wallet-footnote">Club bids reserve credits from the Club budget, not your Player Wallet. Wallet activity never changes GG Match ratings.</p>
        </section>
      )}
      <section className="clubs-section clubs-my-club-panel">
          {!currentClub ? (
            <div className="clubs-empty clubs-empty--hero clubs-myclub-empty">
              <span className="clubs-empty-icon">⚽</span>
              {activeFormationApplication ? (
                <>
                  <p className="clubs-eyebrow">FORMATION IN PROGRESS</p>
                  <strong>{activeFormationApplication.proposedName || "Your Club formation"} is not an official Club yet.</strong>
                  <span>Status: {statusLabel(activeFormationApplication.status)}. Your proposed squad and next action remain available in the Club Hub; Club spending and contracts activate only after admin approval.</span>
                  <button type="button" className="clubs-primary-button" onClick={() => {
                    setActiveSection("overview");
                    setUltimateSubsection("overview");
                    window.setTimeout(() => document.getElementById("clubs-formation-pipeline")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                  }}>View formation progress</button>
                </>
              ) : (
                <>
                  <p className="clubs-eyebrow">YOUR CLUB DASHBOARD</p>
                  <strong>You are not currently under a Club contract.</strong>
                  <span>Your previous Club history remains preserved. Form a squad or browse approved Clubs to get started.</span>
                  <button type="button" className="clubs-primary-button" onClick={() => setActiveSection("overview")}>Explore Club Hub</button>
                </>
              )}
            </div>
          ) : (
            <>
              <header className="clubs-command-header">
                <div className="clubs-command-title">
                  <p className="clubs-eyebrow">MY CLUB / DASHBOARD</p>
                  <div className="clubs-title-row">
                    <div className="clubs-club-crest" aria-hidden="true">GG</div>
                    <div>
                      <h2>{currentClub.name}</h2>
                      <span>{currentClub.memberIds?.length || 0}/5 players · {currentClub.captainIds?.length || 0} captain(s)</span>
                    </div>
                  </div>
                </div>
                <div className="clubs-command-balance">
                  <div className="clubs-budget-title-row">
                    <span>AVAILABLE CLUB BUDGET</span>
                    <span className="clubs-wallet-status">Spendable</span>
                  </div>
                  <strong className="clubs-command-balance-available">{clubAvailableBudget.toLocaleString("en-IN")}</strong>
                  <div className="clubs-command-budget-breakdown">
                    <div><span>Reserved for offers</span><strong>{clubCommittedBudget.toLocaleString("en-IN")}</strong></div>
                    <div><span>Total club funds</span><strong>{clubTotalBudget.toLocaleString("en-IN")}</strong></div>
                  </div>
                  <div
                    className="clubs-budget-meter clubs-budget-meter--club"
                    role="progressbar"
                    aria-label="Club budget reserved by active signing offers"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={clubReservedPercent}
                    aria-valuetext={`${clubReservedPercent}% of the Club budget is reserved`}
                  >
                    <span style={{ width: `${clubReservedPercent}%` }} />
                  </div>
                  <small>{clubReservedPercent}% reserved · {clubAvailableBudget.toLocaleString("en-IN")} credits remain available for new offers.</small>
                </div>
              </header>

              <section className="clubs-myclub-overview-grid" aria-label="My Club at a glance">
                <article className="clubs-myclub-overview-stat">
                  <span>ACTIVE SQUAD</span>
                  <strong>{currentClub.memberIds?.length || 0}/5</strong>
                  <small>{currentClub.captainIds?.length || 0} elected captain(s)</small>
                </article>
                <article className="clubs-myclub-overview-stat">
                  <span>TEAM OVR</span>
                  <strong>{clubOvr ?? "—"}</strong>
                  <small>{squadHasCompleteOvr ? "Squad rating available" : "Developing from recorded player data"}</small>
                </article>
                <article className="clubs-myclub-overview-stat">
                  <span>CLUB MATCHES</span>
                  <strong>{completedClubMatches.length}</strong>
                  <small>Completed fixtures and history</small>
                </article>
                <article className="clubs-myclub-overview-stat clubs-myclub-next-fixture">
                  <span>{nextClubMatch ? "NEXT FIXTURE" : "FIXTURE STATUS"}</span>
                  <strong>{nextClubMatch ? (nextClubMatch.clubAName || clubName(nextClubMatch.clubAId)) + " vs " + (nextClubMatch.clubBName || clubName(nextClubMatch.clubBId)) : "No upcoming fixture"}</strong>
                  <small>{nextClubMatch
                    ? (nextClubMatch.fixtureDate || new Date(nextClubMatch.scheduledAt).toLocaleDateString("en-IN")) + " · " + nextClubMatch.status
                    : "Accepted and requested Club matches appear in Matches."}</small>
                </article>
              </section>

              <div className="clubs-myclub-quick-actions">
                <div><p className="clubs-eyebrow">QUICK ACTIONS</p><strong>Manage your Club without hunting through tabs.</strong></div>
                <div className="clubs-myclub-quick-action-buttons">
                  <button type="button" className="clubs-secondary-button" onClick={() => setActiveSection("market")}>Manage signings →</button>
                  <button type="button" className="clubs-secondary-button" onClick={() => { setActiveSection("overview"); setUltimateSubsection("matches"); window.setTimeout(() => document.getElementById("clubs-match-center")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }}>Club matches →</button>
                </div>
              </div>

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
                <section id="clubs-renewal-room" className="clubs-subsection clubs-renewal-panel">
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
                                  onClick={() => setRetainedPlayers(current => retained ? (current || []).filter(id => id !== String(playerId)) : (current || []).length < 5 ? [...(current || []), String(playerId)] : current)}
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
                          <span>{(retainedPlayers || []).length >= 4 ? "Ready to renew with " + retainedPlayers.length + " players." : "Retain 4–5 players to renew. Fewer than 4 archives the Club."}</span>
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
