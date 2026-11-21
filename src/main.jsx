import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './refined-v2.css'
import './welcome-reference.css'
import './v1.2-performance.js'
import './v1.2-polish.css'
import './video-background.css'
import './components/ui/match-history.css'
import './components/features.css'
import './own-goals-ui.css'
import './news-scroll.css'
import './components/notifications.css'
import App from './App.jsx'
import AdminPreferredPositions from './components/AdminPreferredPositions.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
      <App />
      <footer className="pr-footer">Made by <strong>Jeswin</strong></footer>
      <AdminPreferredPositions />
    </>
  </StrictMode>,
)
import './mobile-ux.css'
import './components/database-health.css';
import './features/admin/gg-admin.css';

import './gold-theme-refined.css';
import './features/clubs/clubs-mode.css';
import './matchday-signature.css';
