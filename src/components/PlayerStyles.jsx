import {createPortal} from 'react-dom';
import {useEffect,useState} from 'react';
import useResource from './useResource';
import './player-styles.css';

export default function PlayerStyles({playerId,refreshKey}) {
  const {data,error,loading}=useResource(`/stats/player/${playerId}`,refreshKey);
  const [target,setTarget]=useState(null);
  useEffect(()=>{setTarget(document.querySelector('.profile-heading'));},[playerId]);
  if (!target || loading || error) return null;
  const styles=data?.styles;
  const content=!styles || styles.status==='developing'
    ? <div className="player-styles developing" aria-label="Player style developing">Style developing…</div>
    : <div className="player-styles" aria-label="Player style profile">{styles.styles.map(style=><span className="player-style-badge" key={style.key} tabIndex="0" title={style.description} aria-label={`${style.label}: ${style.description}`}><span aria-hidden="true">{style.icon}</span><strong>{style.label}</strong><span className="player-style-description" role="tooltip">{style.description}</span></span>)}</div>;
  return createPortal(content,target);
}
