import { useEffect } from 'react';
import { api } from '../lib/api';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

export default function NotificationIndicator(){
  useEffect(()=>{
    let timer;
    let unsubscribe=()=>{};
    const apply=unread=>{document.documentElement.dataset.notificationsUnread=unread?'true':'false'};
    const check=async()=>{try{const data=await api('/notifications');apply(Boolean(data.unread))}catch(e){console.debug('Notification indicator check failed',e);apply(false)}};
    const opened=async()=>{apply(false);try{await api('/notifications/read-all',{method:'POST'})}catch(e){console.debug('Notification read sync failed',e)}};
    window.addEventListener('gg-notifications-opened',opened);
    unsubscribe=onAuthStateChanged(auth,user=>{clearInterval(timer);if(!user){apply(false);return}check();timer=setInterval(check,30000)});
    return()=>{clearInterval(timer);unsubscribe();window.removeEventListener('gg-notifications-opened',opened);apply(false)};
  },[]);
  return null;
}
