import { useWorkspaceBrand } from "../communities/WorkspaceBrand.jsx";
import {useLayoutEffect, useRef, useState} from "react";
import {formatDate} from "../../lib/date";
import {invalidateResources} from "../../lib/api";
import useResource from "../../components/useResource";
import Modal from "../../components/Modal";
import PlayerStyles from "../../components/PlayerStyles";
import ProfileInsights from "./ProfileInsights";
import AdminPreferredPositions from "../../components/AdminPreferredPositions";
import "./player-workspace.css";

function PlayerCard({ player, attributes, onShare }) {
  const brand = useWorkspaceBrand();
  const labels = [["pace","PACE"],["shooting","SHOOTING"],["passing","PASSING"],["dribbling","DRIBBLING"],["defending","DEFENDING"],["physical","PHYSICAL"]];
  return (
    <section className="card gg-player-card">
      <div className="gg-player-card-top">
        <div><p className="eyebrow">{brand.monogram} PLAYER CARD</p><h3>{player.name}</h3><span>{attributes?.position || player.position || "PLAYER"} · {attributes?.sampleStage || "unrated"}</span></div>
        <div className="gg-player-card-ovr"><strong>{attributes?.ovr ?? "—"}</strong><span>OVR</span></div>
      </div>
      <div className="gg-player-card-attrs">{labels.map(([key,label]) => <div key={key}><span>{label}</span><strong>{attributes?.attributes?.[key] ?? "—"}</strong></div>)}</div>
      <div className="gg-player-card-footer"><span>{attributes?.evidence?.matchesAnalyzed ?? 0} Match Record matches analyzed</span><button type="button" className="secondary-button" onClick={onShare}>Share Card</button></div>
    </section>
  );
}

function ProfileInfoItem({label,value}){
  return (
    <div className="profile-info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function PlayerProfile({
  player,
  isEditor,
  editingProfile,
  profileForm,
  onProfileFormChange,
  onOpenEditor,
  onCloseEditor,
  onSaveProfile,
  profileSaving,
  profileSaveError,
  playerReview,
  playerReviewLoading,
  onLoadPlayerReview,
  onDeletePlayer,
  onMatch,
  refreshKey,
  onBack,
  onClearReview,
  onRequestEdit,
  profileFocusRequest,
  visible = true,
}){
  const profileSection = useRef(null);
  const profileHeading = useRef(null);
  const stats = useResource("/stats/player/" + player._id, refreshKey);
  useLayoutEffect(() => {
    if (!profileFocusRequest) return;
    const frame = requestAnimationFrame(() => {
      if (!document.activeElement?.closest('[role="dialog"]')) profileHeading.current?.focus({ preventScroll: true });
      profileSection.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [profileFocusRequest]);
  const [attributesRevision,setAttributesRevision]=useState(0);
  const attributesPath = "/players/" + player._id + "/attributes";
  const {data: attributes, loading: attributesLoading, error: attributesError} =
    useResource(attributesPath, refreshKey + attributesRevision);
  const attributesReady = Boolean(attributes?.evidence);
  const profileBrand = useWorkspaceBrand();
  function loadAttributes() {
    invalidateResources([attributesPath]);
    setAttributesRevision(current => current + 1);
  }
  const shareCard=async()=>{
    const text=`${player.name} · ${attributes?.ovr ?? "Unrated"} OVR · ${profileBrand.name} Player Card`;
    if(navigator.share) await navigator.share({title:profileBrand.monogram + " Player Card",text});
    else if(navigator.clipboard) await navigator.clipboard.writeText(text);
  };
  const editProfile = isEditor ? onOpenEditor : onRequestEdit;
  const portrait = player.profileImage
    ? <img src={player.profileImage} alt={player.name} className="profile-large-photo" />
    : <span className="profile-photo-fallback" aria-hidden="true">{player.name?.charAt(0).toUpperCase()}</span>;

  return (
    <section className="player-profile" ref={profileSection} data-signature-page-enter>
    
      <button
        type="button"
        className="back-button"
        onClick={() => {
          onBack();
    
          onClearReview();
        }}
      >
        ← Back to Players
      </button>
    
      <section className={`profile-hero card profile-hero-media${player.backgroundVideoUrl ? " has-profile-video" : ""}`}>
        <div className="profile-hero-backdrop" aria-hidden="true">
          {visible && player.backgroundVideoUrl ? (
            <video
              className="profile-hero-video"
              src={player.backgroundVideoUrl}
              poster={player.profileImage || undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : player.profileImage ? (
            <img className="profile-hero-image" src={player.profileImage} alt="" />
          ) : null}
          <div className="profile-hero-shade" />
        </div>

        <div className="profile-photo-wrap profile-hero-foreground">
          {portrait}
        </div>

        <div className="profile-heading profile-hero-foreground">
    
          <p className="eyebrow">
            PLAYER PROFILE
          </p>
    
          <h2 ref={profileHeading} tabIndex={-1}>
            {
              player.name
            }
          </h2>
    
          <p>
            {
              player.position ||
              "Position not set"
            }
          </p>
          <PlayerStyles profile={stats.data?.styles} />
        </div>
        {editProfile && (
          <button type="button" className="secondary-button" aria-haspopup="dialog" onClick={editProfile}>
            {isEditor ? "Edit Profile" : "Request profile edit"}
          </button>
        )}
    
      </section>
    
      {visible && editingProfile && isEditor && (
        <Modal title="Edit player profile" onClose={onCloseEditor} className="gg-player-edit-modal">
    
          <form
            onSubmit={
              onSaveProfile
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
                    onProfileFormChange(
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
                    onProfileFormChange(
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
                        onProfileFormChange(
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
                    onProfileFormChange(
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
                    onProfileFormChange(
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
                  onProfileFormChange(
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
    
            {profileSaveError && <p className="global-message" role="alert">{profileSaveError}</p>}
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
    
            <AdminPreferredPositions key={player._id} player={player} />
          </form>
    
        </Modal>
      )}
        <>
          <div className="profile-info-grid">
    
            <ProfileInfoItem
              label="Height"
              value={
                player.height
                  ? `${player.height} cm`
                  : "—"
              }
            />
    
            <ProfileInfoItem
              label="Weight"
              value={
                player.weight
                  ? `${player.weight} kg`
                  : "—"
              }
            />
    
            <ProfileInfoItem
              label="Position"
              value={
                player.position ||
                "—"
              }
            />
    
            <ProfileInfoItem
              label="Preferred Foot"
              value={
                player.preferredFoot ||
                "—"
              }
            />
    
            <ProfileInfoItem
              label="Jersey"
              value={
                player.jerseyNumber ??
                "—"
              }
            />
    
            <ProfileInfoItem
              label="Date of Birth"
              value={
                formatDate(
                  player.dateOfBirth
                )
              }
            />
    
          </div>
    
          <ProfileInsights playerId={player._id} onMatch={onMatch} resource={stats} />
          <section className="card">
            <div className="section-heading"><div><p className="eyebrow">ATTRIBUTES & OVR</p><h3>Match-derived player profile</h3></div><button type="button" className="secondary-button" onClick={loadAttributes} disabled={attributesLoading}>{attributesLoading ? "Calculating..." : "Refresh"}</button></div>
            {attributesError ? <p className="muted">{attributesError}</p> : attributesLoading ? <p className="muted">Calculating from Match Record history...</p> : !attributesReady ? (
              <p className="muted">Player attributes are unavailable.</p>
            ) : <>
              <div className="profile-attributes-summary"><div><span>OVR</span><strong>{attributes.ovr ?? "—"}</strong></div><div><span>MATCHES</span><strong>{attributes.matchesPlayed}</strong></div><div><span>STATUS</span><strong>{attributes.sampleStage}</strong></div></div>
              <div className="profile-attributes-grid">{Object.entries(attributes.attributes || {}).map(([key,value]) => <div key={key}><span>{key.toUpperCase()}</span><strong>{value ?? "—"}</strong></div>)}</div>
              <p className="muted">Evidence: {attributes.evidence.matchesAnalyzed} Match Record matches analyzed. OVR is derived and is not stored as a manual player field.</p>
            </>}
          </section>
          {attributesReady && !attributesError && <PlayerCard player={player} attributes={attributes} onShare={shareCard} />}

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
                  onLoadPlayerReview(
                    player._id
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
                player.bio ||
                "No player bio added yet."
              }
            </p>

          </section>

          {isEditor && (
            <button
              type="button"
              className="danger-button"
              onClick={() =>
                onDeletePlayer(
                  player._id
                )
              }
            >
              Delete Player
            </button>
          )}

        </>
    
    </section>
  );
}
