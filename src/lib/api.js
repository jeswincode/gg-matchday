import {auth} from '../firebase';
export const API_URL=import.meta.env.VITE_API_URL||'http://localhost:5000/api';
const cache=new Map(),pending=new Map();
function e2eAuthHeaders(){
 if(!import.meta.env.VITE_E2E_TEST_AUTH_SECRET)return {};
 const params=new URLSearchParams(window.location.search);
 const role=params.get('e2eRole')||import.meta.env.VITE_E2E_TEST_ROLE||'viewer';
 const playerId=params.get('e2ePlayerId')||import.meta.env.VITE_E2E_TEST_PLAYER_ID||'';
 return {'X-E2E-Test-Token':import.meta.env.VITE_E2E_TEST_AUTH_SECRET,'X-E2E-Test-Role':role,...(playerId?{'X-E2E-Test-Player-Id':playerId}:{})};
}
export function invalidate(){cache.clear();window.dispatchEvent(new Event('gg-data-changed'));}
export async function authenticatedFetch(url,options={}){
 if(import.meta.env.VITE_E2E_TEST_AUTH_SECRET)return fetch(url,{...options,headers:{...(options.headers||{}),...e2eAuthHeaders()}});
 if(!auth?.currentUser) throw new Error('Authentication required.');
 const token=await auth.currentUser.getIdToken();
 return fetch(url,{...options,headers:{...(options.headers||{}),Authorization:`Bearer ${token}`}});
}
export async function api(path,{method='GET',body,signal,...options}={}){
 const key=`${auth?.currentUser?.uid||'public'}:${path}`,hit=cache.get(key);
 if(method==='GET'&&!signal&&hit&&hit.until>Date.now())return hit.data;
 if(method==='GET'&&!signal&&pending.has(key))return pending.get(key);
 const task=(async()=>{const token=await auth?.currentUser?.getIdToken();const response=await fetch(`${API_URL}${path}`,{...options,method,signal,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}),...e2eAuthHeaders()},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Could not complete this request.');if(method==='GET')cache.set(key,{data,until:Date.now()+15000});else invalidate();return data;})().finally(()=>pending.delete(key));
 if(method==='GET'&&!signal)pending.set(key,task);return task;
}
