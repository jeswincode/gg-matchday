import {useEffect, useState} from "react";
import DatabaseHealth from "../../components/DatabaseHealth";
import AccessDenied from "../../components/ui/AccessDenied";
import GGAdminPanel from "./GGAdminPanel";

export default function AdminPage({
  isAdmin,
  isSignedIn,
  signIn,
  editorRequests,
  activeEditors,
  adminLoading,
  editorsLoading,
  adminActionLoading,
  handleEditorRequest,
  revokeEditor,
  players = [],
  onUpdatePlayerBackgroundVideo,
}) {
  const [videoDrafts, setVideoDrafts] = useState({});
  const [savingVideoId, setSavingVideoId] = useState(null);

  useEffect(() => {
    setVideoDrafts(Object.fromEntries(players.map(player => [String(player._id), player.backgroundVideoUrl || ""])));
  }, [players]);
  return (
    <section className="tab-content">
      {!isAdmin ? (
        <AccessDenied
          title="Admin access required"
          description="This area is only available to the GG Matchday administrator."
          signIn={!isSignedIn ? signIn : null}
        />
      ) : (
        <>
          <div className="page-title">
            <p className="eyebrow">ADMIN</p>
            <h2>Access Control</h2>
            <p>Manage editor requests and active editors.</p>
          </div>

          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">REQUESTS</p>
                <h3>Editor Requests</h3>
              </div>
              <span className="muted">{editorRequests.length}</span>
            </div>

            {adminLoading ? (
              <div className="loading-panel">Loading requests...</div>
            ) : editorRequests.length === 0 ? (
              <div className="empty-state">
                <span>✅</span>
                <h3>No pending requests</h3>
                <p>You're all caught up.</p>
              </div>
            ) : (
              <div className="admin-request-list">
                {editorRequests.map(request => (
                  <div className="admin-request" key={request._id}>
                    <div className="admin-request-user">
                      {request.photoURL ? (
                        <img src={request.photoURL} alt="" />
                      ) : (
                        <div className="admin-request-avatar">
                          {request.name?.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div>
                        <strong>{request.name || "User"}</strong>
                        <span>{request.email}</span>
                      </div>
                    </div>

                    <div className="admin-request-actions">
                      <button
                        type="button"
                        className="approve-button"
                        disabled={adminActionLoading}
                        onClick={() => handleEditorRequest(request._id, "approve")}
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        disabled={adminActionLoading}
                        onClick={() => handleEditorRequest(request._id, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TEAM ACCESS</p>
                <h3>Active Editors</h3>
              </div>
              <span className="muted">{activeEditors.length}</span>
            </div>

            {editorsLoading ? (
              <div className="loading-panel">Loading editors...</div>
            ) : activeEditors.length === 0 ? (
              <div className="empty-state">
                <span>✏️</span>
                <h3>No active editors</h3>
              </div>
            ) : (
              <div className="admin-request-list">
                {activeEditors.map(editor => (
                  <div className="admin-request" key={editor._id}>
                    <div className="admin-request-user">
                      {editor.photoURL ? (
                        <img src={editor.photoURL} alt="" />
                      ) : (
                        <div className="admin-request-avatar">
                          {editor.name?.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="admin-request-copy">
                        <strong>{editor.name}</strong>
                        <span>{editor.email}</span>
                        <small>Editor</small>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="danger-button"
                      disabled={adminActionLoading}
                      onClick={() => revokeEditor(editor._id)}
                    >
                      Remove Editor
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card gg-admin-video-manager">
            <div className="section-heading">
              <div>
                <p className="eyebrow">PLAYER IDENTITY</p>
                <h3>Background Videos</h3>
                <p className="muted">Admin-only. Add a background video URL for a player's profile hero.</p>
              </div>
              <span className="muted">{players.length}</span>
            </div>

            {!players.length ? (
              <div className="empty-state">No players available.</div>
            ) : (
              <div className="gg-admin-video-list">
                {players.map(player => {
                  const id = String(player._id);
                  const value = videoDrafts[id] ?? "";
                  const unchanged = value === (player.backgroundVideoUrl || "");
                  return (
                    <div className="gg-admin-video-row" key={id}>
                      <div className="gg-admin-video-player">
                        {player.profileImage ? <img src={player.profileImage} alt="" /> : <span>{player.name?.charAt(0)?.toUpperCase() || "P"}</span>}
                        <div>
                          <strong>{player.name}</strong>
                          <small>{player.position || "Position not set"}</small>
                        </div>
                      </div>
                      <label className="gg-admin-video-field">
                        <span>Video URL</span>
                        <input
                          type="url"
                          inputMode="url"
                          placeholder="https://…/player-highlight.mp4"
                          value={value}
                          onChange={event => setVideoDrafts(current => ({...current, [id]: event.target.value}))}
                        />
                      </label>
                      <button
                        type="button"
                        className="save-button"
                        disabled={unchanged || savingVideoId === id}
                        onClick={async () => {
                          try {
                            setSavingVideoId(id);
                            await onUpdatePlayerBackgroundVideo(id, value.trim());
                          } catch {
                            // App-level message reports the server error.
                          } finally {
                            setSavingVideoId(null);
                          }
                        }}
                      >
                        {savingVideoId === id ? "Saving…" : "Save Video"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <DatabaseHealth />
          <GGAdminPanel />

          <section className="formula-card">
            <p className="eyebrow">PERMISSIONS</p>
            <h3>GG Matchday access</h3>

            <div className="permission-model">
              <div>
                <strong>Viewer</strong>
                <span>View the public archive and upload Gallery photos.</span>
              </div>
              <div>
                <strong>Editor</strong>
                <span>Manage matches, players and football data.</span>
              </div>
              <div>
                <strong>Admin</strong>
                <span>Full access plus user management.</span>
              </div>
            </div>

            <p>
              Removing editor access changes the user's role back to viewer without
              deleting their account or history.
            </p>
          </section>
        </>
      )}
    </section>
  );
}
