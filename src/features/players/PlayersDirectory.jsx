import Squad from "../../components/Squad";

export default function PlayersDirectory({
  players,
  leaderboard,
  loadingPlayers,
  isEditor,
  newPlayerName,
  setNewPlayerName,
  playerActionLoading,
  addPlayer,
  onPlayer,
  onOpenPlayer,
}) {
  return (
    <>
      <div className="page-title">
        <p className="eyebrow">SQUAD</p>
        <h2>Players</h2>
        <p>Profiles, player details and career statistics.</p>
      </div>

      {isEditor && (
        <section className="card">
          <form onSubmit={addPlayer}>
            <label>
              <span>Add Player</span>
              <div className="add-player-form">
                <input
                  value={newPlayerName}
                  onChange={event => setNewPlayerName(event.target.value)}
                  placeholder="Player name"
                />
                <button
                  type="submit"
                  className="add-button"
                  disabled={playerActionLoading}
                >
                  {playerActionLoading ? "..." : "Add Player"}
                </button>
              </div>
            </label>
          </form>
        </section>
      )}

      <Squad players={players} statistics={leaderboard} onPlayer={onPlayer} />

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ROSTER</p>
            <h2>All Players</h2>
          </div>
          <span className="muted">{players.length}</span>
        </div>

        {loadingPlayers ? (
          <div className="loading-panel">Loading players...</div>
        ) : players.length === 0 ? (
          <div className="empty-state">
            <span>👥</span>
            <h3>No players yet</h3>
          </div>
        ) : (
          <div className="player-list">
            {players.map(player => (
              <button
                type="button"
                className="player-profile-row"
                key={player._id}
                onClick={() => onOpenPlayer(player)}
              >
                {player.profileImage ? (
                  <img
                    className="player-photo"
                    src={player.profileImage}
                    alt=""
                  />
                ) : (
                  <div className="player-avatar">
                    {player.name?.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="managed-player-info">
                  <strong>{player.name}</strong>
                  <span>{player.position || "Position not set"}</span>
                </div>

                <span className="profile-arrow">→</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
