import Player from '../models/Player.js';
import Match from '../models/Match.js';
import Award from '../models/Award.js';
import Achievement from '../models/Achievement.js';
import {buildStatistics,milestoneRules,selectAwards,getMatchScores} from './statistics.js';
let pending;
export async function repairMatchScores(){
 const matches=await Match.find().lean();
 const ops=[];
 for(const match of matches){const scores=getMatchScores(match);if(Number(match.teamA?.score)!==scores.teamA||Number(match.teamB?.score)!==scores.teamB)ops.push({updateOne:{filter:{_id:match._id},update:{$set:{'teamA.score':scores.teamA,'teamB.score':scores.teamB}}}});}
 if(ops.length)await Match.bulkWrite(ops,{ordered:false});
 return ops.length;
}
export function syncHistory(){
 if(pending)return pending;
 pending=(async()=>{
 const [players,matches]=await Promise.all([Player.find().lean(),Match.find().lean()]);
 const ops=[];
 for(const s of buildStatistics(players,matches)) for(const [key,levels] of Object.entries(milestoneRules)) for(const threshold of levels) if(s[key]>=threshold)ops.push({updateOne:{filter:{player:s.playerId,key:`${key}:${threshold}`},update:{$setOnInsert:{player:s.playerId,key:`${key}:${threshold}`,label:`${threshold} ${key==='cleanSheets'?'clean sheets':key}`}},upsert:true}});
 if(ops.length)await Achievement.bulkWrite(ops,{ordered:false});
 const now=new Date(),periods=new Map();
 for(const m of matches){const d=new Date(m.date),y=d.getUTCFullYear(),mo=d.getUTCMonth()+1;if(y<now.getUTCFullYear())periods.set(`${y}`,{year:y});if(new Date(Date.UTC(y,mo,1))<=now)periods.set(`${y}-${mo}`,{year:y,month:mo});}
 for(const period of periods.values())for(const a of selectAwards(players,matches,period))await Award.updateOne({key:`${a.type}:${a.year}:${a.month||0}`},{$setOnInsert:{...a,key:`${a.type}:${a.year}:${a.month||0}`}},{upsert:true});
 })().finally(()=>{pending=null;});return pending;
}
export function scheduleHistory(){syncHistory().catch(()=>console.error('Historical recognition could not be refreshed.'));}
