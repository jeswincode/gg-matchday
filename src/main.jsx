import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './v1.2-performance.js'
import './v1.2-polish.css'
import './v1.3-stars.css'
import './v1.4-record.css'
import './v1.4-match-history.css'
import './components/features.css'
import App from './App.jsx'
import ProfileRequests from './ProfileRequests.jsx'
import AdminPreferredPositions from './components/AdminPreferredPositions.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
      <App />
      <ProfileRequests />
      <AdminPreferredPositions />
    </>
  </StrictMode>,
)
