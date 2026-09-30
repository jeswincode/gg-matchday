import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import "./clubs-mode.css";

const formationLabels = ["1-2-1", "2-1-1", "1-3", "3-1", "2-2"];

export default function ClubsMode({ onReturnToMatchday }) {
  const [clubs, setClubs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      api("/clubs/meta"),
      api("/clubs"),
    ])
      .then(([metaData, clubData]) => {
        if (!active) return;
        setMeta(metaData);
        setClubs(Array.isArray(clubData) ? clubData : []);
        setError("");
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message || "Clubs database is not ready yet.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const formations = useMemo(
    () => meta?.formations?.length ? meta.formations : formationLabels,
    [meta],
  );

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
        <button type="button">My Club</button>
        <button type="button">Players</button>
        <button type="button">Auctions</button>
        <button type="button">Matches</button>
      </nav>

      <section className="clubs-hero">
        <div>
          <p className="clubs-eyebrow">THE CLUBS WORLD</p>
          <h2>Four players. One identity.</h2>
          <p>
            Clubs is built separately from the normal Matchday experience.
            Football results still come from the existing Match Record.
          </p>
        </div>

        <div className="clubs-balance-card">
          <span>NEW CLUB BALANCE</span>
          <strong>{meta?.clubStartingBalance ?? 3000}</strong>
          <small>starting credits</small>
        </div>
      </section>

      <section className="clubs-section">
        <div className="clubs-section-heading">
          <div>
            <p className="clubs-eyebrow">FORMATION</p>
            <h2>Choose your shape</h2>
          </div>
          <span>4 players</span>
        </div>

        <div className="clubs-formations">
          {formations.map((formation) => (
            <button type="button" key={formation} className="clubs-formation-card">
              <strong>{formation}</strong>
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
        ) : error ? (
          <div className="clubs-empty">
            <strong>Clubs database not connected</strong>
            <span>{error}</span>
          </div>
        ) : clubs.length === 0 ? (
          <div className="clubs-empty">
            <strong>No official clubs yet.</strong>
            <span>The first four-player clubs will appear here after approval.</span>
          </div>
        ) : (
          <div className="clubs-grid">
            {clubs.map((club) => (
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