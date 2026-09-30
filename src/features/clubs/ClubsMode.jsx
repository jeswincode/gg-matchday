import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import "./clubs-mode.css";

const formationLabels = ["1-2-1", "2-1-1", "1-3", "3-1", "2-2"];

function statusLabel(status) {
  return {
    pendingMutualAgreement: "Waiting for all four players",
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
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formationLoading, setFormationLoading] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [nameSavingId, setNameSavingId] = useState(null);
  const [error, setError] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState(["", "", ""]);
  const [formation, setFormation] = useState("1-2-1");
  const [clubNameDrafts, setClubNameDrafts] = useState({});
  const [detailDrafts, setDetailDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [offerPlayer, setOfferPlayer] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerClub, setOfferClub] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [clubMatches, setClubMatches] = useState([]);
  const [matchClubA, setMatchClubA] = useState("");
  const [matchClubB, setMatchClubB] = useState("");
  const [matchScheduledAt, setMatchScheduledAt] = useState("");
  const [matchSubmitting, setMatchSubmitting] = useState(false);
  const [clubStats, setClubStats] = useState([]);
  const [clubHistory, setClubHistory] = useState([]);
  const [auctionState, setAuctionState] = useState(null);
  const [auctionLoading, setAuctionLoading] = useState(false);
  const [activeAuctionPlayer, setActiveAuctionPlayer] = useState("");
  const [selectedPlayerOffers, setSelectedPlayerOffers] = useState([]);
  const [joinDecisionReason, setJoinDecisionReason] = useState({});
  const [renewalState, setRenewalState] = useState(null);
  const [retainedPlayers, setRetainedPlayers] = useState([]);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [reviewCandidates, setReviewCandidates] = useState([]);
  const [reviewForm, setReviewForm] = useState({ candidateKey: "", stars: 5, observation: "" });
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const requests = [api("/clubs/meta"), api("/clubs"), api("/players"), api("/clubs/matches")];
    if (authUser) requests.push(api("/clubs/formation/me"));

    Promise.all(requests)
      .then(results => {
        if (!active) return;
        setMeta(results[0]);
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
  }, [authUser]);
  useEffect(() => {
    let active = true;
    if (activeSection !== "myClub" || !currentClub?._id) {
      return undefined;
    }

    Promise.all([
      api("/clubs/" + currentClub._id + "/stats"),
      api("/clubs/" + currentClub._id + "/history"),
    ])
      .then(([statsData, historyData]) => {
        if (!active) return;
        setClubStats(Array.isArray(statsData?.stats) ? statsData.stats : []);
        setClubHistory(Array.isArray(historyData) ? historyData : []);
      })
      .catch(requestError => {
        if (active) setError(requestError.message || "Club details could not be loaded.");
      })
      ;

    return () => {
      active = false;
    };
  }, [activeSection, currentClub?._id]);

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
      await api("/clubs/admin/applications/" + applicationId + "/" + action, { method: "POST" });
      await refreshAdminApplications();
      const clubsData = await api("/clubs");
      setClubs(Array.isArray(clubsData) ? clubsData : []);
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
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const refreshClubMatches = async () => {
    const data = await api("/clubs/matches");
    setClubMatches(Array.isArray(data) ? data : []);
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
    if (!currentClub?._id || retainedPlayers.length !== 2) {
      setError("Select exactly two players to retain.");
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

  const loadPlayerOffers = async playerId => {
    setActiveAuctionPlayer(playerId);
    try {
      const data = await api("/clubs/auction/offers/" + playerId);
      setSelectedPlayerOffers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    }
  };

  const chooseAuctionOffer = async offerId => {
    setError("");
    try {
      setBusyId("auction-" + offerId);
      await api("/clubs/auction/offers/" + offerId + "/choose", { method: "POST" });
      await refreshAuctionState();
      if (activeAuctionPlayer) await loadPlayerOffers(activeAuctionPlayer);
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
        body: { clubAId: matchClubA, clubBId: matchClubB, scheduledAt: new Date(matchScheduledAt).toISOString() },
      });
      setMatchClubB("");
      setMatchScheduledAt("");
      await refreshClubMatches();
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
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const clubName = clubId =>
    clubs.find(club => String(club._id) === String(clubId))?.name || "Unknown club";
  const currentPlayerId = authUser?.playerProfile ? String(authUser.playerProfile) : "";
  const currentClub =
    clubs.find(club => club.memberIds?.some(id => String(id) === currentPlayerId)) || null;
  const myCaptainClubs = clubs.filter(club =>
    club.memberIds?.some(id => String(id) === currentPlayerId) &&
    club.captainIds?.some(id => String(id) === currentPlayerId),
  );
  const formations = useMemo(
    () => meta?.formations?.length ? meta.formations : formationLabels,
    [meta],
  );


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
    if (ids.length !== 3 || new Set(ids).size !== 3) {
      setError("Choose three different players to invite.");
      return;
    }

    try {
      setFormationLoading(true);
      await api("/clubs/formation", {
        method: "POST",
        body: { playerIds: ids, formation },
      });
      setSelectedPlayers(["", "", ""]);
      await refreshApplications();
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
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRespondingId(null);
    }
  };

  const startCaptainVote = async applicationId => { setError(""); try { setBusyId(applicationId); await api("/clubs/formation/" + applicationId + "/captain/setup", { method: "POST" }); await refreshApplications(); } catch (e) { setError(e.message); } finally { setBusyId(null); } };

  const captainVote = async (applicationId, candidatePlayerId) => { setError(""); try { setBusyId(applicationId); await api("/clubs/formation/" + applicationId + "/captain/vote", { method: "POST", body: { candidatePlayerId } }); await refreshApplications(); } catch (e) { setError(e.message); } finally { setBusyId(null); } };

  const submitDetails = async applicationId => { setError(""); try { setBusyId(applicationId); await api("/clubs/formation/" + applicationId + "/details", { method: "POST", body: { details: detailDrafts[applicationId] || "" } }); await refreshApplications(); } catch (e) { setError(e.message); } finally { setBusyId(null); } };

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
    refreshAdminApplications();
    return undefined;
  }, [isAdmin, activeSection]);

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
    if (!authUser || activeSection !== "auctions") return undefined;
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
    if (!authUser || activeSection !== "myClub" || !currentClub?._id) return undefined;
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
  }, [authUser, activeSection, currentClub?._id, retainedPlayers.length]);

  return (
    <main className="clubs-app">
      <header className="clubs-topbar">
        <div>
          <p className="clubs-eyebrow">GG MATCHDAY / CLUBS</p>
          <h1>Ultimate Clubs</h1>
          <p className="clubs-subtitle">
            Build a four-player club, compete, earn, sign and create your club history.
          </p>
        </div>
        <button type="button" className="clubs-return-button" onClick={onReturnToMatchday}>
          ← Matchday
        </button>
      </header>

      <nav className="clubs-nav" aria-label="Clubs navigation">
        <button className={activeSection === "overview" ? "active" : ""} type="button" onClick={() => setActiveSection("overview")}>Ultimate Clubs</button>
        <button className={activeSection === "myClub" ? "active" : ""} type="button" onClick={() => setActiveSection("myClub")}>My Club</button>
        <button className={activeSection === "players" ? "active" : ""} type="button" onClick={() => setActiveSection("players")}>Players</button>
        <button className={activeSection === "auctions" ? "active" : ""} type="button" onClick={() => setActiveSection("auctions")}>Auctions</button>
        <button className={activeSection === "matches" ? "active" : ""} type="button" onClick={() => setActiveSection("matches")}>Matches</button>
        <button className={activeSection === "reviews" ? "active" : ""} type="button" onClick={() => setActiveSection("reviews")}>Reviews</button>
        {isAdmin && <button className={activeSection === "admin" ? "active" : ""} type="button" onClick={() => setActiveSection("admin")}>Admin</button>}
      </nav>

      {error && <div className="clubs-error" role="alert">{error}</div>}

      {activeSection === "overview" ? (
        <>
      <section className="clubs-hero">
        <div>
          <p className="clubs-eyebrow">THE CLUBS WORLD</p>
          <h2>Four players. One identity.</h2>
          <p>
            Four players must agree before the club can move forward. The football result will continue to come from the normal GG Match Record.
          </p>
        </div>
        <div className="clubs-balance-card">
          <span>NEW CLUB BALANCE</span>
          <strong>{meta?.clubStartingBalance ?? 3000}</strong>
          <small>starting credits</small>
        </div>
      </section>

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
              const full = (club.memberIds?.length || 0) >= 4;
              return <article className="clubs-application" key={club._id}>
                <div><p className="clubs-eyebrow">{club.formation}</p><h3>{club.name}</h3><span>{club.memberIds?.length || 0}/4 players · {club.balance} credits</span></div>
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
              <label><span>OFFER</span><input type="number" min="1" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} placeholder="Credits" /></label>
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
              <h2>Invite three players</h2>
            </div>
            <span>4 players total</span>
          </div>

          <form className="clubs-create-form" onSubmit={startFormation}>
            <div className="clubs-invite-grid">
              {[0, 1, 2].map(index => (
                <label key={index}>
                  <span>PLAYER {index + 2}</span>
                  <select
                    value={selectedPlayers[index]}
                    onChange={event => updatePlayerSelection(index, event.target.value)}
                  >
                    <option value="">Choose a player</option>
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

            <div className="clubs-create-actions">
              <label>
                <span>STARTING FORMATION</span>
                <select value={formation} onChange={event => setFormation(event.target.value)}>
                  {formations.map(value => <option value={value} key={value}>{value}</option>)}
                </select>
              </label>
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
                      <span>{application.memberIds?.length || 0}/4 members · {application.formation}</span>
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
            <p className="clubs-eyebrow">FORMATION</p>
            <h2>Choose your shape</h2>
          </div>
          <span>4 players</span>
        </div>

        <div className="clubs-formations">
          {formations.map(value => (
            <button
              type="button"
              key={value}
              className={formation === value ? "clubs-formation-card active" : "clubs-formation-card"}
              onClick={() => setFormation(value)}
            >
              <strong>{value}</strong>
              <span>Selectable club formation</span>
            </button>
          ))}
        </div>
      </section>

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
            <span>The first four-player clubs will appear here after approval.</span>
          </div>
        ) : (
          <div className="clubs-grid">
            {clubs.map(club => (
              <article className="club-card" key={club._id}>
                <div className="club-card-mark">GG</div>
                <div>
                  <p className="clubs-eyebrow">OFFICIAL CLUB</p>
                  <h3>{club.name}</h3>
                  <span>{club.formation} · {club.memberIds?.length || 0}/4 players</span>
                </div>
                <strong>{club.balance ?? 3000}</strong>
              </article>
            ))}
          </div>
        )}
      </section>

        </>
      ) : activeSection === "matches" ? (
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
              <label><span>SCHEDULED FOR</span><input type="datetime-local" value={matchScheduledAt} onChange={event => setMatchScheduledAt(event.target.value)} /></label>
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
                    <span>{new Date(match.scheduledAt).toLocaleString()} · {match.status === "completed" ? String(match.clubAScore) + "–" + String(match.clubBScore) : match.status === "accepted" ? "Accepted · waiting for Matchday record" : "Awaiting response"}</span>
                    {match.status === "requested" && isReceivingClub && <small className="clubs-match-hint">{hasCaptainResponse ? "A captain response is recorded; receiving captains must agree." : "Captain response required."}</small>}
                  </div>
                  <div className="clubs-application-actions">
                    {match.status === "requested" && isReceivingClub && <>
                      <button type="button" className="clubs-primary-button" disabled={busyId === match._id} onClick={() => respondToClubMatch(match._id, true)}>Accept</button>
                      <button type="button" className="clubs-secondary-button" disabled={busyId === match._id} onClick={() => respondToClubMatch(match._id, false)}>Decline</button>
                    </>}
                    {["requested", "accepted"].includes(match.status) && isRequestingClub && <button type="button" className="clubs-secondary-button" disabled={busyId === match._id} onClick={() => cancelClubMatch(match._id)}>Cancel request</button>}
                    {match.status === "completed" && <span className="clubs-match-linked">Linked to Matchday</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      ) : activeSection === "players" ? (
        <section className="clubs-section">
          <div className="clubs-section-heading"><div><p className="clubs-eyebrow">PLAYER MARKET</p><h2>Available players</h2></div><span>{players.length}</span></div>
          <div className="clubs-application-list">
            {players.map(player => (
              <article className="clubs-application" key={player._id}>
                <div>
                  <p className="clubs-eyebrow">{player.position || "PLAYER"}</p>
                  <h3>{player.name}</h3>
                  <span>{player.jerseyNumber ? "#" + player.jerseyNumber + " · " : ""}Open to Club approaches</span>
                </div>
                <button type="button" className="clubs-secondary-button" onClick={() => loadPlayerOffers(player._id)}>View offers</button>
              </article>
            ))}
          </div>
          {activeAuctionPlayer && (
            <div className="clubs-subsection">
              <div className="clubs-section-heading"><div><p className="clubs-eyebrow">OFFERS</p><h3>Signing offers</h3></div><span>{selectedPlayerOffers.length}</span></div>
              {selectedPlayerOffers.length === 0 ? <div className="clubs-empty">No active signing offers for this player.</div> : (
                <div className="clubs-application-list">
                  {selectedPlayerOffers.map(offer => (
                    <article className="clubs-application" key={offer._id}>
                      <div><p className="clubs-eyebrow">{offer.status}</p><h3>{offer.amount} credits</h3><span>Club {clubName(offer.clubId)}</span></div>
                      {offer.status === "active" && String(offer.playerId) === currentPlayerId && <button type="button" className="clubs-primary-button" disabled={busyId === "auction-" + offer._id} onClick={() => chooseAuctionOffer(offer._id)}>Choose offer</button>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      ) : activeSection === "auctions" ? (
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
      ) : activeSection === "admin" ? (
        <section className="clubs-section">
          <div className="clubs-section-heading">
            <div><p className="clubs-eyebrow">CLUB ADMIN</p><h2>Formation approvals</h2></div>
            <span>{adminLoading ? "Loading…" : adminApplications.length}</span>
          </div>
          {!isAdmin ? (
            <div className="clubs-empty">Admin access is required.</div>
          ) : adminLoading ? (
            <div className="clubs-empty">Loading formation applications…</div>
          ) : adminApplications.length === 0 ? (
            <div className="clubs-empty">No formation applications are waiting for admin action.</div>
          ) : (
            <div className="clubs-application-list">
              {adminApplications.map(application => (
                <article className="clubs-application" key={application._id}>
                  <div>
                    <p className="clubs-eyebrow">{statusLabel(application.status)}</p>
                    <h3>{application.proposedName || "Unnamed club"}</h3>
                    <span>{application.memberIds?.length || 0}/4 members · {application.formation}</span>
                  </div>
                  <div className="clubs-application-actions">
                    <button type="button" className="clubs-primary-button" disabled={busyId === "admin-" + application._id} onClick={() => respondToAdminApplication(application._id, "approve")}>Approve</button>
                    <button type="button" className="clubs-secondary-button" disabled={busyId === "admin-" + application._id} onClick={() => respondToAdminApplication(application._id, "reject")}>Reject</button>
                  </div>
                </article>
              ))}
            </div>
          )}
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
      ) : activeSection === "myClub" ? (
        <section className="clubs-section clubs-my-club-panel">
          {activeSection === "myClub" && currentClub && clubStats.length === 0 && clubHistory.length === 0 ? (
            <div className="clubs-empty">Loading your Club profile…</div>
          ) : !currentClub ? (
            <div className="clubs-empty">
              <strong>You are not currently under a Club contract.</strong>
              <span>Your previous Club history remains preserved in the Clubs database.</span>
            </div>
          ) : (
            <>
              <section className="clubs-my-club-hero">
                <div>
                  <p className="clubs-eyebrow">MY CLUB</p>
                  <h2>{currentClub.name}</h2>
                  <span>{currentClub.formation} · {currentClub.memberIds?.length || 0}/4 players</span>
                </div>
                <div className="clubs-my-club-balance">
                  <span>BALANCE</span>
                  <strong>{currentClub.balance ?? 0}</strong>
                  <small>Club credits</small>
                </div>
              </section>

              <section className="clubs-subsection">
                <div className="clubs-section-heading">
                  <div><p className="clubs-eyebrow">ROSTER</p><h3>Club players</h3></div>
                  <span>{currentClub.captainIds?.length || 0} captain(s)</span>
                </div>
                <div className="clubs-roster-list">
                  {(currentClub.memberIds || []).map(playerId => {
                    const player = players.find(item => String(item._id) === String(playerId));
                    const stat = clubStats.find(item => String(item.playerId?._id || item.playerId) === String(playerId));
                    const average = stat?.ratedMatches ? (Number(stat.ratingTotal) / Number(stat.ratedMatches)).toFixed(2) : "—";
                    const isCaptain = currentClub.captainIds?.some(id => String(id) === String(playerId));
                    return (
                      <article className="clubs-roster-row" key={String(playerId)}>
                        <div>
                          <strong>{player?.name || "Club player"}</strong>
                          <span>{player?.position || "Player"}{isCaptain ? " · Captain" : ""}</span>
                        </div>
                        <div className="clubs-roster-stat"><strong>{average}</strong><span>AVG</span></div>
                        <div className="clubs-roster-stat"><strong>{stat?.matches ?? 0}</strong><span>MATCHES</span></div>
                        <div className="clubs-roster-stat"><strong>{stat?.wins ?? 0}</strong><span>WINS</span></div>
                        <div className="clubs-roster-stat"><strong>{stat?.goals ?? 0}</strong><span>GOALS</span></div>
                        <div className="clubs-roster-stat"><strong>{stat?.assists ?? 0}</strong><span>ASSISTS</span></div>
                        <div className="clubs-roster-stat"><strong>{stat?.motm ?? 0}</strong><span>MOTM</span></div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="clubs-subsection">
                <div className="clubs-section-heading">
                  <div><p className="clubs-eyebrow">CONTRACT RENEWAL</p><h3>Retain two players</h3></div>
                  <span>{renewalLoading ? "Loading…" : renewalState?.boundaryAt ? new Date(renewalState.boundaryAt).toLocaleDateString() : "—"}</span>
                </div>
                {renewalLoading ? (
                  <div className="clubs-empty">Loading renewal status…</div>
                ) : !renewalState?.boundaryAt ? (
                  <div className="clubs-empty">No active four-player renewal cycle is available.</div>
                ) : (
                  <>
                    <div className="clubs-application-list">
                      {(currentClub.memberIds || []).map(playerId => {
                        const player = players.find(item => String(item._id) === String(playerId));
                        const retained = retainedPlayers.includes(String(playerId));
                        return (
                          <article className="clubs-application" key={String(playerId)}>
                            <div><p className="clubs-eyebrow">{currentClub.captainIds?.some(id => String(id) === String(playerId)) ? "CAPTAIN" : "PLAYER"}</p><h3>{player?.name || "Club player"}</h3><span>{retained ? "Selected to retain" : "Selected for release if both captains agree"}</span></div>
                            {renewalState.isCaptain && <button type="button" className={retained ? "clubs-primary-button" : "clubs-secondary-button"} onClick={() => setRetainedPlayers(current => retained ? current.filter(id => id !== String(playerId)) : current.length < 2 ? [...current, String(playerId)] : current)}>{retained ? "Retain" : "Select"}</button>}
                          </article>
                        );
                      })}
                    </div>
                    {renewalState.isCaptain && <button type="button" className="clubs-primary-button" disabled={busyId === "renewal" || retainedPlayers.length !== 2} onClick={submitRenewal}>{busyId === "renewal" ? "Submitting…" : "Submit Renewal Decision"}</button>}
                    {renewalState.decision && <div className="clubs-empty"><strong>{renewalState.decision.status === "applied" ? "Renewal applied." : "Renewal decision recorded."}</strong><span>Captain approvals: {renewalState.decision.captainApprovalIds?.length || 0}/{currentClub.captainIds?.length || 0}</span></div>}
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
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}
