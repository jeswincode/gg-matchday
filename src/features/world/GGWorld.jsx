import { useEffect, useState } from "react";
import PlayCentre from "../play/PlayCentre";
import TrainingCenter from "./TrainingCenter";
import "./gg-world.css";

const LOCATIONS = [
  { id: "stadium", name: "Main Stadium", subtitle: "Matchday & history", mark: "🏟", x: 49, y: 17, scene: "stadium" },
  { id: "training", name: "Training Ground", subtitle: "Position-specific drills", mark: "⚽", x: 17, y: 48, scene: "training" },
  { id: "tactics", name: "Tactical Pavilion", subtitle: "Game plans & formations", mark: "♟", x: 49, y: 54, scene: "tactics" },
  { id: "arcade", name: "Arcade Pavilion", subtitle: "Play & personal bests", mark: "🎮", x: 81, y: 48, scene: "arcade" },
  { id: "career", name: "Dressing Room", subtitle: "Career, kits & honours", mark: "👕", x: 28, y: 82, scene: "career" },
  { id: "clubs", name: "Ultimate Clubs Gate", subtitle: "Enter your Club world", mark: "🛡", x: 72, y: 82, scene: "clubs" },
];

const DIALOGUES = [
  "The grounds are open. Where shall we start?",
  "A little practice today goes a long way.",
  "I found a new route through the grounds!",
  "Ready to work on your next football skill?",
];

function MascotArt() {
  return (
    <svg viewBox="0 0 88 96" role="img" aria-label="GG football companion">
      <path d="M15 77 11 87 31 87 34 78M55 78 58 87 78 87 71 75" fill="#182b38" stroke="#d8e8e4" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M20 29 13 42 17 69Q20 82 44 82t27-13l4-27-9-15-44 2Z" fill="#e9f0eb" stroke="#182b38" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M19 28Q44 4 69 28L65 44Q44 55 23 43Z" fill="#d9ad58" stroke="#182b38" strokeWidth="3"/>
      <path d="m31 33 7-5 8 3-2 9-9 2-5-9Zm18-3 8 2 2 8-8 4-6-6 4-8Z" fill="#f7f5ec" stroke="#20364b" strokeWidth="1.6"/>
      <path d="M30 54q6-7 12 0M49 54q6-7 12 0" fill="none" stroke="#182b38" strokeWidth="3" strokeLinecap="round"/>
      <path d="M37 65q7 6 14 0" fill="none" stroke="#182b38" strokeWidth="2.8" strokeLinecap="round"/>
      <path d="M13 51 4 58 9 67 18 61M70 52l10 6-4 10-9-6" fill="#e9f0eb" stroke="#182b38" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M34 14q8-13 17 0" fill="none" stroke="#e2b64e" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="38" cy="53" r="2.4" fill="#182b38"/><circle cx="56" cy="53" r="2.4" fill="#182b38"/>
    </svg>
  );
}

export function GGCompanion({ onOpen }) {
  const [open, setOpen] = useState(false);
  const [dialogue, setDialogue] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = { current: null };
  const start = event => {
    if (event.button !== undefined && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y, lastX: event.clientX, lastY: event.clientY, lastAt: performance.now(), moved: false };
  };
  const move = event => {
    const item = drag.current;
    if (!item) return;
    const dx = event.clientX - item.x;
    const dy = event.clientY - item.y;
    if (Math.abs(dx) + Math.abs(dy) > 7) item.moved = true;
    if (item.moved) {
      setOffset({ x: item.offsetX + dx, y: item.offsetY + dy });
      item.lastX = event.clientX;
      item.lastY = event.clientY;
      item.lastAt = performance.now();
    }
  };
  const end = event => {
    const item = drag.current;
    if (!item) return;
    const dx = event.clientX - item.x;
    const dy = event.clientY - item.y;
    drag.current = null;
    if (item.moved) {
      const baseX = Math.max(16, window.innerWidth - 94);
      const baseY = Math.max(90, window.innerHeight - 172);
      let x = Math.max(8, Math.min(window.innerWidth - 82, baseX + item.offsetX + dx));
      let y = Math.max(82, Math.min(window.innerHeight - 90, baseY + item.offsetY + dy));
      let vx = (event.clientX - item.lastX) * 0.16;
      let vy = (event.clientY - item.lastY) * 0.16;
      let frame = 0;
      const animate = () => {
        vx *= 0.94; vy = vy * 0.94 + 0.42;
        x += vx; y += vy;
        if (x < 8 || x > window.innerWidth - 82) vx *= -0.72;
        if (y < 82 || y > window.innerHeight - 90) vy *= -0.72;
        x = Math.max(8, Math.min(window.innerWidth - 82, x));
        y = Math.max(82, Math.min(window.innerHeight - 90, y));
        setOffset({ x: x - baseX, y: y - baseY });
        frame += 1;
        if (frame < 34 && (Math.abs(vx) + Math.abs(vy) > 0.8)) requestAnimationFrame(animate);
      };
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true) requestAnimationFrame(animate);
    } else {
      setOpen(value => !value);
    }
  };
  return (
    <div className="gg-companion-root" style={{ transform: `translate3d(${offset.x}px,${offset.y}px,0)` }}>
      {open && (
        <div className="gg-companion-bubble" role="dialog" aria-label="GG companion guide">
          <div className="gg-companion-speech"><span>GG SCOUT</span><button type="button" aria-label="Close companion dialogue" onClick={() => setOpen(false)}>×</button><p>{DIALOGUES[dialogue % DIALOGUES.length]}</p></div>
          <button type="button" onClick={() => { setOpen(false); onOpen("map"); }}>Explore GG Grounds <b>↗</b></button>
          <button type="button" onClick={() => { setOpen(false); onOpen("training"); }}>Start a training drill <b>↗</b></button>
          <button type="button" className="gg-companion-another" onClick={() => setDialogue(value => value + 1)}>Talk to me <b>↻</b></button>
        </div>
      )}
      <button type="button" className="gg-companion" aria-label="Open GG Scout companion" title="Drag me around, or tap to talk" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; }}>
        <span className="gg-companion-halo" aria-hidden="true"/><MascotArt/><i>GG</i>
      </button>
    </div>
  );
}

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
              <div className="gg-world-map-label gg-world-map-label--bottom">DRAG THE MAP · SELECT A BUILDING TO ENTER</div>
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
          <div className="gg-world-play"><div className="gg-world-location-intro"><span>{location === "arcade" ? "🎮 ARCADE PAVILION" : "♟ TACTICAL PAVILION"}</span><h3>{location === "arcade" ? "Game on." : "Read the game."}</h3><p>{location === "arcade" ? "Step into the skill games and chase your personal best." : "Build a small-sided team, read the opposition and make your plan."}</p></div><PlayCentre players={players} playerId={playerId} initialSection={location}/></div>
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
