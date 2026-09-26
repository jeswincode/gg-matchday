import {formatDate} from "../../lib/date";

export default function MatchHistoryCard({match,canEdit,onEdit,onDelete,onOpen}){
  const scorers=team=>{
    const ids=new Set((match.participants||[]).filter(p=>p.team===team).map(p=>String(p.player?._id||p.player)));
    const counts=new Map();
    for(const e of match.events||[]) if(e.type==='goal'&&ids.has(String(e.player?._id||e.player))){
      const name=e.player?.name||'Player';
      counts.set(name,(counts.get(name)||0)+1);
    }
    return [...counts].map(([name,n])=>`${name}(${n})`).join(', ')||'—';
  };
  return <article className="match-card"><button className="gg-match-open" onClick={onOpen}><div className="match-main"><div><p className="match-date">{formatDate(match.date)}</p><h3>{match.name}</h3></div><div className="match-score"><strong>{match.teamA.score}–{match.teamB.score}</strong><span>{match.teamA.score===match.teamB.score?'DRAW':'FINAL'}</span></div></div><div className="v14-history-summary"><div className="v14-history-team"><strong>{match.teamA.label}</strong><div className="v14-history-scorers">{scorers('A')}</div></div><div className="v14-history-team v14-history-team-b"><strong>{match.teamB.label}</strong><div className="v14-history-scorers">{scorers('B')}</div></div></div><small className="muted">View match details →</small></button>{canEdit&&<div className="match-actions"><button className="secondary-button" onClick={onEdit}>Edit</button><button className="danger-button" onClick={onDelete}>Delete</button></div>}</article>;
}
