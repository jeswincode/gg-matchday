import test,{before,after,mock} from 'node:test';import assert from 'node:assert/strict';import mongoose from 'mongoose';import {MongoMemoryReplSet} from 'mongodb-memory-server';
process.env.ADMIN_EMAIL='admin@example.invalid';process.env.GEMINI_API_KEY='';process.env.CHAT_ENABLED='true';
mock.module('../server/config/firebaseAdmin.js',{defaultExport:()=>({verifyIdToken:async token=>{if(!['admin','viewer','other'].includes(token))throw new Error('Invalid test token');return {uid:`test-${token}`,email:`${token}@example.invalid`,name:`Test ${token}`};}})});
const {default:app}=await import('../server/app.js');const {default:User}=await import('../server/models/User.js');const {default:Match}=await import('../server/models/Match.js');const {default:Player}=await import('../server/models/Player.js');const {default:Award}=await import('../server/models/Award.js');const {default:Achievement}=await import('../server/models/Achievement.js');const {default:Vote}=await import('../server/models/Vote.js');const {default:ProfileChangeRequest}=await import('../server/models/ProfileChangeRequest.js');const {default:ChatMessage}=await import('../server/models/ChatMessage.js');const {syncHistory}=await import('../server/services/history.js');
let database,server,origin,p1,p2,matchId,viewer;
async function request(path,{token,method='GET',body}={}){const response=await fetch(origin+'/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
before(async()=>{database=await MongoMemoryReplSet.create({binary:{version:'8.2.6'},replSet:{count:1}});await mongoose.connect(database.getUri());await Promise.all([User,Match,Player,Award,Achievement,Vote,ProfileChangeRequest,ChatMessage].map(m=>m.init()));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));origin=`http://127.0.0.1:${server.address().port}`;for(const token of ['admin','viewer','other'])await request('/auth/me',{token});viewer=await User.findOne({firebaseUid:'test-viewer'});p1=await Player.create({name:'Test Forward'});p2=await Player.create({name:'Test Keeper'});}, {timeout:120000});
after(async()=>{await syncHistory().catch(()=>{});server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));await mongoose.disconnect();await database?.stop();});
const payload=()=>({date:'2026-01-04',name:'Test Sunday',teamA:{label:'Test A',score:99},teamB:{label:'Test B',score:99},participants:[{player:String(p1._id),team:'A',rating:8.9,defensivePerformance:8},{player:String(p2._id),team:'B',rating:7,defensivePerformance:6}],events:[{player:String(p1._id),type:'goal'}]});
test('health reports both database connections and invalid player ids are client errors',async()=>{const health=await request('/health');assert.equal(health.status,503);assert.equal(health.data.status,'degraded');assert.equal(health.data.database,'connected');assert.equal(health.data.clubsDatabase,'disconnected');const invalid=await request('/players/not-an-object-id');assert.equal(invalid.status,400);assert.equal(invalid.data.message,'Invalid resource id.');});
test('API rejects unauthenticated and viewer match writes',async()=>{assert.equal((await request('/matches',{method:'POST',body:payload()})).status,401);assert.equal((await request('/matches',{token:'viewer',method:'POST',body:payload()})).status,403);assert.equal((await request('/auth/me',{token:'invalid'})).status,401);});
test('new match requires GG performance codes and derives ratings from the Record-tab inputs',async()=>{const bad=payload();delete bad.participants[0].rating;assert.equal((await request('/matches',{token:'admin',method:'POST',body:bad})).status,400);const good=payload();good.teamA.score=1;good.teamB.score=0;good.participants=good.participants.map(p=>({player:p.player,team:p.team,ownGoals:0,performanceCodes:[]}));const result=await request('/matches',{token:'admin',method:'POST',body:good});assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(result.data.match.teamA.score,1);assert.equal(result.data.match.teamB.score,0);assert.equal(result.data.match.participants[0].rating,7.3);assert.equal(result.data.match.participants[0].defensivePerformance,6.5);assert.equal(result.data.match.participants[0].ratingSystem,'gg-v3');matchId=result.data.match._id;});
test('GG-v3 matches calculate match and defensive ratings from performance codes',async()=>{const body=payload();body.teamA.score=99;body.teamB.score=99;body.participants=[{player:String(p1._id),team:'A',ownGoals:0,performanceCodes:['finisher','wall']},{player:String(p2._id),team:'B',ownGoals:0,performanceCodes:['hero']}];body.events=[{player:String(p1._id),type:'goal'}];const result=await request('/matches',{token:'admin',method:'POST',body});assert.equal(result.status,201,JSON.stringify(result.data));const a=result.data.match.participants.find(p=>String(p.player._id||p.player)===String(p1._id));const b=result.data.match.participants.find(p=>String(p.player._id||p.player)===String(p2._id));assert.equal(result.data.match.teamA.score,1);assert.equal(result.data.match.teamB.score,0);assert.equal(a.ratingSystem,'gg-v3');assert.deepEqual(a.performanceCodes,['wall','finisher']);assert.equal(a.rating,7.9);assert.equal(a.defensivePerformance,8.9);assert.equal(b.rating,5.9);assert.equal(b.defensivePerformance,7.6);});
test('legacy missing ratings and defensive data survive an edit without fabrication',async()=>{const old=payload();old.participants=old.participants.map(p=>({...p,rating:null,defensivePerformance:null}));old.teamA.score=1;old.teamB.score=0;const stored=await Match.create(old);const update=await request(`/matches/${stored._id}`,{token:'admin',method:'PUT',body:old});assert.equal(update.status,200,JSON.stringify(update.data));assert.equal(update.data.match.participants[0].rating,null);assert.equal(update.data.match.participants[0].defensivePerformance,null);});
test('legacy eventless matches preserve their stored score during a safe edit',async()=>{const old=payload();old.events=[];old.teamA.score=2;old.teamB.score=1;old.participants=old.participants.map(p=>({...p,rating:null,defensivePerformance:null}));const stored=await Match.collection.insertOne({...old,_id:new mongoose.Types.ObjectId(),date:new Date(old.date)});const update=await request(`/matches/${stored.insertedId}`,{token:'admin',method:'PUT',body:old});assert.equal(update.status,200,JSON.stringify(update.data));assert.equal(update.data.match.teamA.score,2);assert.equal(update.data.match.teamB.score,1);assert.equal(update.data.match.events.length,0);});
test('Gemini debug route is not swallowed by the generic news id route',async()=>{const result=await request('/news/debug/gemini',{token:'admin'});assert.equal(result.status,200);assert.equal(result.data.success,true);});
test('own goals award the opponent score and persist on the participant',async()=>{const body=payload();body.participants=body.participants.map(p=>({...p,performanceCodes:[]}));body.participants[0].ownGoals=1;const result=await request('/matches',{token:'admin',method:'POST',body});assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(result.data.match.teamA.score,1);assert.equal(result.data.match.teamB.score,1);assert.equal(result.data.match.participants.find(p=>String(p.player._id||p.player)===String(p1._id)).ownGoals,1);assert.equal(result.data.match.events.filter(e=>e.type==='goal').length,1);});
test('votes are final, only participants can receive votes, concurrent duplicate votes cannot win',async()=>{assert.equal((await request(`/matches/${matchId}/votes`,{method:'POST',body:{playerId:String(p1._id)}})).status,401);assert.equal((await request(`/matches/${matchId}/votes`,{token:'viewer',method:'POST',body:{playerId:String(new mongoose.Types.ObjectId())}})).status,400);const results=await Promise.all([1,2].map(()=>request(`/matches/${matchId}/votes`,{token:'viewer',method:'POST',body:{playerId:String(p1._id)}})));assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(await Vote.countDocuments({match:matchId,voter:viewer._id}),1);assert.equal((await request(`/matches/${matchId}/votes`,{token:'viewer',method:'POST',body:{playerId:String(p2._id)}})).status,409);});
test('admin finalization stores permanent MOTM and leaves GG Rating unchanged',async()=>{const before=(await request(`/stats/player/${p1._id}`)).data.stats;assert.equal((await request(`/matches/${matchId}/finalize-vote`,{token:'viewer',method:'POST'})).status,403);const final=await request(`/matches/${matchId}/finalize-vote`,{token:'admin',method:'POST'});assert.equal(final.status,200,JSON.stringify(final.data));assert.equal((await request(`/matches/${matchId}/votes`,{token:'other',method:'POST',body:{playerId:String(p2._id)}})).status,409);assert.equal(await Award.countDocuments({key:`motm:${matchId}`,player:p1._id}),1);const after=(await request(`/stats/player/${p1._id}`)).data.stats;assert.equal(after.ggRating,before.ggRating);assert.equal(after.averageRating,before.averageRating);});
test('linked-profile preference request cannot target another player and needs approval',async()=>{assert.equal((await request('/profile-requests',{token:'viewer',method:'POST',body:{playerId:String(p1._id),changes:{preferredPositions:['ST']}}})).status,403);assert.equal((await request('/profile-requests/admin/link',{token:'admin',method:'POST',body:{userId:String(viewer._id),playerId:String(p1._id)}})).status,200);assert.equal((await request('/profile-requests',{token:'viewer',method:'POST',body:{playerId:String(p2._id),changes:{preferredPositions:['ST']}}})).status,403);const rq=await request('/profile-requests',{token:'viewer',method:'POST',body:{playerId:String(p1._id),changes:{preferredPositions:['ST','LW'],clasicoSide:'Messi'}}});assert.equal(rq.status,201,JSON.stringify(rq.data));assert.deepEqual((await Player.findById(p1._id)).preferredPositions,[]);assert.equal((await request(`/profile-requests/admin/${rq.data._id}/approve`,{token:'admin',method:'POST'})).status,200);assert.deepEqual((await Player.findById(p1._id)).preferredPositions,['ST','LW']);assert.equal((await request('/profile-requests',{token:'viewer',method:'POST',body:{playerId:String(p1._id),changes:{clasicoSide:'Ronaldo'}}})).status,400);});
test('chat allows three monthly messages atomically and persists only five-day chat records',async()=>{const results=await Promise.all([1,2,3,4].map(()=>request('/chat',{token:'viewer',method:'POST',body:{message:'Temporary test message'}})));assert.deepEqual(results.map(r=>r.status).sort(),[201,201,201,409]);assert.ok(results.filter(r=>r.status===201).every(r=>r.data.message?.text==='Temporary test message'));const user=await User.findById(viewer._id).lean();assert.ok(user.chatMonth);assert.equal(user.chatMessagesUsed,3);assert.ok(await ChatMessage.exists({text:'Temporary test message'}));assert.equal((await request('/chat',{token:'other'})).data.messages.length,3);assert.equal((await request('/chat',{token:'other',method:'POST',body:{message:'x'.repeat(501)}})).status,400);});
test('GG audit and migration are admin-only',async()=>{
  assert.equal((await request('/admin/gg/audit')).status,401);
  assert.equal((await request('/admin/gg/audit',{token:'viewer'})).status,403);
  assert.equal((await request(`/admin/gg/migration/${matchId}`,{token:'viewer'})).status,403);
});

test('historical GG migration recalculates canonically and changes only rating fields on voted matches',async()=>{
  const before=await Match.findById(matchId).lean();
  assert.ok(await Vote.exists({match:matchId}));
  const participants=before.participants.map(p=>({playerId:String(p.player),performanceCodes:p.player.toString()===p1._id.toString()?['finisher','wall']:['hero']}));
  const result=await request(`/admin/gg/migration/${matchId}`,{token:'admin',method:'POST',body:{participants}});
  assert.equal(result.status,200,JSON.stringify(result.data));
  const after=await Match.findById(matchId).lean();
  assert.equal(after.name,before.name);
  assert.equal(new Date(after.date).getTime(),new Date(before.date).getTime());
  assert.deepEqual(after.teamA,before.teamA);
  assert.deepEqual(after.teamB,before.teamB);
  assert.deepEqual(after.events,before.events);
  assert.equal(after.votingClosed,before.votingClosed);
  assert.equal(String(after.motmWinner),String(before.motmWinner));
  assert.deepEqual(after.participants.map(p=>({player:String(p.player),team:p.team,ownGoals:p.ownGoals})),before.participants.map(p=>({player:String(p.player),team:p.team,ownGoals:p.ownGoals})));
  for(const participant of after.participants){
    assert.equal(participant.ratingSystem,'gg-v3');
    assert.ok(Array.isArray(participant.performanceCodes));
    assert.ok(participant.performanceCodes.length>0);
    assert.equal(typeof participant.rating,'number');
    assert.equal(typeof participant.defensivePerformance,'number');
    if(String(participant.player)===String(p1._id)){assert.equal(participant.rating,7.9);assert.equal(participant.defensivePerformance,8.9);}else{assert.equal(participant.rating,5.9);assert.equal(participant.defensivePerformance,7.6);}
  }
});

test('admin can record manual Pace/Physical and the OVR endpoint exposes the cached current and career ratings',async()=>{
  const update=await request(`/players/${p1._id}/ovr-attributes`,{
    token:'admin',
    method:'PATCH',
    body:{pace:91,physical:87},
  });
  assert.equal(update.status,200,JSON.stringify(update.data));
  assert.equal(update.data.player.pace,91);
  assert.equal(update.data.player.physical,87);
  assert.equal(update.data.currentAttributes.pace,91);
  assert.equal(update.data.currentAttributes.physical,87);
  assert.equal(update.data.ovr,update.data.currentOvr);

  const first=await request(`/players/${p1._id}/attributes`);
  assert.equal(first.status,200,JSON.stringify(first.data));
  assert.equal(first.data.currentOvr,first.data.ovr);

  const second=await request(`/players/${p1._id}/attributes`);
  assert.equal(second.status,200,JSON.stringify(second.data));
  assert.equal(second.data.evidence.cached,true);
  assert.equal(second.data.careerOvr,first.data.careerOvr);
});

test('GG audit distinguishes missing codes and partial records',async()=>{
  const missing=await Match.create({
    date:new Date('2026-09-02'),name:'Audit Missing Codes',
    teamA:{label:'A',score:0},teamB:{label:'B',score:0},
    participants:[{player:p1._id,team:'A'},{player:p2._id,team:'B'}],events:[],
  });
  const partial=await Match.create({
    date:new Date('2026-09-03'),name:'Audit Partial',
    teamA:{label:'A',score:0},teamB:{label:'B',score:0},
    participants:[
      {player:p1._id,team:'A',performanceCodes:['wall'],rating:8.9,ratingSystem:'gg-v3'},
      {player:p2._id,team:'B',performanceCodes:['hero'],rating:7.6,ratingSystem:'gg-v3',defensivePerformance:7.6},
    ],events:[],
  });
  const before=await Match.findById(partial._id).lean();
  const migration=await request(`/admin/gg/migration/${partial._id}`,{token:'admin'});
  assert.equal(migration.status,200);
  const after=await Match.findById(partial._id).lean();
  assert.deepEqual(after,before);
  const audit=await request('/admin/gg/audit',{token:'admin'});
  assert.equal(audit.status,200,JSON.stringify(audit.data));
  assert.equal(audit.data.matches.find(row=>String(row.match._id)===String(missing._id)).classification,'needsPerformanceCodes');
  assert.equal(audit.data.matches.find(row=>String(row.match._id)===String(partial._id)).classification,'partiallyCompleted');
});

test('GG audit detects stored rating inconsistencies without rewriting them',async()=>{
  const match=await Match.create({
    date:new Date('2026-09-01'),name:'Audit Rating Issue',
    teamA:{label:'A',score:1},teamB:{label:'B',score:0},
    participants:[
      {player:p1._id,team:'A',performanceCodes:['wall'],rating:7.2,defensivePerformance:8.9,ratingSystem:'gg-v3'},
      {player:p2._id,team:'B',performanceCodes:['hero'],rating:5.9,defensivePerformance:7.6,ratingSystem:'gg-v3'},
    ],
    events:[{player:p1._id,type:'goal'}],
  });
  const audit=await request('/admin/gg/audit',{token:'admin'});
  assert.equal(audit.status,200,JSON.stringify(audit.data));
  const row=audit.data.matches.find(item=>String(item.match._id)===String(match._id));
  assert.ok(row);
  assert.equal(row.classification,'ratingIssue');
  assert.ok(row.ratingIssues.some(issue=>issue.playerId===String(p1._id)));
  const stored=await Match.findById(match._id).lean();
  assert.equal(stored.participants[0].rating,7.2);
});

test('closed-period awards and career achievements remain immutable across subsequent corrections',async()=>{for(let i=0;i<9;i++)await Match.create({...payload(),date:new Date('2025-06-01'),teamA:{label:'A',score:1},teamB:{label:'B',score:0}});await syncHistory();const original=await Award.findOne({key:'player:2025:0'}).lean();assert.ok(original);await Match.updateMany({date:{$lt:new Date('2026-01-01')}},{$set:{'participants.0.rating':0,'participants.1.rating':10}});await syncHistory();const kept=await Award.findOne({key:'player:2025:0'}).lean();assert.equal(String(kept.player),String(original.player));assert.ok(await Achievement.exists({player:p1._id,key:'goals:10'}));});