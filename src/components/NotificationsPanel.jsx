import {useEffect,useState} from 'react';
import {api} from '../lib/api';

const formatDate=value=>new Date(value).toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'});

export default function NotificationsPanel({isAdmin,onUnread}){
 const [data,setData]=useState({notifications:[],unread:false}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[title,setTitle]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const next=await api('/notifications');if(!active)return;setData(next);onUnread(Boolean(next.unread));setError('')}catch(e){if(active)setError(e.message||'Could not load notifications.')}finally{if(active)setLoading(false)}};
  load();
  return()=>{active=false};
 },[onUnread]);
 const refresh=async()=>{try{const next=await api('/notifications');setData(next);onUnread(Boolean(next.unread));setError('')}catch(e){setError(e.message||'Could not load notifications.')}finally{setLoading(false)}};
 const readAll=async()=>{try{await api('/notifications/read-all',{method:'POST'});setData(x=>({...x,unread:false,notifications:x.notifications.map(n=>({...n,read:true}))}));onUnread(false)}catch(e){setError(e.message||'Could not mark notifications as read.')}};
 const publish=async e=>{e.preventDefault();if(!title.trim()||!message.trim()||busy)return;setBusy(true);try{await api('/notifications',{method:'POST',body:{title,message}});setTitle('');setMessage('');await refresh()}catch(e){setError(e.message||'Could not publish notification.')}finally{setBusy(false)}};
 const remove=async id=>{try{await api(`/notifications/${id}`,{method:'DELETE'});await refresh()}catch(e){setError(e.message||'Could not delete notification.')}};
 return <div className="gg-notifications"><div className="gg-notifications-heading"><div><strong>Official updates</strong><span>Admin announcements stay visible for 5 days.</span></div>{data.notifications.some(n=>!n.read)&&<button className="text-button" type="button" onClick={readAll}>Mark all as read</button>}</div>{isAdmin&&<form className="gg-notification-compose" onSubmit={publish}><b>Admin announcement</b><input maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Notification title"/><textarea maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tell the GG community about a new feature, fix or version addition…" rows={3}/><div><small>{message.length}/1000</small><button className="save-button" disabled={busy||!title.trim()||!message.trim()}>{busy?'Publishing…':'Publish notification'}</button></div></form>}{error&&<p className="gg-chat-error" role="alert">{error}</p>}<div className="gg-notification-list">{loading?<div className="gg-notification-empty"><span>Loading…</span></div>:!data.notifications.length?<div className="gg-notification-empty"><span>✦</span><strong>No notifications</strong><p>Official GG MATCHDAY updates will appear here.</p></div>:data.notifications.map(n=><article className={`gg-notification-card${n.read?'':' unread'}`} key={n.id}><div className="gg-notification-card-top"><div><small>GG MATCHDAY</small><h3>{n.title}</h3></div>{isAdmin&&<button type="button" className="danger-button" onClick={()=>remove(n.id)}>Delete</button>}</div><p>{n.message}</p><footer><span>{formatDate(n.createdAt)} · {n.authorName}</span>{!n.read&&<b>NEW</b>}</footer></article>)}</div></div>;
}
