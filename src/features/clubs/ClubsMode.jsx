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

export default function ClubsMode({ onReturnToMatchday, authUser }) {
  const [clubs, setClubs] = useState([]);
  const [players, setPlayers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formationLoading, setFormationLoading] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [nameSavingId, setNameSavingId] = useState(null);
  const [error, setError] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState(["", "", ""]);
  const [formation, setFormation] = useState("1-2-1");
  const [clubNameDrafts, setClubNameDrafts] = useState({});

  useEffect(() => {
    let active = true;
    const requests = [api("/clubs/meta"), api("/clubs"), api("/players")];
    if (authUser) requests.push(api("/clubs/formation/me"));

    Promise.all(requests)
      .then(results => {
        if (!active) return;
        setMeta(results[0]);
        setClubs(Array.isArray(results[1]) ? results[1] : []);
        setPlayers(Array.isArray(results[2]) ? results[2] : []);
        setApplications(authUser && Array.isArray(results[3]) ? results[3] : []);
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

  const formations = useMemo(
    () => meta?.formations?.length ? meta.formations : formationLabels,
    [meta],
  );

  const currentPlayerId = authUser?.playerProfile ? String(authUser.playerProfile) : "";

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
        <button className="active" type="button">Ultimate Clubs</button>
        <button type="button" disabled>My Club</button>
        <button type="button" disabled>Players</button>
        <button type="button" disabled>Auctions</button>
        <button type="button" disabled>Matches</button>
      </nav>

      {error && <div className="clubs-error" role="alert">{error}</div>}

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
                        <input
                          value={clubNameDrafts[application._id] || ""}
                          onChange={event => setClubNameDrafts(current => ({
                            ...current,
                            [application._id]: event.target.value,
                          }))}
                          placeholder="Propose the permanent club name"
                          maxLength={80}
                        />
                        <button
                          type="button"
                          className="clubs-primary-button"
                          disabled={nameSavingId === application._id}
                          onClick={() => proposeName(application._id)}
                        >
                          {nameSavingId === application._id ? "Saving…" : "Propose Name"}
                        </button>
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
    </main>
  );
}