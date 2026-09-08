import {auth} from '../firebase';
export const API_URL=import.meta.env.VITE_API_URL||'http://localhost:5000/api';
const cache=new Map(),pending=new Map();
export function invalidate(){cache.clear();window.dispatchEvent(new Event('gg-data-changed'));}
export async function api(path,{method='GET',body,signal,...options}={}){
 const key=`${auth?.currentUser?.uid||'public'}:${path}`,hit=cache.get(key);
 if(method==='GET'&&!signal&&hit&&hit.until>Date.now())return hit.data;
 if(method==='GET'&&!signal&&pending.has(key))return pending.get(key);
 const task=(async()=>{const token=await auth?.currentUser?.getIdToken();const response=await fetch(`${API_URL}${path}`,{...options,method,signal,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Could not complete this request.');if(method==='GET')cache.set(key,{data,until:Date.now()+15000});else invalidate();return data;})().finally(()=>pending.delete(key));
 if(method==='GET'&&!signal)pending.set(key,task);return task;
}
