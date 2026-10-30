import { useEffect, useState } from "react";
import PlayCentre from "../play/PlayCentre";
import TrainingCenter from "./TrainingCenter";
import { MascotArt } from "./GGCompanion";
import "./gg-world.css";

const LOCATIONS = [
  { id: "stadium", name: "Main Stadium", subtitle: "Matchday & history", mark: "🏟", x: 49, y: 17, scene: "stadium" },
  { id: "training", name: "Training Ground", subtitle: "Position-specific drills", mark: "⚽", x: 17, y: 48, scene: "training" },
  { id: "tactics", name: "Tactical Pavilion", subtitle: "Game plans & formations", mark: "♟", x: 49, y: 54, scene: "tactics" },
  { id: "arcade", name: "Arcade Pavilion", subtitle: "Play & personal bests", mark: "🎮", x: 81, y: 48, scene: "arcade" },
  { id: "career", name: "Dressing Room", subtitle: "Career, kits & honours", mark: "👕", x: 28, y: 82, scene: "career" },
  { id: "clubs", name: "Ultimate Clubs Gate", subtitle: "Enter your Club world", mark: "🛡", x: 72, y: 82, scene: "clubs" },
];

export default function GGWorld({ onClose, players = [], player = null, playerId = "guest", onOpenCareer, onOpenClubs, onGoMatches, initialLocation = "map" }) {
  const [location, setLocation] = useState(initialLocation);
  const selected = LOCATIONS.find(item => item.id === location);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = event => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", key); };
  }, [onClose]);

  const enterLocation = id => {
    if (id === "clubs") { onClose(); onOpenClubs?.(); return; }
    if (id === "career") { onClose(); onOpenCareer?.(); return; }
    if (id === "stadium") { onClose(); onGoMatches?.(); return; }
    setLocation(id);
  };

  return (
    <div className="gg-world-overlay" role="dialog" aria-modal="true" aria-label="GG Grounds football world">
      <div className="gg-world-shell">
        <header className="gg-world-topbar">
          <div><p className="gg-world-eyebrow">GG MATCHDAY / YOUR FOOTBALL WORLD</p><h2>{selected ? selected.name : "GG Grounds"}</h2><span>Explore. Train. Play. Build your football story.</span></div>
          <div className="gg-world-top-actions">{location !== "map" && <button type="button" className="gg-world-secondary" onClick={() => setLocation("map")}>← World map</button>}<button type="button" className="gg-world-close" onClick={onClose} aria-label="Close GG Grounds">×</button></div>
        </header>
        {location === "map" ? (
          <div className="gg-world-map-layout">
            <section className="gg-world-map" aria-label="Interactive GG Grounds map">
              <svg className="gg-world-landscape" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <defs><pattern id="gg-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#dbe4d2" strokeOpacity=".08" strokeWidth="1"/></pattern><linearGradient id="gg-grass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#254f43"/><stop offset="1" stopColor="#102c2b"/></linearGradient></defs>
                <rect width="1000" height="640" fill="url(#gg-grass)"/><rect width="1000" height="640" fill="url(#gg-grid)"/>
                <path d="M80 425C220 500 255 350 380 375S570 470 640 325 805 230 925 305" fill="none" stroke="#caa86a" strokeWidth="22" strokeLinecap="round" strokeOpacity=".45"/>
                <path d="M80 425C220 500 255 350 380 375S570 470 640 325 805 230 925 305" fill="none" stroke="#ead39a" strokeWidth="2" strokeDasharray="8 12" strokeOpacity=".85"/>
                <path d="M350 30h300v160H350z" fill="#1b6045" stroke="#c5ddbf" strokeOpacity=".6" strokeWidth="3"/><path d="M500 30v160m-150-80h300" stroke="#d9e9d6" strokeOpacity=".6" strokeWidth="2"/><circle cx="500" cy="110" r="38" fill="none" stroke="#d9e9d6" strokeOpacity=".6" strokeWidth="2"/>
                <path d="M0 560q120-70 240 0t240 0 240 0 280 0v80H0Z" fill="#163d3b" opacity=".9"/>
                {Array.from({length:34},(_,i)=><g key={i} transform={`translate(${(i*137)%980} ${(i*83+25)%590})`}><circle cy="7" r="16" fill="#0e2629" opacity=".7"/><circle cy="-2" r="14" fill={i%3===0?"#71946d":"#527d62"} stroke="#9ab38a" strokeOpacity=".35" strokeWidth="2"/></g>)}
              </svg>
              <div className="gg-world-map-label gg-world-map-label--top">THE GROUNDS · OPEN CAMPUS</div>
              {LOCATIONS.map(item => (
                <button key={item.id} type="button" className={`gg-world-location gg-world-location--${item.id}`} style={{ left: item.x + "%", top: item.y + "%" }} onClick={() => enterLocation(item.id)} aria-label={`Enter ${item.name}`}>
                  <span className="gg-world-building"><i>{item.mark}</i><b>{item.id === "stadium" ? "STADIUM" : item.id === "training" ? "TRAINING" : item.id === "tactics" ? "TACTICS" : item.id === "arcade" ? "ARCADE" : item.id === "career" ? "CAREER" : "CLUBS"}</b></span>
                  <strong>{item.name}</strong><small>{item.subtitle}</small>
                </button>
              ))}
              <div className="gg-world-map-label gg-world-map-label--bottom">SELECT A BUILDING TO ENTER</div>
            </section>
            <aside className="gg-world-map-aside">
              <div className="gg-world-aside-character"><MascotArt/><div><span>YOUR GUIDE</span><strong>GG Scout</strong><small>Here to help you find your next move.</small></div></div>
              <p className="gg-world-eyebrow">TODAY'S ROUTE</p>
              <h3>Make your next session count.</h3>
              <p>Pick a place on the grounds. Training, practice games and your football career each have their own space.</p>
              <button type="button" className="gg-world-primary" onClick={() => setLocation("training")}>Go to Training Ground ↗</button>
              <div className="gg-world-map-legend"><span><i className="is-open"/> Open location</span><span><i className="is-world"/> Interactive world</span></div>
            </aside>
          </div>
        ) : location === "training" ? (
          <TrainingCenter player={player} playerId={playerId}/>
        ) : (location === "arcade" || location === "tactics") ? (
          <div className="gg-world-play"><div className="gg-world-location-intro"><span>{location === "arcade" ? "🎮 ARCADE PAVILION" : "♟ TACTICAL PAVILION"}</span><h3>{location === "arcade" ? "Game on." : "Read the game."}</h3><p>{location === "arcade" ? "Step into the skill games and chase your personal best." : "Build a small-sided team, read the opposition and make your plan."}</p></div><PlayCentre key={location} players={players} playerId={playerId} initialSection={location}/></div>
        ) : (
          <section className="gg-world-feature-panel">
            <div className="gg-world-feature-emblem">{selected?.mark}</div><p className="gg-world-eyebrow">{selected?.subtitle}</p><h3>{selected?.name}</h3><p>This destination connects your existing GG Matchday records and career tools. Your official statistics remain in Matchday; this world is the interactive doorway.</p>
            <div><button type="button" className="gg-world-primary" onClick={() => selected?.id === "career" ? onOpenCareer?.() : onGoMatches?.()}>{selected?.id === "career" ? "Open Career Hub ↗" : "Open Matchday history ↗"}</button><button type="button" className="gg-world-secondary" onClick={() => setLocation("map")}>Return to map</button></div>
          </section>
        )}
      </div>
    </div>
  );
}
