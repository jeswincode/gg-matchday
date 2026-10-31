import { useId, useMemo, useRef, useState } from "react";
import { gridToScreen } from "./mapProjection.js";
import {
  GLOBAL_MAP_DEMO_MEMBERSHIP,
  GLOBAL_MAP_DEMO_WORLDS,
} from "./globalMapFixtures.js";
import "./global-map-scene.css";

const WIDTH = 1200;
const HEIGHT = 720;
const TILE_WIDTH = 64;
const TILE_HEIGHT = 34;
const ORIGIN_X = 600;
const ORIGIN_Y = 76;
const CAMERA_CENTER_X = WIDTH / 2;
const CAMERA_CENTER_Y = HEIGHT / 2;

function project(column, row) {
  return gridToScreen({
    column, row, tileWidth: TILE_WIDTH, tileHeight: TILE_HEIGHT,
    originX: ORIGIN_X, originY: ORIGIN_Y,
  });
}

function terrain() {
  const result = [];
  for (let row = 0; row < 19; row += 1) {
    for (let column = 0; column < 23; column += 1) {
      const center = project(column, row);
      const hw = TILE_WIDTH / 2;
      const hh = TILE_HEIGHT / 2;
      const points = [
        [center.x, center.y - hh],
        [center.x + hw, center.y],
        [center.x, center.y + hh],
        [center.x - hw, center.y],
      ].map(pair => pair.join(",")).join(" ");
      const edge = Math.abs(column - 11) / 11 + Math.abs(row - 9) / 9;
      let kind = "grass";
      if (edge > 1.08) kind = "water";
      else if ((column * 7 + row * 11) % 17 === 0) kind = "forest";
      else if ((column * 5 + row * 3) % 19 === 0) kind = "hill";
      else if ((column + row) % 4 === 0) kind = "grass-light";
      result.push({ key: column + "-" + row, points, kind });
    }
  }
  return result;
}

function Kingdom({ world, membership, selected, onSelect }) {
  const position = project(world.globalMap.x, world.globalMap.y);
  const status = membership === "active" ? "YOUR WORLD"
    : membership === "pending" ? "REQUEST PENDING" : "PUBLIC KINGDOM";

  return (
    <g
      className={"gg-global-map-kingdom" + (selected ? " is-selected" : "")}
      transform={"translate(" + position.x + " " + (position.y - 22) + ")"}
      role="button"
      tabIndex="0"
      aria-label={"Preview " + world.name}
      onClick={() => onSelect(world)}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(world);
        }
      }}
    >
      <ellipse className="gg-kingdom-shadow" cx="0" cy="18" rx="56" ry="17"/>
      <path className="gg-kingdom-base" d="M-54 18 L-42 0 L0 -12 L44 0 L56 18 L0 34 Z"/>
      <path className="gg-kingdom-path" d="M-30 12 L-12 1 L12 1 L31 13"/>
      <rect className="gg-castle-body" x="-26" y="-46" width="52" height="54" rx="3"/>
      <rect className="gg-castle-door" x="-8" y="-15" width="16" height="24" rx="8"/>
      <rect className="gg-castle-tower" x="-38" y="-59" width="17" height="39" rx="2"/>
      <rect className="gg-castle-tower" x="21" y="-59" width="17" height="39" rx="2"/>
      <path className="gg-castle-roof" d="M-42 -58 L-29 -78 L-17 -58 Z M17 -58 L29 -78 L42 -58 Z"/>
      <path className="gg-castle-roof gg-castle-main-roof" d="M-31 -46 L0 -72 L31 -46 Z"/>
      <path className="gg-flagpole" d="M0 -72 V-100"/>
      <path className="gg-flag" d="M1 -99 L25 -93 L1 -85 Z"/>
      <circle className="gg-kingdom-emblem" cx="0" cy="-28" r="11"/>
      <text className="gg-kingdom-emblem-text" x="0" y="-24" textAnchor="middle">{world.emblem || "GG"}</text>
      <rect className="gg-kingdom-label-bg" x="-68" y="37" width="136" height="27" rx="13.5"/>
      <text className="gg-kingdom-label" x="0" y="55" textAnchor="middle">{world.name}</text>
      <text className="gg-kingdom-status" x="0" y="78" textAnchor="middle">{status}</text>
      <circle className="gg-kingdom-pulse" cx="48" cy="-64" r="5"/>
    </g>
  );
}

function Preview({ world, membership, onEnter, onRequestMembership, onClose }) {
  if (!world) return null;
  const active = membership === "active";
  const pending = membership === "pending";

  return (
    <aside className="gg-global-map-preview" aria-label={world.name + " preview"}>
      <button className="gg-map-close" type="button" onClick={onClose} aria-label="Close preview">×</button>
      <div className="gg-preview-kicker">KINGDOM DISCOVERED</div>
      <div className="gg-preview-emblem">{world.emblem || "GG"}</div>
      <h2>{world.name}</h2>
      <p>{world.description || "A public football community on GG."}</p>
      <div className="gg-preview-meta">
        <span>{Number(world.memberCount || 0).toLocaleString()} members</span>
        <span>{active ? "Member" : pending ? "Request pending" : "Public World"}</span>
      </div>
      {active ? (
        <button className="gg-preview-primary" type="button" onClick={() => onEnter?.(world)}>
          Enter World <span aria-hidden="true">↗</span>
        </button>
      ) : (
        <button
          className="gg-preview-primary"
          type="button"
          disabled={pending || !onRequestMembership}
          onClick={() => onRequestMembership?.(world)}
        >
          {pending ? "Awaiting approval" : "Request membership"}
        </button>
      )}
      <p className="gg-preview-note">
        {active ? "Your membership is active." : pending
          ? "The owner has not approved your request yet."
          : "Membership approval is required to enter."}
      </p>
    </aside>
  );
}

/**
 * Map renderer prototype. worlds must be a public-projection DTO.
 * membershipStates is viewer-specific and must come from a separate membership response.
 * The enter and request callbacks must still be verified by the backend.
 */
export default function GlobalMapScene({
  worlds = GLOBAL_MAP_DEMO_WORLDS,
  membershipStates = GLOBAL_MAP_DEMO_MEMBERSHIP,
  selectedWorldSlug = null,
  onSelectWorld,
  onEnterWorld,
  onRequestMembership,
}) {
  const [selected, setSelected] = useState(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const drag = useRef(null);
  const instanceId = useId().replace(/:/g, "");
  const tiles = useMemo(() => terrain(), []);
  const activeSelection = worlds.find(world => world.slug === selectedWorldSlug) || selected;

  const selectWorld = world => {
    setSelected(world);
    onSelectWorld?.(world);
  };

  const pointerDown = event => {
    if (event.target.closest?.(".gg-global-map-kingdom") || event.button !== 0) return;
    drag.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      cameraX: camera.x, cameraY: camera.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const pointerMove = event => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setCamera(current => ({
      ...current,
      x: drag.current.cameraX + (event.clientX - drag.current.x) * WIDTH / Math.max(bounds.width, 1),
      y: drag.current.cameraY + (event.clientY - drag.current.y) * HEIGHT / Math.max(bounds.height, 1),
    }));
  };

  const pointerUp = event => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const waterId = "gg-world-water-" + instanceId;
  const glowId = "gg-world-glow-" + instanceId;

  return (
    <section className="gg-global-map-shell" aria-label="GG Global Map">
      <header className="gg-global-map-header">
        <div>
          <div className="gg-global-map-eyebrow">THE FOOTBALL UNIVERSE</div>
          <h1>Global Map</h1>
          <p>Discover football kingdoms. Travel between your Worlds.</p>
        </div>
        <div className="gg-global-map-count"><strong>{worlds.length}</strong><span>public Worlds</span></div>
      </header>
      <div
        className="gg-global-map-viewport"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <svg className="gg-global-map-svg" viewBox={"0 0 " + WIDTH + " " + HEIGHT} role="group"
          aria-label="Isometric map showing neighbouring public football kingdoms">
          <defs>
            <linearGradient id={waterId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#203c4b"/><stop offset="100%" stopColor="#102a36"/>
            </linearGradient>
            <radialGradient id={glowId}>
              <stop offset="0%" stopColor="#d3b46a" stopOpacity=".18"/>
              <stop offset="100%" stopColor="#d3b46a" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill={"url(#" + waterId + ")"}/>
          <circle cx="290" cy="220" r="250" fill={"url(#" + glowId + ")"}/>
          <circle cx="925" cy="480" r="280" fill={"url(#" + glowId + ")"}/>
          <g className="gg-global-map-camera"
            transform={"translate(" + camera.x + " " + camera.y + ") translate(" + CAMERA_CENTER_X + " " + CAMERA_CENTER_Y + ") scale(" + camera.zoom + ") translate(" + (-CAMERA_CENTER_X) + " " + (-CAMERA_CENTER_Y) + ")"}>
            {tiles.map(tile => (
              <polygon key={tile.key} className={"gg-map-tile gg-map-tile-" + tile.kind} points={tile.points}/>
            ))}
            <path className="gg-map-river" d="M160 260 C300 190 330 370 480 320 S690 170 820 250 S1010 390 1110 300"/>
            <path className="gg-map-road" d="M250 430 C390 390 410 490 550 440 S790 340 920 420"/>
            <g className="gg-map-decoration">
              <path d="M220 226 l-15 -26 l30 0 Z M232 233 l-11 -20 l22 0 Z"/>
              <path d="M960 180 l-17 -30 l34 0 Z M982 191 l-13 -23 l26 0 Z"/>
              <path d="M430 555 l-16 -27 l32 0 Z M451 561 l-12 -21 l24 0 Z"/>
              <path d="M1035 545 l-18 -30 l36 0 Z M1057 552 l-13 -23 l26 0 Z"/>
            </g>
            {worlds.map(world => (
              <Kingdom key={world.slug} world={world}
                membership={membershipStates[world.slug] || "none"}
                selected={activeSelection?.slug === world.slug} onSelect={selectWorld}/>
            ))}
          </g>
        </svg>
        <div className="gg-global-map-controls" aria-label="Map controls">
          <button type="button" onClick={() => setCamera(c => ({ ...c, zoom: Math.min(1.7, c.zoom + 0.1) }))} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setCamera(c => ({ ...c, zoom: Math.max(0.7, c.zoom - 0.1) }))} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })} aria-label="Reset map view">⌖</button>
        </div>
        <div className="gg-global-map-hint">Drag to explore · Select a kingdom to preview</div>
        <Preview
          world={activeSelection}
          membership={activeSelection ? membershipStates[activeSelection.slug] || "none" : "none"}
          onEnter={onEnterWorld}
          onRequestMembership={onRequestMembership}
          onClose={() => {
            setSelected(null);
            onSelectWorld?.(null);
          }}
        />
      </div>
    </section>
  );
}
