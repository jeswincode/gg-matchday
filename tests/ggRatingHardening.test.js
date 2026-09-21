import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStatistics} from '../server/services/statistics.js';

const player=(name)=>({_id:name,name});
const match=(date,participants,events=[])=>({date,name:'Hardening Test',teamA:{score:0},teamB:{score:0},participants,events});

test('defensive eligibility is independent from overall match eligibility',()=>{
  const players=[player('p1')];
  const matches=Array.from({length:5},(_,i)=>match(`2026-01-0${i+1}`,[{player:'p1',team:'A',rating:7,defensivePerformance:i<2?6:undefined}],[]));
  const stats=buildStatistics(players,matches)[0];
  assert.equal(stats.matches,5);
  assert.equal(stats.eligible,true);
  assert.equal(stats.defensiveRatedMatches,2);
  assert.equal(stats.defensiveEligible,false);
  assert.equal(stats.defensiveRating,null);
  assert.equal(stats.ggEligible,false);
  assert.equal(stats.ggRating,null);
});

test('zero defensive performance is valid and contributes to defensive rating',()=>{
  const players=[player('p1')];
  const matches=Array.from({length:3},(_,i)=>match(`2026-02-0${i+1}`,[{player:'p1',team:'A',rating:7,defensivePerformance:0}],[]));
  const stats=buildStatistics(players,matches)[0];
  assert.equal(stats.defensiveRatedMatches,3);
  assert.equal(stats.defensiveEligible,true);
  assert.equal(stats.defensivePerformanceAverage,0);
  assert.equal(stats.defensiveRating,0.5);
});

test('own-goal deduction used by performance is bounded at zero',()=>{
  const players=[player('p1')];
  const matches=[match('2026-03-01',[{player:'p1',team:'A',rating:2,ownGoals:3,defensivePerformance:5}],[])];
  const stats=buildStatistics(players,matches,{minimumMatches:1})[0];
  assert.equal(stats.averageRating,0);
});
