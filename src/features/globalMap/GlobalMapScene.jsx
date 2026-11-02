import { useEffect, useId, useMemo, useRef, useState } from "react";
import { gridToScreen } from "./mapProjection.js";
import "./global-map-scene.css";

const WIDTH = 1800;
const HEIGHT = 1100;
const TILE_WIDTH = 48;
const TILE_HEIGHT = 24;
const ORIGIN_X = WIDTH / 2;
const ORIGIN_Y = HEIGHT / 2;
const CAMERA_CENTER_X = WIDTH / 2;
const CAMERA_CENTER_Y = HEIGHT / 2;

function project(column, row) {
  return gridToScreen({
    column, row, tileWidth: TILE_WIDTH, tileHeight: TILE_HEIGHT,
    originX: ORIGIN_X, originY: ORIGIN_Y,
  });
}

function terrain(mapPoints = []) {
  const result = [];
  const coordinates = mapPoints.filter(point =>
    Number.isFinite(point?.x) && Number.isFinite(point?.y),
  );
  let minColumn = -16;
  let maxColumn = 16;
  let minRow = -12;
  let maxRow = 12;
  if (coordinates.length) {
    minColumn = Infinity;
    maxColumn = -Infinity;
    minRow = Infinity;
    maxRow = -Infinity;
    for (const point of coordinates) {
      minColumn = Math.min(minColumn, point.x);
      maxColumn = Math.max(maxColumn, point.x);
      minRow = Math.min(minRow, point.y);
      maxRow = Math.max(maxRow, point.y);
    }
  }
  const spanColumns = maxColumn - minColumn;
  const spanRows = maxRow - minRow;
  const step = Math.max(1, Math.ceil((spanColumns + 36) / 68), Math.ceil((spanRows + 28) / 48));
  const marginColumns = 18 * step;
  const marginRows = 14 * step;
  const startColumn = Math.floor((minColumn - marginColumns) / step) * step;
  const endColumn = Math.ceil((maxColumn + marginColumns) / step) * step;
  const startRow = Math.floor((minRow - marginRows) / step) * step;
  const endRow = Math.ceil((maxRow + marginRows) / step) * step;
  const centerColumn = (minColumn + maxColumn) / 2;
  const centerRow = (minRow + maxRow) / 2;
  const halfColumns = Math.max(1, (endColumn - startColumn) / 2);
  const halfRows = Math.max(1, (endRow - startRow) / 2);

  // Terrain expands with the reserved Global Map coordinates. Tile size
  // coarsens at distant scales so the browser never draws an unbounded grid.
  for (let row = startRow; row <= endRow; row += step) {
    for (let column = startColumn; column <= endColumn; column += step) {
      const center = project(column, row);
      const hw = (TILE_WIDTH * step) / 2;
      const hh = (TILE_HEIGHT * step) / 2;
      const points = [
        [center.x, center.y - hh],
        [center.x + hw, center.y],
        [center.x, center.y + hh],
        [center.x - hw, center.y],
      ].map(pair => pair.join(",")).join(" ");
      const normalizedColumn = (column - centerColumn) / halfColumns;
      const normalizedRow = (row - centerRow) / halfRows;
      const edge = Math.pow(normalizedColumn, 2) + Math.pow(normalizedRow, 2);
      let kind = "grass";
      if (edge > 1.04) kind = "water";
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
  const status = membership === "active" ? "ACCESS LINKED"
    : membership === "invited" ? "INVITATION READY"
      : membership === "revoked" ? "ACCESS REVOKED"
        : "ADMIN ACCESS ONLY";

  return (
    <g
      className={"gg-global-map-kingdom" + (selected ? " is-selected" : "")}
      transform={"translate(" + position.x + " " + (position.y - 22) + ") scale(.75)"}
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

function Preview({ world, membership, onEnter, onClose }) {
  if (!world) return null;
  const active = membership === "active";
  const invited = membership === "invited";
  const revoked = membership === "revoked";

  return (
    <aside className="gg-global-map-preview" aria-label={world.name + " access"}>
      <button className="gg-map-close" type="button" onClick={onClose} aria-label="Close preview">×</button>
      <div className="gg-preview-kicker">THE SHARED FOOTBALL WORLD</div>
      <div className="gg-preview-emblem">{world.emblem || "GG"}</div>
      <h2>{world.name}</h2>
      <p>{world.description || "The one shared GG football world."}</p>
      <div className="gg-preview-meta">
        <span>ONE WORLD</span>
        <span>{active ? "Access linked" : invited ? "Invitation found" : revoked ? "Access revoked" : "Restricted access"}</span>
      </div>
      {active && onEnter ? (
        <button className="gg-preview-primary" type="button" onClick={() => onEnter(world)}>
          Enter Football World <span aria-hidden="true">↗</span>
        </button>
      ) : (
        <button className="gg-preview-primary" type="button" disabled>
          {invited ? "Sign in with invited Gmail" : revoked ? "Ask admin to restore access" : "Access by invitation only"}
        </button>
      )}
      <p className="gg-preview-note">
        {active
          ? "Your administrator-linked Gmail account is verified. The facilities and training grounds are ready."
          : invited
            ? "Sign in with the exact Gmail address linked by the GG administrator."
            : revoked
              ? "This account no longer has permission to enter the football World."
              : "Only Gmail accounts explicitly linked by the GG administrator can enter the local World map."}
      </p>
    </aside>
  );
}

/**
 * Map renderer prototype. worlds must be a public-projection DTO.
 * membershipStates is viewer-specific and must come from the signed-in account's
 * single-World access response. Local map access is still verified by the backend.
 */
export default function GlobalMapScene({
  worlds = [],
  membershipStates = {},
  selectedWorldSlug = null,
  onSelectWorld,
  onEnterWorld,
}) {
  const [selected, setSelected] = useState(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const drag = useRef(null);
  const transitionTimer = useRef(null);

  useEffect(() => () => {
    if (transitionTimer.current !== null) {
      window.clearTimeout(transitionTimer.current);
    }
  }, []);
  const instanceId = useId().replace(/:/g, "");
  const mapPoints = useMemo(() => worlds.map(world => ({ x: world.globalMap?.x, y: world.globalMap?.y })), [worlds]);
  const tiles = useMemo(() => terrain(mapPoints), [mapPoints]);
  const fit = useMemo(() => {
    const positions = mapPoints
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
      .map(point => project(point.x, point.y));

    if (!positions.length) {
      return { centerX: ORIGIN_X, centerY: ORIGIN_Y, scale: 1 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const position of positions) {
      minX = Math.min(minX, position.x);
      maxX = Math.max(maxX, position.x);
      minY = Math.min(minY, position.y);
      maxY = Math.max(maxY, position.y);
    }
    const boundsWidth = Math.max(680, maxX - minX + 440);
    const boundsHeight = Math.max(520, maxY - minY + 360);
    const scale = Math.max(0.36, Math.min(
      1.25,
      (WIDTH - 180) / boundsWidth,
      (HEIGHT - 180) / boundsHeight,
    ));

    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      scale,
    };
  }, [mapPoints]);
  const activeSelection = worlds.find(world => world.slug === selectedWorldSlug) || selected;

  const selectWorld = world => {
    // The one kingdom is visible on the Global Map, but only a verified
    // administrator-linked account can fly into its private local map.
    if (membershipStates[world.slug] === "active" && onEnterWorld) {
      const position = project(world.globalMap.x, world.globalMap.y);
      const targetZoom = Math.min(6, Math.max(camera.zoom, 3.4 / Math.max(fit.scale, 0.1)));
      const targetScale = targetZoom * fit.scale;
      setSelected(world);
      setCamera({
        zoom: targetZoom,
        x: -(position.x - fit.centerX) * targetScale,
        y: -(position.y - fit.centerY) * targetScale,
      });
      onSelectWorld?.(world);
      if (transitionTimer.current !== null) {
        window.clearTimeout(transitionTimer.current);
      }
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      if (reducedMotion) {
        onEnterWorld(world);
      } else {
        transitionTimer.current = window.setTimeout(() => {
          transitionTimer.current = null;
          onEnterWorld(world);
        }, 460);
      }
      return;
    }
    setSelected(world);
    onSelectWorld?.(world);
  };

  const pointerDown = event => {
    // Child controls own their click/pointer events; the map camera only
    // captures drags that begin on empty terrain.
    if (
      event.button !== 0 ||
      event.target.closest?.(".gg-global-map-kingdom, .gg-global-map-preview, .gg-global-map-controls, button, a, input, textarea, select, [role='button']")
    ) return;
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
      <div
        className="gg-global-map-viewport"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <svg className="gg-global-map-svg" viewBox={"0 0 " + WIDTH + " " + HEIGHT} preserveAspectRatio="xMidYMid slice" role="group"
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
            transform={"translate(" + (CAMERA_CENTER_X + camera.x) + " " + (CAMERA_CENTER_Y + camera.y) + ") scale(" + (camera.zoom * fit.scale) + ") translate(" + (-fit.centerX) + " " + (-fit.centerY) + ")"}>
            <g transform={"translate(" + (fit.centerX - ORIGIN_X) + " " + (fit.centerY - ORIGIN_Y) + ")"}>
              {tiles.map(tile => (
                <polygon key={tile.key} className={"gg-map-tile gg-map-tile-" + tile.kind} points={tile.points}/>
              ))}
              <path className="gg-map-river" d="M120 360 C390 180 460 650 760 430 S1190 210 1500 455 S1640 650 1770 390"/>
              <path className="gg-map-road" d="M240 760 C490 610 600 850 890 680 S1330 570 1570 770"/>
              <g className="gg-map-decoration">
                <path d="M360 290 l-24 -42 l48 0 Z M394 310 l-17 -31 l34 0 Z"/>
                <path d="M1420 270 l-28 -48 l56 0 Z M1457 296 l-19 -34 l38 0 Z"/>
                <path d="M360 810 l-25 -43 l50 0 Z M397 830 l-17 -30 l34 0 Z"/>
                <path d="M1440 820 l-28 -48 l56 0 Z M1478 842 l-19 -34 l38 0 Z"/>
              </g>
            </g>
            {worlds.filter(world => Number.isFinite(world.globalMap?.x) && Number.isFinite(world.globalMap?.y)).map(world => (
              <Kingdom key={world.slug} world={world}
                membership={membershipStates[world.slug] || "none"}
                selected={activeSelection?.slug === world.slug} onSelect={selectWorld}/>
            ))}
          </g>
        </svg>
        <div className="gg-global-map-controls" aria-label="Map controls">
          <button type="button" onClick={() => setCamera(c => ({ ...c, zoom: Math.min(6, c.zoom + 0.25) }))} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => setCamera(c => ({ ...c, zoom: Math.max(0.5, c.zoom - 0.25) }))} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })} aria-label="Reset map view">⌖</button>
        </div>
        <div className="gg-global-map-hint">Drag to explore · Select the GG football World · Entry requires an administrator-linked Gmail</div>
        <Preview
          world={activeSelection}
          membership={activeSelection ? membershipStates[activeSelection.slug] || "none" : "none"}
          onEnter={selectWorld}
          onClose={() => {
            setSelected(null);
            onSelectWorld?.(null);
          }}
        />
      </div>
    </section>
  );
}
