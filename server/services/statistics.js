// All GG ratings use the same period-scoped league cohort. No invented legacy ratings.
export const id = value => String(value?._id ?? value);
export const isClasico = name => /\bel\s+clasico\b/.test(String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " "));
export const round = n => Number(n.toFixed(2));
export const hasRating = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10;
export const sortOverall = (a,b) => (b.ggRating ?? -1)-(a.ggRating ?? -1) || (b.averageRating ?? -1)-(a.averageRating ?? -1) || b.winRate-a.winRate || b.goalContributions-a.goalContributions || b.cleanSheetRate-a.cleanSheetRate || b.matches-a.matches || a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId);
export const sortOffensive = (a,b) => (b.offensiveRating ?? -1)-(a.offensiveRating ?? -1) || b.goals-a.goals || b.assists-a.assists || (b.averageRating ?? -1)-(a.averageRating ?? -1) || b.matches-a.matches || a.name.localeCompare(b.name);
export const sortDefensive = (a,b) => (b.defensiveRating ?? -1)-(a.defensiveRating ?? -1) || b.cleanSheetRate-a.cleanSheetRate || b.cleanSheets-a.cleanSheets || b.winRate-a.winRate || (b.averageRating ?? -1)-(a.averageRating ?? -1) || a.name.localeCompare(b.name);
export function dateQuery(year,month) {
  if (!year) return {};
  year=Number(year); month=month == null ? null : Number(month);
  if (!Number.isInteger(year)||year<2000||year>2100||(month!==null&&(!Number.isInteger(month)||month<1||month>12))) throw new Error("Choose a valid year and month.");
  return {date:{$gte:new Date(Date.UTC(year,month ? month-1 : 0,1)),$lt:new Date(Date.UTC(month ? year : year+1,month || 0,1))}};
}
export function inPeriod(matches,year,month) { const q=dateQuery(year,month).date; return q ? matches.filter(m=>new Date(m.date)>=q.$gte&&new Date(m.date)<q.$lt) : matches; }
export function percentile(value,values) {
  if (!values.length) return null;
  if (values.length===1 || values.every(v=>v===values[0])) return 5;
  const lower=values.filter(v=>v<value).length, equal=values.filter(v=>v===value).length;
  return round(10*(lower+(equal-1)/2)/(values.length-1));
}
export function buildStatistics(players,matches,{minimumMatches=5}={}) {
 const stats=new Map(players.map(p=>[id(p),{playerId:id(p),name:p.name,profileImage:p.profileImage,position:p.position,preferredPositions:p.preferredPositions||[],clasicoSide:p.clasicoSide||"",matches:0,wins:0,draws:0,losses:0,goals:0,assists:0,ownGoals:0,cleanSheets:0,ratedMatches:0,ratingTotal:0,recent:[]} ]));
 for(const m of [...matches].sort((a,b)=>new Date(b.date)-new Date(a.date))) {
  for(const part of m.participants||[]) {
   const s=stats.get(id(part.player)); if(!s) continue;
   const own=Number(part.team==='A'?m.teamA.score:m.teamB.score),against=Number(part.team==='A'?m.teamB.score:m.teamA.score);
   const result=own>against?'W':own===against?'D':'L'; s.matches++; s[result==='W'?'wins':result==='D'?'draws':'losses']++; if(against===0)s.cleanSheets++;
   const ownGoals=Number(part.ownGoals||0); s.ownGoals+=Number.isFinite(ownGoals)&&ownGoals>0?ownGoals:0;
   if(hasRating(part.rating)){s.ratedMatches++;s.ratingTotal+=Math.max(0,part.rating-(Number.isFinite(ownGoals)?ownGoals:0));}
   if(s.recent.length<5)s.recent.push({matchId:id(m),date:m.date,result});
  }
  for(const e of m.events||[]){const s=stats.get(id(e.player));if(s&&['goal','assist'].includes(e.type))s[e.type==='goal'?'goals':'assists']++;}
 }
 const rows=[...stats.values()];
 for(const s of rows){s.goalContributions=s.goals+s.assists;s.winRate=s.matches?s.wins/s.matches:0;s.lossRate=s.matches?s.losses/s.matches:0;s.cleanSheetRate=s.matches?s.cleanSheets/s.matches:0;s.averageRating=s.ratedMatches?s.ratingTotal/s.ratedMatches:null;s.performanceRating=s.averageRating;s.resultScore=s.matches?5+(s.winRate-s.lossRate)*5:null;s.offensiveRaw=s.matches?(s.goals+s.assists*.75)/s.matches:0;s.defensiveRaw=s.cleanSheetRate+s.winRate*.5;s.eligible=s.matches>=minimumMatches;s.form=s.recent.length?Math.round(100*s.recent.reduce((n,r)=>n+(r.result==='W'?1:r.result==='D'?.5:0),0)/s.recent.length):null;delete s.ratingTotal;}
 const cohort=rows.filter(s=>s.eligible);
 for(const s of rows){s.offensiveRating=s.eligible?percentile(s.offensiveRaw,cohort.map(p=>p.offensiveRaw)):null;s.defensiveRating=s.eligible?percentile(s.defensiveRaw,cohort.map(p=>p.defensiveRaw)):null;s.ggRating=s.eligible&&s.averageRating!==null?round(s.averageRating*.4+s.offensiveRating*.2+s.defensiveRating*.2+s.resultScore*.2):null;s.minimumMatches=minimumMatches;}
 return rows.sort(sortOverall).map((s,i)=>({...s,rank:s.ggRating===null?null:i+1}));
}
export const milestoneRules={goals:[1,10,25,50,100,150,200],assists:[1,10,25,50,100],matches:[10,25,50,100,200,500],cleanSheets:[1,10,25,50,100]};
export function milestones(stats){return Object.entries(milestoneRules).map(([key,levels])=>{const value=stats[key],next=levels.find(n=>n>value)??Math.ceil((value+1)/100)*100;return {key,value,next,progress:Math.min(100,Math.round(100*value/next))};});}
export function selectAwards(players,matches,{year,month}={}) {
 const period=inPeriod(matches,year,month), min=month?3:5, rows=buildStatistics(players,period,{minimumMatches:min});
 const rated=rows.filter(s=>s.ggRating!==null), eligible=rows.filter(s=>s.eligible);
 const selections=[['player',rated[0],'ggRating'],['offensive',[...eligible].sort(sortOffensive)[0],'offensiveRating'],['defensive',[...eligible].sort(sortDefensive)[0],'defensiveRating']];
 if(!month){const cs=buildStatistics(players,period.filter(m=>isClasico(m.name)),{minimumMatches:3});selections.push(['golden-boot',[...eligible].filter(s=>s.goals>0).sort((a,b)=>b.goals-a.goals||b.assists-a.assists||sortOverall(a,b))[0],'goals'],['assist-leader',[...eligible].filter(s=>s.assists>0).sort((a,b)=>b.assists-a.assists||b.goals-a.goals||sortOverall(a,b))[0],'assists'],['clasico',cs.find(s=>s.ggRating!==null),'ggRating']);}
 return selections.filter(([,s])=>s).map(([type,s,key])=>({type,year:Number(year),month:month?Number(month):null,player:s.playerId,playerName:s.name,value:round(s[key]),metric:key}));
}
