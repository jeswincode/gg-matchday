export const PERFORMANCE_CODE_CATEGORIES = Object.freeze([
  {
    key: "badShooting",
    label: "Bad Shooting",
    codes: [
      {code:"miss",label:"Miss",level:1,match:-0.10},
      {code:"waste",label:"Waste",level:2,match:-0.20},
      {code:"choke",label:"Choke",level:3,match:-0.30},
    ],
  },
  {
    key: "misses",
    label: "Misses",
    codes: [
      {code:"off",label:"Off",level:1,match:-0.05},
      {code:"errant",label:"Errant",level:2,match:-0.15},
      {code:"scatter",label:"Scatter",level:3,match:-0.25},
    ],
  },
  {
    key: "playmaking",
    label: "Playmaking",
    codes: [
      {code:"creator",label:"Creator",level:1,match:0.10},
      {code:"playmaker",label:"Playmaker",level:2,match:0.20},
      {code:"architect",label:"Architect",level:3,match:0.30},
    ],
  },
  {
    key: "defence",
    label: "Defence",
    codes: [
      {code:"defence",label:"Defence",level:1,match:0.10,defensive:0.80},
      {code:"stopper",label:"Stopper",level:2,match:0.20,defensive:1.60},
      {code:"wall",label:"Wall",level:3,match:0.30,defensive:2.40},
    ],
  },
  {
    key: "goalsave",
    label: "Goalsave",
    codes: [
      {code:"save",label:"Save",level:1,match:0.10,defensive:0.80},
      {code:"hero",label:"Hero",level:2,match:0.20,defensive:1.60},
    ],
  },
  {
    key: "mistakes",
    label: "Mistakes",
    codes: [
      {code:"error",label:"Error",level:1,match:-0.10,defensive:-0.60},
      {code:"blunder",label:"Blunder",level:2,match:-0.20,defensive:-1.20},
      {code:"disaster",label:"Disaster",level:3,match:-0.30,defensive:-2.00},
    ],
  },
  {
    key: "carrying",
    label: "Carrying",
    codes: [
      {code:"carry",label:"Carry",level:1,match:0.15},
      {code:"dominant",label:"Dominant",level:2,match:0.30},
    ],
  },
  {
    key: "clutch",
    label: "Clutch",
    codes: [
      {code:"clutch",label:"Clutch",level:1,match:0.10},
      {code:"heroic",label:"Heroic",level:2,match:0.20},
    ],
  },
  {
    key: "attacking",
    label: "Attacking",
    codes: [
      {code:"scorer",label:"Scorer",level:1,match:0.10},
      {code:"shooter",label:"Shooter",level:2,match:0.18},
      {code:"finisher",label:"Finisher",level:3,match:0.30},
    ],
  },
]);

const CODE_LOOKUP = new Map(
  PERFORMANCE_CODE_CATEGORIES.flatMap(category =>
    category.codes.map(entry => [entry.code,{...entry,category:category.key}])
  )
);

export function normalizePerformanceCodes(value=[]) {
  if(!Array.isArray(value)) return [];
  const selected=new Map();
  for(const raw of value){
    const entry=CODE_LOOKUP.get(raw);
    if(!entry) continue;
    const current=selected.get(entry.category);
    if(!current||entry.level>current.level) selected.set(entry.category,entry);
  }
  return [...selected.values()].sort((a,b)=>a.category.localeCompare(b.category)).map(entry=>entry.code);
}

export function goalPoints(goals){
  const value=Math.max(0,Math.floor(Number(goals)||0));
  if(value<=0)return 0;
  if(value===1)return 0.90;
  if(value===2)return 1.70;
  if(value===3)return 2.40;
  if(value===4)return 3.00;
  if(value===5)return 3.50;
  return 3.50+(value-5)*0.60;
}

export function assistPoints(assists){
  const value=Math.max(0,Math.floor(Number(assists)||0));
  if(value<=0)return 0;
  if(value===1)return 0.70;
  if(value===2)return 1.25;
  if(value===3)return 1.70;
  if(value===4)return 2.10;
  if(value===5)return 2.45;
  return 2.45+(value-5)*0.45;
}

function clamp(value){return Math.min(10,Math.max(4,value));}
function round1(value){return Number(clamp(value).toFixed(1));}

function resultContext({team,teamACount,teamBCount,teamAScore,teamBScore}){
  const equal=teamACount===teamBCount;
  const favoured=!equal&&((team==="A"&&teamACount>teamBCount)||(team==="B"&&teamBCount>teamACount));
  const context=equal?"equal":favoured?"favoured":"underdog";
  const own=team==="A"?teamAScore:teamBScore;
  const against=team==="A"?teamBScore:teamAScore;
  const result=own>against?"W":own===against?"D":"L";
  const modifiers={
    equal:{W:0.35,D:0,L:-0.35},
    underdog:{W:0.50,D:0.10,L:-0.30},
    favoured:{W:0.30,D:-0.10,L:-0.50},
  };
  return {result,resultPoints:modifiers[context][result],cleanSheet:Number(against)===0,goalsConceded:Math.max(0,Number(against)||0),context};
}

export function calculateMatchRatings({team,teamACount,teamBCount,teamAScore,teamBScore,goals=0,assists=0,ownGoals=0,performanceCodes=[]}){
  const context=resultContext({team,teamACount,teamBCount,teamAScore,teamBScore});
  const entries=normalizePerformanceCodes(performanceCodes).map(code=>CODE_LOOKUP.get(code));
  const matchPerformance=entries.reduce((sum,entry)=>sum+entry.match,0);
  const defensivePerformance=entries.reduce((sum,entry)=>sum+(entry.defensive??0),0);
  const og=Math.max(0,Math.floor(Number(ownGoals)||0));
  const matchBreakdown=[
    {label:"Base",points:6},
    {label:"Goals",points:goalPoints(goals)},
    {label:"Assists",points:assistPoints(assists)},
    {label:"Own Goals",points:-0.50*og},
    {label:"Result",points:context.resultPoints},
    ...entries.map(entry=>({label:entry.label,points:entry.match})),
  ];
  const defensiveBreakdown=[
    {label:"Base",points:6},
    ...entries.filter(entry=>entry.defensive!=null).map(entry=>({label:entry.label,points:entry.defensive})),
    {label:"Clean Sheet",points:context.cleanSheet?0.50:0},
    {label:"Goals Conceded",points:-0.05*context.goalsConceded},
    {label:"Own Goals",points:-0.50*og},
  ];
  const rawMatch=6+goalPoints(goals)+assistPoints(assists)-0.50*og+context.resultPoints+matchPerformance;
  const rawDefensive=6+defensivePerformance+(context.cleanSheet?0.50:0)-0.05*context.goalsConceded-0.50*og;
  return {matchRating:round1(rawMatch),defensiveRating:round1(rawDefensive),result:context.result,resultContext:context.context,performanceCodes:entries.map(entry=>entry.code),matchBreakdown,defensiveBreakdown};
}
