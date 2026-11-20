import { useEffect } from 'react';
import { api } from '../lib/api';
import { refreshLiveTopics, useLiveRevision } from '../lib/liveData';

export default function NotificationIndicator({ accountId }) {
  const revision = useLiveRevision('notifications');
  useEffect(() => {
    document.documentElement.dataset.notificationsUnread = 'false';
    return () => { document.documentElement.dataset.notificationsUnread = 'false'; };
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return undefined;
    let active = true;
    api('/notifications').then(data => {
      if (active) document.documentElement.dataset.notificationsUnread = String(Boolean(data.unread));
    }).catch(() => {});
    return () => { active = false; };
  }, [accountId, revision]);

  useEffect(() => {
    if (!accountId) return undefined;
    const opened = () => {
      api('/notifications/read-all', { method: 'POST' })
        .then(() => refreshLiveTopics(['notifications'])).catch(() => {});
    };
    window.addEventListener('gg-notifications-opened', opened);
    return () => window.removeEventListener('gg-notifications-opened', opened);
  }, [accountId]);
  return null;
}
