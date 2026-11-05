import { StrictMode } from 'react'
import './lib/pwaInstall.js'
import { createRoot } from 'react-dom/client'
import './index.css'
import './refined-v2.css'
import './welcome-reference.css'
import './v1.2-performance.js'
import './v1.2-polish.css'
import './video-background.css'
import './video-background.js'
import './components/ui/match-history.css'
import './components/features.css'
import './own-goals-ui.css'
import './news-scroll.css'
import './components/notifications.css'
import App from './App.jsx'
import ProfileRequests from './ProfileRequests.jsx'
import AdminPreferredPositions from './components/AdminPreferredPositions.jsx'
import NotificationIndicator from './components/NotificationIndicator.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
      <App />
      <NotificationIndicator />
      <ProfileRequests />
      <AdminPreferredPositions />
    </>
  </StrictMode>,
)
import './mobile-ux.css'
import './components/database-health.css';
import './features/admin/gg-admin.css';

import './gold-theme-refined.css';
import './features/clubs/clubs-mode.css';


// The PWA worker caches the public application shell only. Authenticated API
// responses, membership data and private media are always fetched from network.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => {
      console.warn('GG offline shell could not be registered:', error);
    });
  });
}
