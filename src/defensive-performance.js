/* GG Matchday defensive-performance bridge.
 * Adds the defensive score to the current record rows and the legacy v1.4
 * compact rows, then injects it into match create/edit requests. */
const CACHE_KEY='__ggDefensivePerformance';
if(!window[CACHE_KEY]){
  const state=window[CACHE_KEY]={players:new Map(),matches:[],pending:null};
  const originalFetch=window.fetch.bind(window);
  const isPath=(url,pattern)=>{try{return pattern.test(new URL(typeof url==='string'?url:url.url,window.location.origin).pathname);}catch(error){void error;return false;}};
  const normalize=value=>String(value||'').replace(/\s+/g,' ').trim();
  const findPlayerId=name=>{for(const [id,player] of state.players)if(normalize(player.name)===normalize(name))return id;return '';};
  window.fetch=async function(input,options={}){
    const method=String(options.method||input?.method||'GET').toUpperCase();let requestBody=options.body;const url=typeof input==='string'?input:input?.url||'';
    if((method==='POST'||method==='PUT')&&isPath(url,/\/api\/matches(?:\/[^/]+)?$/)&&typeof requestBody==='string'){
      try{const body=JSON.parse(requestBody);if(Array.isArray(body.participants)){const values=new Map(Array.from(document.querySelectorAll('[data-gg-defensive-input]')).map(input=>[String(input.dataset.playerId),input.value]));body.participants=body.participants.map(participant=>{const value=values.get(String(participant.player));return value===undefined?participant:{...participant,defensivePerformance:value===''?null:Number(value)};});options={...options,body:JSON.stringify(body)};}}catch(error){void error;}
    }
    const response=await originalFetch(input,options);
    if(method==='GET'&&isPath(url,/\/api\/(players|matches)$/))response.clone().json().then(data=>{if(isPath(url,/\/api\/players$/)&&Array.isArray(data)){data.forEach(player=>state.players.set(String(player._id),player));requestAnimationFrame(enhance);}if(isPath(url,/\/api\/matches$/)&&Array.isArray(data)){const known=new Map(state.matches.map(match=>[String(match._id),match]));data.forEach(match=>known.set(String(match._id),match));state.matches=Array.from(known.values()).sort((a,b)=>new Date(b.date)-new Date(a.date)||new Date(b.createdAt||0)-new Date(a.createdAt||0));}}).catch(()=>{});
    return response;
  };
  document.addEventListener('click',event=>{const editButton=event.target.closest?.('.match-card .match-actions .secondary-button');if(!editButton)return;const card=editButton.closest('.match-card'),cards=Array.from(document.querySelectorAll('.match-card')),match=state.matches[cards.indexOf(card)];if(match)state.pending=Object.fromEntries((match.participants||[]).map(p=>[String(p.player?._id||p.player),p.defensivePerformance??'']));},true);
  function enhance(){
    const v14Header=document.querySelector('.v14-stat-head');if(v14Header&&!v14Header.querySelector('.gg-defense-heading')){const heading=document.createElement('span');heading.className='gg-defense-heading';heading.textContent='DEFENSE';v14Header.appendChild(heading);}
    document.querySelectorAll('.gg-performance-row,.v14-stat-row').forEach(row=>{
      if(row.querySelector('[data-gg-defensive-input]'))return;
      const name=normalize(row.querySelector('.v14-player-cell strong,div:first-child strong')?.textContent),playerId=findPlayerId(name);if(!name||!playerId)return;
      const sideText=normalize(row.querySelector('.v14-player-cell small,div:first-child small')?.textContent),assigned=Boolean(sideText&&sideText!=='Not participating');
      const wrapper=document.createElement('label');wrapper.className='gg-defensive-input';wrapper.innerHTML='<span>DEFENSE</span><input type="number" min="0" max="10" step="0.1" placeholder="0–10" data-gg-defensive-input />';
      const input=wrapper.querySelector('input');input.dataset.playerId=playerId;input.disabled=!assigned;input.required=assigned;if(state.pending&&Object.prototype.hasOwnProperty.call(state.pending,playerId))input.value=state.pending[playerId];row.appendChild(wrapper);
    });
    const ggHeader=document.querySelector('.gg-performance-head');if(ggHeader&&!ggHeader.querySelector('.gg-defense-heading')){const heading=document.createElement('span');heading.className='gg-defense-heading';heading.textContent='Defense';ggHeader.insertBefore(heading,ggHeader.lastElementChild);}
  }
  const observer=new MutationObserver(()=>requestAnimationFrame(enhance));observer.observe(document.body,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
}
