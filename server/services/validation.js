import {hasRating,id} from './statistics.js';
export const positions=['GK','CB','LB','RB','LWB','RWB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF'];

export const primaryPositionAliases={
 GK:['gk','goalkeeper'],
 CB:['cb','centre back','center back','central defender'],
 LB:['lb','left back'],
 RB:['rb','right back'],
 LWB:['lwb','left wing back'],
 RWB:['rwb','right wing back'],
 CDM:['cdm','defensive midfielder','central defensive midfielder'],
 CM:['cm','central midfielder'],
 CAM:['cam','attacking midfielder','central attacking midfielder'],
 LM:['lm','left midfielder','left attacking midfielder'],
 RM:['rm','right midfielder','right attacking midfielder'],
 LW:['lw','left wing','left winger'],
 RW:['rw','right wing','right winger'],
 ST:['st','striker','centre forward striker','center forward striker'],
 CF:['cf','centre forward','center forward']
};

const primaryPositionLookup=Object.entries(primaryPositionAliases).reduce((lookup,[code,aliases])=>{
 for(const alias of aliases) lookup[alias]=code;
 return lookup;
},{});

export function primaryPositionCode(value){
 if(typeof value!=='string') return '';
 const normalized=value.trim().toLowerCase().replace(/\s+/g,' ');
 return primaryPositionLookup[normalized]||'';
}

export function validatePlayerProfileUpdate({preferredFoot,dateOfBirth}={}){
 if(!['Left','Right','Both',''].includes(preferredFoot??''))throw new Error('Preferred foot is invalid.');
 if(dateOfBirth!==''&&dateOfBirth!==null&&dateOfBirth!==undefined){
  const parsedDate=new Date(dateOfBirth);
  if(Number.isNaN(parsedDate.getTime()))throw new Error('Date of birth is invalid.');
 }
 return true;
}

export function prepareMatch(body,previous=null){
 if(!body||!Array.isArray(body.participants)||!Array.isArray(body.events)||body.participants.length>100||body.events.length>1000)throw new Error('Invalid match performance data.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(body.date||'')||Number.isNaN(new Date(body.date).getTime())||new Date(body.date).toISOString().slice(0,10)!==body.date)throw new Error('Choose a valid match date.');
 if(!body.participants.some(p=>p.team==='A')||!body.participants.some(p=>p.team==='B'))throw new Error('Assign at least one player to each side.');
 for(const p of body.participants){const old=previous?.participants.find(v=>id(v.player)===id(p.player));const legacy=old&&!hasRating(old.rating);if(!hasRating(p.rating)&&!(legacy&&(p.rating===null||p.rating===undefined)))throw new Error('Enter a rating from 0 to 10 for every participating player.');const ownGoals=Number(p.ownGoals??0);if(!Number.isInteger(ownGoals)||ownGoals<0||ownGoals>20)throw new Error('Own goals must be whole numbers from 0 to 20.');p.ownGoals=ownGoals;}
 const side=new Map(body.participants.map(p=>[id(p.player),p.team]));
 const score=t=>body.events.filter(e=>e.type==='goal'&&side.get(id(e.player))===t).length;
 body.teamA={label:String(body.teamA?.label||'Team A').trim(),score:score('A')};body.teamB={label:String(body.teamB?.label||'Team B').trim(),score:score('B')};
 return body;
}
export function validatePreferences(input,player){
 const out={};
 if(Object.hasOwn(input,'preferredPositions')){if(!Array.isArray(input.preferredPositions)||input.preferredPositions.length>positions.length||input.preferredPositions.some(p=>!positions.includes(p)))throw new Error('Choose valid preferred positions.');out.preferredPositions=[...new Set(input.preferredPositions)];}
 if(Object.hasOwn(input,'clasicoSide')){if(!['','Messi','Ronaldo'].includes(input.clasicoSide))throw new Error('Choose Messi or Ronaldo.');if(player.clasicoSide&&input.clasicoSide!==player.clasicoSide)throw new Error('Your approved El Clásico side is permanent.');out.clasicoSide=input.clasicoSide;}
 return out;
}
export function chatMonth(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:process.env.APP_TIMEZONE||'Asia/Kolkata',year:'numeric',month:'2-digit'}).format(now);}
export function messageText(value){if(typeof value!=='string'||!value.trim()||value.trim().length>500)throw new Error('Write a message between 1 and 500 characters.');return value.trim();}
