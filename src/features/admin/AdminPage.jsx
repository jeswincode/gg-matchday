import { useWorkspaceBrand } from "../communities/WorkspaceBrand.jsx";

const ADMIN_GROUPS = [
  { heading:"WORKSPACE", items:[["overview","Overview","grid"]] },
  { heading:"PEOPLE & ACCESS", items:[["requests","Editor requests","inbox"],["editors","Active editors","users"],["profiles","Profile administration","users"]] },
  { heading:"PLAYER MANAGEMENT", items:[["attributes","OVR attributes","sliders"],["media","Profile videos","image"]] },
  { heading:"FOOTBALL INTEGRITY", items:[["audit","Match audit","clipboard"],["disputes","Rating disputes","flag"],["clubs","Clubs operations","building"]] },
  { heading:"PLATFORM", items:[["health","System health","pulse"],["permissions","Role permissions","shield"]] },
];
const ADMIN_DETAILS = {
 overview:["COMMAND CENTER","Overview","Everything you need to manage Matchday, organized around real tasks."],
 requests:["PEOPLE & ACCESS","Editor requests","Approve or reject requests for football editing privileges."],
 editors:["PEOPLE & ACCESS","Active editors","Review active editorial access and revoke it when needed."],
 profiles:["PEOPLE & ACCESS","Profile administration","Link accounts to players and review profile changes."],
 attributes:["PLAYER MANAGEMENT","OVR attributes","Adjust evaluated Pace and Physical with the existing validated workflow."],
 media:["PLAYER MANAGEMENT","Profile videos","Maintain each player's cinematic profile background."],
 audit:["FOOTBALL INTEGRITY","Match audit","Review persisted calculations and carefully migrate historical GG ratings."],
 disputes:["FOOTBALL INTEGRITY","Rating disputes","Investigate reports, record decisions and preserve the audit trail."],
 health:["PLATFORM","System health","Monitor databases, dependencies, request health and backup evidence."],
 permissions:["PLATFORM","Role permissions","Review the access model for viewers, editors and administrators."],
};
const ADMIN_PATHS = {
 grid:"M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
 inbox:"M4 4h16v14H4z M4 12h5l2 3h2l2-3h5",
 users:"M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M23 21v-2a4 4 0 0 0-3-3.87",
 sliders:"M4 7h16 M4 17h16 M8 4v6 M16 14v6",
 image:"M3 3h18v18H3z M7 8h.01 M3 17l5-5l4 4l3-3l6 6",
 clipboard:"M8 4h8 M9 2h6v4H9z M5 5H3v16h18V5h-2 M7 11h10 M7 16h8",
 flag:"M5 3v19 M5 4h13l-3 5l3 5H5",
 building:"M3 21h18 M5 21V5l7-3l7 3v16 M9 9h2 M14 9h2 M9 13h2 M14 13h2 M10 21v-4h4v4",
 pulse:"M3 12h4l3-7l4 14l3-7h4",
 shield:"M12 22s8-4 8-10V5l-8-3l-8 3v7c0 6 8 10 8 10z M9 12l2 2l4-4",
 back:"M19 12H5 M12 19l-7-7l7-7",
 next:"M9 18l6-6l-6-6",
 menu:"M4 6h16 M4 12h16 M4 18h16",
 close:"M6 6l12 12 M18 6L6 18",
};
function AdminIcon({name}) {
 return <svg viewBox="0 0 24 24" className="admin-icon" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={ADMIN_PATHS[name] || ADMIN_PATHS.grid}/></svg>;
}
import {useEffect, useRef, useState} from "react";
import DatabaseHealth from "../../components/DatabaseHealth";
import AccessDenied from "../../components/ui/AccessDenied";
import GGAdminPanel, { RatingDisputesPanel } from "./GGAdminPanel";
import "./admin-workspace.css";

export default function AdminPage({
  isAdmin,
  isSignedIn,
  signIn,
  onBackToMatchday,
  onOpenClubsAdmin,
  onOpenProfileAdmin,
  editorRequests,
  activeEditors,
  adminLoading,
  editorsLoading,
  adminActionLoading,
  handleEditorRequest,
  revokeEditor,
  players = [],
  onUpdatePlayerBackgroundVideo,
  onUpdatePlayerOvrAttributes,
}) {
  const brand = useWorkspaceBrand();
  const groups = brand.founding ? ADMIN_GROUPS : ADMIN_GROUPS.map(group => ({ ...group,
    items: group.items.filter(([id]) => id !== "health"),
  }));
  const [videoDrafts, setVideoDrafts] = useState(() =>
    Object.fromEntries(players.map(player => [String(player._id), player.backgroundVideoUrl || ""]))
  );
  const [savingVideoId, setSavingVideoId] = useState(null);
  const [ovrDrafts, setOvrDrafts] = useState(() =>
    Object.fromEntries(players.map(player => [
      String(player._id),
      {
        pace: player.pace ?? "",
        physical: player.physical ?? "",
      },
    ]))
  );
  const [savingOvrId, setSavingOvrId] = useState(null);

  const [section, setSection] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const contentRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = event => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);
  const choose = id => {
    if (id === "clubs") {
      setMenuOpen(false);
      onOpenClubsAdmin?.();
      return;
    }
    setSection(id);
    setMenuOpen(false);
    // Reset the independently scrolling desktop content pane on every section change.
    if (contentRef.current) contentRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
    if (id === "profiles") onOpenProfileAdmin();
    else window.requestAnimationFrame(() => contentRef.current?.focus({ preventScroll: true }));
  };
  const details = ADMIN_DETAILS[section] || ADMIN_DETAILS.overview;


  if (!isAdmin) return (
    <section className="tab-content admin-access-blocked">
      <button type="button" className="admin-back-link" onClick={onBackToMatchday}><AdminIcon name="back"/> Back to Matchday</button>
      <AccessDenied title="Admin access required" description="Only verified community administrators can access these controls." signIn={!isSignedIn ? signIn : null}/>
    </section>
  );
  return (
    <section className="admin-workspace tab-content" aria-label={brand.name + " admin control center"} data-signature-page-enter>
      <div className="admin-mobile-bar">
        <button type="button" className="admin-mobile-toggle" aria-label="Open admin sections" aria-controls="admin-sidebar" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><AdminIcon name="menu"/> Sections</button>
        <strong>{brand.monogram} / ADMIN</strong>
        <button type="button" className="admin-mobile-return" onClick={onBackToMatchday}><AdminIcon name="back"/> Matchday</button>
      </div>
      {menuOpen && <button type="button" className="admin-menu-scrim" aria-label="Close admin sections" onClick={() => setMenuOpen(false)}/>}
      <div className="admin-layout">
        <aside className={"admin-sidebar" + (menuOpen ? " admin-sidebar--open" : "")} id="admin-sidebar" aria-label="Admin sidebar">
          <div className="admin-sidebar-brand"><span className="admin-brand-icon"><AdminIcon name="shield"/></span><span><strong>{brand.name.toUpperCase()}</strong><small>ADMIN CONTROL CENTER</small></span><button className="admin-mobile-close" type="button" aria-label="Close admin sections" onClick={() => setMenuOpen(false)}><AdminIcon name="close"/></button></div>
          <button type="button" className="admin-sidebar-back" onClick={onBackToMatchday}><AdminIcon name="back"/> Back to Matchday</button>
          <nav aria-label="Administration sections" className="admin-sidebar-nav">
            {groups.map(group => <div className="admin-nav-group" key={group.heading}>
              <span className="admin-nav-heading">{group.heading}</span>
              {group.items.map(([id,label,icon]) => <button key={id} type="button" className={"admin-nav-item" + (section === id ? " admin-nav-item--active" : "")} aria-current={section === id ? "page" : undefined} onClick={() => choose(id)}><AdminIcon name={icon}/><span>{label}</span>{id === "requests" && !adminLoading && editorRequests.length > 0 && <small className="admin-queue-count">{editorRequests.length}</small>}{id === "clubs" && <span className="admin-external-mark">↗</span>}</button>)}
            </div>)}
          </nav>
          <div className="admin-session"><span className="admin-session-light"/><span><strong>Administrator session</strong><small>Permission-protected controls</small></span></div>
        </aside>
        <div id="admin-main-content" className="admin-main-content" tabIndex={-1} ref={contentRef}>
          <header className="admin-hero">
            <div className="admin-breadcrumb"><span>Administration</span><AdminIcon name="next"/><strong>{details[0]}</strong></div>
            <div className="admin-hero-row"><div><span className="admin-eyebrow">{details[0]}</span><h2>{details[1]}</h2><p>{details[2]}</p></div><span className="admin-authorized"><AdminIcon name="shield"/> Administrator</span></div>
          </header>
          <div className="admin-section-body">
            {section === "overview" && (
              <div className="admin-overview">
                <div className="admin-welcome"><div><span className="admin-eyebrow">COMMAND OVERVIEW</span><h3>All your tools. One clear workspace.</h3><p>Review requests, manage player data, audit ratings or check platform health without scrolling through unrelated controls.</p></div><span className="admin-welcome-symbol"><AdminIcon name="shield"/></span></div>
                <div className="admin-kpi-grid">
                  <button type="button" className="admin-kpi" onClick={() => choose("requests")}><span>Pending requests</span><strong>{adminLoading ? "—" : editorRequests.length}</strong><small>Review requests <AdminIcon name="next"/></small></button>
                  <button type="button" className="admin-kpi" onClick={() => choose("editors")}><span>Active editors</span><strong>{editorsLoading ? "—" : activeEditors.length}</strong><small>Manage access <AdminIcon name="next"/></small></button>
                  <button type="button" className="admin-kpi" onClick={() => choose("attributes")}><span>Player profiles</span><strong>{players.length}</strong><small>Manage players <AdminIcon name="next"/></small></button>
                </div>
                <div className="admin-task-heading"><div><span className="admin-eyebrow">QUICK ACTIONS</span><h3>Choose a workspace</h3></div><p>Each area contains only the actions relevant to that task.</p></div>
                <div className="admin-task-grid">
                  {[["requests","inbox","ACCESS","Editor requests","Approve and reject editing access."],["attributes","sliders","PLAYERS","OVR attributes","Review player Pace and Physical."],["audit","clipboard","MATCH RECORDS","Historical match audit","Investigate GG-v3 rating integrity."],["disputes","flag","REVIEW","Rating disputes","Resolve player-reported issues."],["health","pulse","PLATFORM","System health","Check database and API operations."],["clubs","building","CLUBS","Clubs operations","Open the dedicated Clubs admin console."]].filter(([id]) => id !== "health" || brand.founding).map(([id,icon,eyebrow,title,description]) =>
                    <button className="admin-task" type="button" key={id} onClick={() => choose(id)}><span className="admin-task-icon"><AdminIcon name={icon}/></span><span><small>{eyebrow}</small><strong>{title}</strong><span>{description}</span></span><AdminIcon name="next"/></button>
                  )}
                </div>
              </div>
            )}
            {section === "profiles" && (
              <button type="button" className="secondary-button" onClick={onOpenProfileAdmin}>Open profile administration</button>
            )}
            {section === "requests" && (<>
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
</>)}
            {section === "editors" && (<>
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
</>)}
            {section === "attributes" && (<>
<section className="card gg-admin-video-manager">
            <div className="section-heading">
              <div>
                <p className="eyebrow">PLAYER OVR</p>
                <h3>Manual Pace & Physical</h3>
                <p className="muted">Admin-only. Record these two attributes after properly evaluating each player. OVR is recalculated automatically after saving.</p>
              </div>
              <span className="muted">{players.length}</span>
            </div>

            {!players.length ? (
              <div className="empty-state">No players available.</div>
            ) : (
              <div className="gg-admin-video-list">
                {players.map(player => {
                  const id = String(player._id);
                  const draft = ovrDrafts[id] || { pace: player.pace ?? "", physical: player.physical ?? "" };
                  const unchanged =
                    String(draft.pace ?? "") === String(player.pace ?? "") &&
                    String(draft.physical ?? "") === String(player.physical ?? "");

                  return (
                    <div className="gg-admin-video-row" key={id}>
                      <div className="gg-admin-video-player">
                        {player.profileImage ? <img src={player.profileImage} alt="" /> : <span>{player.name?.charAt(0)?.toUpperCase() || "P"}</span>}
                        <div>
                          <strong>{player.name}</strong>
                          <small>{player.position || "Position not set"}</small>
                        </div>
                      </div>
                      <div className="gg-admin-ovr-fields">
                        <label className="gg-admin-video-field">
                          <span>Pace (1–99)</span>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            step="1"
                            placeholder="—"
                            value={draft.pace}
                            onChange={event => setOvrDrafts(current => ({
                              ...current,
                              [id]: { ...(current[id] || {}), pace: event.target.value },
                            }))}
                          />
                        </label>
                        <label className="gg-admin-video-field">
                          <span>Physical (1–99)</span>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            step="1"
                            placeholder="—"
                            value={draft.physical}
                            onChange={event => setOvrDrafts(current => ({
                              ...current,
                              [id]: { ...(current[id] || {}), physical: event.target.value },
                            }))}
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="save-button"
                        disabled={unchanged || savingOvrId === id}
                        onClick={async () => {
                          try {
                            setSavingOvrId(id);
                            const result = await onUpdatePlayerOvrAttributes(
                              id,
                              draft.pace === "" ? null : Number(draft.pace),
                              draft.physical === "" ? null : Number(draft.physical),
                            );
                            const updated = result?.player;
                            setOvrDrafts(current => ({
                              ...current,
                              [id]: {
                                pace: updated?.pace ?? "",
                                physical: updated?.physical ?? "",
                              },
                            }));
                          } catch {
                            // App-level message reports the server error.
                          } finally {
                            setSavingOvrId(null);
                          }
                        }}
                      >
                        {savingOvrId === id ? "Saving…" : "Save OVR"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
</>)}
            {section === "media" && (<>
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
                  const value = videoDrafts[id] ?? player.backgroundVideoUrl ?? "";
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
                            setVideoDrafts(current => ({...current, [id]: value.trim()}));
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
</>)}
            {section === "audit" && <GGAdminPanel/>}
            {section === "disputes" && <RatingDisputesPanel/>}
            {section === "health" && <DatabaseHealth/>}
            {section === "permissions" && (<>
<section className="formula-card">
            <p className="eyebrow">PERMISSIONS</p>
            <h3>{brand.name} access</h3>

            <div className="permission-model">
              <div>
                <strong>Viewer</strong>
                <span>View the public archive and linked player features.</span>
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
</>)}
          </div>
          <div className="admin-workspace-foot"><span>{brand.name} · Administration · Made by Jeswin</span><button type="button" onClick={onBackToMatchday}><AdminIcon name="back"/> Return to Matchday</button></div>
        </div>
      </div>
    </section>
  );
}
