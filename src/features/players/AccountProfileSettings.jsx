import CompanionSettings from "../companion/CompanionSettings";
import Modal from "../../components/Modal";
import FootballIdentity from "../communities/FootballIdentity";

export default function AccountProfileSettings({
  account, role, linked, theme, onTheme, onOpenPlayer, onEditPlayer, identity, onProfileSaved,
  canEdit, opening, error, onClose, companion, clasicoSide, onCompanionSave,
}) {
  return <Modal title="Account profile settings" onClose={onClose} className="gg-account-settings">
    <dl className="gg-account-details">
      <div><dt>Name</dt><dd>{identity?.profile.displayName || account.displayName || "Player"}</dd></div>
      {account.email && <div><dt>Email</dt><dd>{account.email}</dd></div>}
      <div><dt>Account role</dt><dd className="gg-account-role">{role || "viewer"}</dd></div>
    </dl>
    {identity && <FootballIdentity identity={identity} onSaved={onProfileSaved} />}
    <section className="gg-account-setting">
      <h3>Appearance</h3>
      <div className="gg-theme" role="group" aria-label="Account appearance">
        <button type="button" aria-pressed={theme === "dark"} onClick={() => onTheme("dark")}>Dark</button>
        <button type="button" aria-pressed={theme === "golden"} onClick={() => onTheme("golden")}>Gold</button>
      </div>
    </section>
    {onCompanionSave && <CompanionSettings name={identity?.profile.displayName || account.displayName} look={companion} role={role}
      clasicoSide={clasicoSide} onSave={onCompanionSave} />}
    {(role !== "admin" || (identity && linked)) && <section className="gg-account-setting">
      <h3>Linked player profile</h3>
      {linked ? <div className="gg-account-setting-actions">
        <button type="button" className="secondary-button" onClick={onOpenPlayer} disabled={opening}>
          {opening ? "Opening profile…" : "View player profile"}
        </button>
        <button type="button" className="secondary-button" onClick={onEditPlayer} disabled={opening}>
          {canEdit ? "Edit player profile" : "Request profile edit"}
        </button>
      </div> : <p className="muted">This account isn’t linked to a player.</p>}
      {error && <p className="global-message" role="alert">{error}</p>}
    </section>}
  </Modal>;
}
