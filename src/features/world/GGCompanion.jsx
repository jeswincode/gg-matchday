import { useRef, useState } from "react";
import "./gg-world.css";

const DIALOGUES = [
  "The grounds are open. Where shall we start?",
  "A little practice today goes a long way.",
  "I found a new route through the grounds!",
  "Ready to work on your next football skill?",
];

export function MascotArt() {
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

export default function GGCompanion({ onOpen }) {
  const [open, setOpen] = useState(false);
  const [dialogue, setDialogue] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const start = event => {
    if (event.button !== undefined && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y, lastX: event.clientX, lastY: event.clientY, moved: false };
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
        vx *= 0.94;
        vy = vy * 0.94 + 0.42;
        x += vx;
        y += vy;
        if (x < 8 || x > window.innerWidth - 82) vx *= -0.72;
        if (y < 82 || y > window.innerHeight - 90) vy *= -0.72;
        x = Math.max(8, Math.min(window.innerWidth - 82, x));
        y = Math.max(82, Math.min(window.innerHeight - 90, y));
        setOffset({ x: x - baseX, y: y - baseY });
        frame += 1;
        if (frame < 34 && Math.abs(vx) + Math.abs(vy) > 0.8) requestAnimationFrame(animate);
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
      <button type="button" className="gg-companion" aria-label="Open GG Scout companion" title="Drag me around, or tap to talk" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen(value => !value); } }}>
        <span className="gg-companion-halo" aria-hidden="true"/><MascotArt/><i>GG</i>
      </button>
    </div>
  );
}
