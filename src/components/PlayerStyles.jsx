import './player-styles.css';

export default function PlayerStyles({ profile }) {
  if (!profile) return null;
  if (profile.status === "developing") {
    return <div className="player-styles developing">Style developing…</div>;
  }
  return <div className="player-styles" aria-label="Player style profile">
    {profile.styles.map(style => <span className="player-style-badge" key={style.key}
      tabIndex={0} aria-label={`${style.label}: ${style.description}`}>
      <span aria-hidden="true">{style.icon}</span>
      <strong>{style.label}</strong>
      <span className="player-style-description" role="tooltip">{style.description}</span>
    </span>)}
  </div>;
}
