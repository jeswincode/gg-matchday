const row=(labels,y)=>labels.map((position,i)=>({position,x:((i+1)/(labels.length+1))*100,y}));
export const formations={
 '4-3-3':[...row(['LW','ST','RW'],13),...row(['CM','CM'],38),...row(['CDM'],57),...row(['LB','CB','CB','RB'],75),...row(['GK'],94)],
 '4-4-2':[...row(['ST','ST'],13),...row(['LM','CM','CM','RM'],44),...row(['LB','CB','CB','RB'],75),...row(['GK'],94)],
 '4-2-3-1':[...row(['ST'],10),...row(['LM','CAM','RM'],31),...row(['CDM','CDM'],54),...row(['LB','CB','CB','RB'],76),...row(['GK'],94)],
 '4-2-4':[...row(['LW','ST','ST','RW'],13),...row(['CM','CM'],46),...row(['LB','CB','CB','RB'],75),...row(['GK'],94)],
 '3-5-2':[...row(['ST','ST'],12),...row(['CAM'],33),...row(['LM','CM','CM','RM'],54),...row(['CB','CB','CB'],77),...row(['GK'],94)],
 '3-4-3':[...row(['LW','ST','RW'],13),...row(['LM','CM','CM','RM'],46),...row(['CB','CB','CB'],77),...row(['GK'],94)],
 '4-1-4-1':[...row(['ST'],10),...row(['LM','CM','CM','RM'],32),...row(['CDM'],55),...row(['LB','CB','CB','RB'],76),...row(['GK'],94)]
};
// Maximum-weight assignment over 11 slots: fit is mandatory; fill count then performance.
export function selectSquad(players,statistics,formation){const slots=formations[formation]||formations['4-3-3'],ratings=new Map(statistics.map(s=>[String(s.playerId),s.ggRating]));let states=new Map([[0,{score:0,assignments:[]}]]);
 for(const player of [...players].sort((a,b)=>String(a._id).localeCompare(String(b._id)))){const next=new Map(states);for(const [mask,state] of states)for(let i=0;i<slots.length;i++)if(!(mask&(1<<i))&&(player.preferredPositions||[]).includes(slots[i].position)){const score=state.score+100+(ratings.get(String(player._id))??0),newMask=mask|(1<<i);if(!next.has(newMask)||next.get(newMask).score<score)next.set(newMask,{score,assignments:[...state.assignments,{player,slot:i,...slots[i]}]});}states=next;}
 const best=[...states.values()].sort((a,b)=>b.score-a.score)[0];const chosen=new Set(best.assignments.map(a=>String(a.player._id)));return {starting:best.assignments,bench:players.filter(p=>!chosen.has(String(p._id))),slots};}
