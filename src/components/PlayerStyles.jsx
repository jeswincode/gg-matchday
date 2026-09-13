import useResource from './useResource';
import './player-styles.css';

export default function PlayerStyles({playerId,refreshKey}) {
  const {data,error,loading}=useResource(`/stats/player/${playerId}`,refreshKey);
  if (loading || error) return null;
  const styles=data?.styles;
  if (!styles || styles.status === 'developing') return <div className="player-styles developing" aria-label="Player style developing">Style developing…</div>;
  return <div className="player-styles" aria-label="Player style profile">
    {styles.styles.map(style => <span className="player-style-badge" key={style.key} tabIndex="0" title={style.description} aria-label={`${style.label}: ${style.description}`}>
      <span aria-hidden="true">{style.icon}</span><strong>{style.label}</strong>
      <span className="player-style-description" role="tooltip">{style.description}</span>
    </span>)}
  </div>;
}
