import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Match from '../server/models/Match.js';

const a=new mongoose.Types.ObjectId();
const b=new mongoose.Types.ObjectId();

test('saving a match with populated participants preserves goal-event scores',async()=>{
 const match=new Match({date:new Date('2026-09-12'),name:'MOTM regression',teamA:{label:'Team A',score:0},teamB:{label:'Team B',score:0},participants:[{player:{_id:a,name:'Player A'},team:'A',rating:8},{player:{_id:b,name:'Player B'},team:'B',rating:8}],events:[{player:a,type:'goal'},{player:a,type:'goal'},{player:a,type:'goal'},{player:b,type:'goal'}]});
 await match.validate();
 assert.equal(match.teamA.score,3);
 assert.equal(match.teamB.score,1);
});

test('populated participant own goals still credit the opponent',async()=>{
 const match=new Match({date:new Date('2026-09-12'),name:'Own goal regression',teamA:{label:'Team A',score:0},teamB:{label:'Team B',score:0},participants:[{player:{_id:a,name:'Player A'},team:'A',rating:8,ownGoals:1},{player:{_id:b,name:'Player B'},team:'B',rating:8}],events:[{player:a,type:'goal'}]});
 await match.validate();
 assert.equal(match.teamA.score,1);
 assert.equal(match.teamB.score,1);
});

test('validating an existing legacy match with assist-only events preserves stored scores',async()=>{
 const match=Match.hydrate({
  _id:new mongoose.Types.ObjectId(),
  date:new Date('2026-09-12'),
  name:'Legacy assist-only score preservation',
  teamA:{label:'Team A',score:2},
  teamB:{label:'Team B',score:1},
  participants:[
   {player:a,team:'A',rating:8,defensivePerformance:7,ownGoals:0},
   {player:b,team:'B',rating:7,defensivePerformance:6,ownGoals:0},
  ],
  events:[{player:a,type:'assist'}],
 });
 await match.validate();
 assert.equal(match.teamA.score,2);
 assert.equal(match.teamB.score,1);
});
