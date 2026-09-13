import Player from '../models/Player.js';
import Match from '../models/Match.js';
import Award from '../models/Award.js';
import Achievement from '../models/Achievement.js';
import {buildStatistics,milestoneRules,selectAwards} from './statistics.js';
let pending;
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
