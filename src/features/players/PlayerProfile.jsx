import {formatDate} from "../../lib/date";
import ProfileInsights from "../../components/ProfileInsights";

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
  onToggleEditing,
  onSaveProfile,
  profileSaving,
  playerReview,
  playerReviewLoading,
  onLoadPlayerReview,
  onDeletePlayer,
  onMatch,
  refreshKey,
  onBack,
  onClearReview,
}){
  return (
    <section className="player-profile">
    
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
    
      <section className="profile-hero card">
    
        <div className="profile-photo-wrap">
    
          {player.profileImage ? (
            <img
              src={
                player.profileImage
              }
              alt={
                player.name
              }
              className="profile-large-photo"
            />
          ) : (
            <div className="profile-photo-fallback">
              {
                player.name
                  ?.charAt(
                    0
                  )
                  .toUpperCase()
              }
            </div>
          )}
    
        </div>
    
        <div className="profile-heading">
    
          <p className="eyebrow">
            PLAYER PROFILE
          </p>
    
          <h2>
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
    
        </div>
    
        {isEditor && (
          <button
            type="button"
            className="secondary-button"
            onClick={onToggleEditing}
          >
            {
              editingProfile
                ? "Cancel"
                : "Edit Profile"
            }
          </button>
        )}
    
      </section>
    
      {editingProfile &&
      isEditor ? (
        <section className="card">
    
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
    
          </form>
    
        </section>
      ) : (
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
    
          <ProfileInsights playerId={player._id} onMatch={onMatch} refreshKey={refreshKey}/>
    
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
      )}
    
    </section>
  );
}
