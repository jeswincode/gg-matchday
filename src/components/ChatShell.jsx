import {useEffect,useMemo,useState} from 'react';
import './chat.css';
import './notifications.css';
import Modal from './Modal';
import {api} from '../lib/api';
import {refreshLiveTopics,useLiveRevision} from '../lib/liveData';
import NotificationsPanel from './NotificationsPanel';
import GGOverview from './GGOverview';

const formatTime=value=>value?new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'';

export default function ChatShell({onClose}){
 const [status,setStatus]=useState(null),[messages,setMessages]=useState([]),[text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[section,setSection]=useState('chat'),[unread,setUnread]=useState(false),[isAdmin,setIsAdmin]=useState(false);
 const chatRevision=useLiveRevision('chat');
 const notificationsRevision=useLiveRevision('notifications');
 useEffect(()=>{
  let active=true;
  api('/auth/me').then(data=>{if(active)setIsAdmin(data.user?.role==='admin')}).catch(()=>{});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  let active=true;
  api('/notifications').then(data=>{if(active)setUnread(Boolean(data.unread))}).catch(()=>{});
  return()=>{active=false};
 },[notificationsRevision]);
 useEffect(()=>{
  if(section!=='chat')return undefined;
  let active=true;
  api('/chat').then(data=>{
   if(!active)return;
   setStatus(data);
   setMessages(data.messages.slice(-50));
  }).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[chatRevision,section]);
 useEffect(()=>{
  if(!messages.length)return undefined;
  const untilExpiry=Math.min(...messages.map(message=>message.expiresAt))-Date.now();
  const timer=setTimeout(()=>{
   setMessages(current=>current.filter(message=>message.expiresAt>Date.now()));
  },Math.max(1,untilExpiry));
  return()=>clearTimeout(timer);
 },[messages]);
 async function send(e){
  e.preventDefault();
  if(!text.trim()||busy||!status?.messagesRemaining)return;
  setBusy(true);
  try{
   const next=await api('/chat',{method:'POST',body:{message:text}});
   setStatus(next);
   if(next.message)setMessages(current=>[...current.filter(message=>message.id!==next.message.id),next.message].slice(-50));
   setText('');
   setError('');
   refreshLiveTopics(['chat']);
  }catch(e){
   setError(e.message);
   if(e.status===409)refreshLiveTopics(['chat']);
  }finally{setBusy(false)}
 }
 const remaining=status?.messagesRemaining??0,limitLabel=useMemo(()=>`${remaining} message${remaining===1?'':'s'} remaining this month`,[remaining]);
 const select=next=>{setSection(next);if(next==='notifications'&&section!==next&&unread)window.dispatchEvent(new Event('gg-notifications-opened'))};
 return <Modal title="Community chat" onClose={onClose}><div className="gg-chat"><div className="gg-chat-tabs" role="tablist"><button type="button" role="tab" aria-selected={section==='chat'} className={section==='chat'?'active':''} onClick={()=>select('chat')}>Community chat</button><button type="button" role="tab" aria-selected={section==='notifications'} className={`${section==='notifications'?'active':''}${unread?' has-unread':''}`} onClick={()=>select('notifications')}>Notifications{unread&&<span className="gg-tab-dot" aria-label="Unread notifications"/>}</button><button type="button" role="tab" aria-selected={section==='overview'} className={section==='overview'?'active':''} onClick={()=>select('overview')}>Overview</button></div>{section==='chat'&&<><div className="gg-chat-intro"><div><strong>GG Community</strong><span>Messages stay visible for 5 days.</span></div><span className="gg-chat-quota">{limitLabel}</span></div>{error&&<p className="gg-chat-error" role="alert">{error}</p>}<div className="gg-chat-stream" aria-live="polite" aria-label="Community messages">{messages.length===0?<div className="gg-chat-empty"><span aria-hidden="true">✦</span><strong>No messages yet</strong><p>Start the conversation with the GG community.</p></div>:messages.map((m,i)=>{const grouped=i>0&&messages[i-1].name===m.name;return <article className={`gg-chat-message${grouped?' grouped':''}`} key={m.id}>{!grouped&&<div className="gg-chat-message-head"><strong>{m.name}</strong><time dateTime={new Date(m.createdAt).toISOString()}>{formatTime(m.createdAt)}</time></div>}<p>{m.text}</p></article>})}</div><form className="gg-chat-composer" onSubmit={send}><label htmlFor="gg-chat-message" className="sr-only">Message</label><textarea id="gg-chat-message" maxLength={500} value={text} disabled={!status||remaining===0||busy} onChange={e=>setText(e.target.value)} placeholder={remaining===0?'Monthly message limit reached':'Write a message…'} rows={2}/><div className="gg-chat-composer-footer"><small>{text.length}/500</small><button className="save-button gg-chat-send" disabled={!status||remaining===0||!text.trim()||busy}>{busy?'Sending…':'Send'}</button></div></form>{status?.messagesRemaining===0&&<p className="gg-chat-limit">You’ve used all 3 messages for {status.monthKey}. Your allowance resets next month.</p>}</>}{section==='notifications'&&<NotificationsPanel isAdmin={isAdmin} onUnread={setUnread}/>} {section==='overview'&&<GGOverview/>}</div></Modal>;
}
