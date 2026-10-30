import { useRef, useState } from "react";
import "./club-world-map.css";

const LOCATIONS = [
  { key: "overview", title: "Club Hub", building: "Club Plaza", icon: "⌂", desc: "Formation, discovery and your Club command centre.", x: 15, y: 50, tone: "plaza" },
  { key: "myClub", title: "My Club", building: "Clubhouse", icon: "♜", desc: "Squad, captains, contracts and Club identity.", x: 35, y: 27, tone: "house" },
  { key: "matches", title: "Matches", building: "Main Stadium", icon: "▤", desc: "Fixtures, results, predictions and match archive.", x: 66, y: 25, tone: "stadium" },
  { key: "market", title: "Market", building: "Transfer Office", icon: "↗", desc: "Signing offers, auctions and transfer decisions.", x: 85, y: 52, tone: "market" },
  { key: "players", title: "Players", building: "Academy & Scouting", icon: "♙", desc: "Player discovery, profiles and Club history.", x: 65, y: 79, tone: "academy" },
  { key: "reviews", title: "Reviews", building: "Honours Hall", icon: "★", desc: "Player reviews, Club legacy and honours.", x: 34, y: 79, tone: "honours" },
  { key: "clubTraining", title: "Training Centre", building: "Training Complex", icon: "⚽", desc: "Team sessions, invitations and shared attendance.", x: 50, y: 52, tone: "academy" },
  { key: "admin", title: "Admin", building: "Operations Room", icon: "⚙", desc: "Approvals, wallet controls and operational oversight.", x: 50, y: 91, tone: "ops", admin: true },
];

const ADMIN_LOCATIONS = [
  { key: "adminDashboard", title: "Dashboard", building: "Operations Hub", icon: "⌂", desc: "Live workload and Club health.", x: 23, y: 35, tone: "ops" },
  { key: "adminApplications", title: "Applications", building: "Approval Hall", icon: "✓", desc: "Review Club formation applications.", x: 50, y: 27, tone: "honours" },
  { key: "adminClubs", title: "Clubs", building: "Club Registry", icon: "♜", desc: "Inspect approved Clubs and their status.", x: 77, y: 38, tone: "house" },
  { key: "adminMatches", title: "Matches", building: "Fixture Control", icon: "▤", desc: "Club fixture and synchronisation oversight.", x: 50, y: 74, tone: "stadium" },
];

export default function ClubWorldMap({ activeLocation = "overview", onNavigate, clubName = "Ultimate Clubs", isAdmin = false, adminOnly = false, incomingMatches = 0, pendingApplications = 0 }) {
  const locations = adminOnly ? ADMIN_LOCATIONS : LOCATIONS.filter(item => !item.admin || isAdmin);
  const current = locations.find(item => item.key === activeLocation) || locations[0];
  const counts = { matches: incomingMatches, adminApplications: pendingApplications };
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStart = useRef(null);
  const startPan = event => {
    if (event.target?.closest?.("button")) return;
    panStart.current = { x: event.clientX, y: event.clientY, originX: pan.x, originY: pan.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const movePan = event => {
    if (!panStart.current) return;
    const nextX = panStart.current.originX + event.clientX - panStart.current.x;
    const nextY = panStart.current.originY + event.clientY - panStart.current.y;
    setPan({ x: Math.max(-44, Math.min(44, nextX)), y: Math.max(-34, Math.min(34, nextY)) });
  };
  const finishPan = () => { panStart.current = null; };

  return (
    <nav className={"club-world-map" + (adminOnly ? " is-admin-map" : "")} aria-label={adminOnly ? "Clubs admin navigation" : "Clubs navigation"}>
      <div className="club-world-map-head">
        <div><p className="clubs-eyebrow">{adminOnly ? "ULTIMATE CLUBS / OPERATIONS MAP" : "ULTIMATE CLUBS / CAMPUS MAP"}</p><h2>{adminOnly ? "Operations Campus" : (clubName && clubName !== "Ultimate Clubs" ? clubName + " Grounds" : "Ultimate Clubs Grounds")}</h2><p>{adminOnly ? "Select an operations building to enter its workspace." : "Choose a building to open the real Club workflow inside."}</p></div>
        <span className="club-world-map-live">● INTERACTIVE MAP</span>
      </div>
      <div className="club-world-map-scene" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={finishPan} onPointerCancel={finishPan}>
        <div className="club-world-map-pan" style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` }}>
        <svg className="club-world-map-art" viewBox="0 0 1100 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs><linearGradient id="club-world-ground" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#244a3c"/><stop offset="1" stopColor="#142c28"/></linearGradient><pattern id="club-world-grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="#e8ecd8" strokeOpacity=".06"/></pattern></defs>
          <rect width="1100" height="520" fill="url(#club-world-ground)"/><rect width="1100" height="520" fill="url(#club-world-grid)"/>
          <path d="M90 250Q200 120 360 170T610 170 840 260 1010 275" fill="none" stroke="#c4a66c" strokeWidth="32" strokeOpacity=".4" strokeLinecap="round"/>
          <path d="M90 250Q200 120 360 170T610 170 840 260 1010 275" fill="none" stroke="#e6d19d" strokeWidth="2" strokeOpacity=".82" strokeDasharray="9 13"/>
          <path d="M350 30h400v180H350z" fill="#1d6146" stroke="#d6e7d8" strokeOpacity=".5" strokeWidth="3"/><path d="M550 30v180M350 120h400" stroke="#d6e7d8" strokeOpacity=".45" strokeWidth="2"/><circle cx="550" cy="120" r="42" fill="none" stroke="#d6e7d8" strokeOpacity=".45" strokeWidth="2"/>
          {Array.from({length:42},(_,i)=><g key={i} transform={`translate(${(i*173)%1080+10} ${(i*71+13)%500+5})`}><ellipse cy="9" rx="18" ry="7" fill="#091b18" opacity=".28"/><circle cy="-1" r="14" fill={i%4===0?"#7d9870":"#547a61"} stroke="#9bb08c" strokeOpacity=".25" strokeWidth="2"/></g>)}
        </svg>
        <span className="club-world-map-sign">WELCOME TO {adminOnly ? "CLUB OPERATIONS" : "THE CLUB GROUNDS"}</span>
        {locations.map(location => {
          const active = location.key === activeLocation || (location.key === "matches" && activeLocation === "overview" && current?.key === "matches");
          const badgeCount = counts[location.key] || 0;
          return (
            <button key={location.key} type="button" className={`club-world-building club-world-building--${location.tone}` + (active ? " active" : "")} style={{ left: location.x + "%", top: location.y + "%" }} data-primary-tab={location.key} data-location={location.key} aria-current={active ? "page" : undefined} aria-label={location.title} title={location.desc} onClick={() => onNavigate(location.key)}>
              <span className="club-world-building-art"><i>{location.icon}</i><b>{location.building.toUpperCase()}</b></span>
              <strong>{location.title}</strong><small>{location.desc}</small>
              {badgeCount > 0 && <em>{badgeCount}</em>}
            </button>
          );
        })}
        </div>
      </div>
      <div className="club-world-map-selected" aria-live="polite">
        <span className="club-world-selected-mark">{current?.icon}</span>
        <div><small>SELECTED LOCATION</small><strong>{current?.building}</strong><p>{current?.desc}</p></div>
        <button type="button" onClick={() => onNavigate(current.key)}>Enter selected building ↗</button>
      </div>
      <p className="club-world-map-hint">Select any building on the map or use its location card. All existing Club permissions and workflows still apply.</p>
    </nav>
  );
}
