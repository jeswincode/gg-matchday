import { useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import "./world-map-view.css";

const VIEW_WIDTH = 1920;
const VIEW_HEIGHT = 1080;
const TILE_WIDTH = 32;
const TILE_HEIGHT = 16;
const ORIGIN_X = VIEW_WIDTH / 2;
const ORIGIN_Y = 60;

const LOCAL_OPEN_LAND_MARKERS = Object.freeze([
  { column: 3, row: 3 },
  { column: 15, row: 3 },
  { column: 49, row: 3 },
  { column: 3, row: 16 },
  { column: 50, row: 18 },
  { column: 14, row: 34 },
  { column: 50, row: 34 },
  { column: 14, row: 50 },
  { column: 51, row: 51 },
]);

const FACILITY_PRESENTATION = {
  central_stadium: { label: "Central Stadium", icon: "⚽" },
  club_district: { label: "Club District", icon: "🏟️" },
  construction_grounds: { label: "Construction Grounds", icon: "🏗️" },
  captains_arena: { label: "Captains' Arena", icon: "👑" },
  training_grounds: { label: "Training Grounds", icon: "🎯" },
  community_hall: { label: "Community Hall", icon: "🏠" },
  hall_of_fame: { label: "Hall of Fame", icon: "🏆" },
  administration: { label: "Administration", icon: "🛡️" },
};

function project(column, row) {
  return {
    x: ORIGIN_X + ((column - row) * TILE_WIDTH) / 2,
    y: ORIGIN_Y + ((column + row) * TILE_HEIGHT) / 2,
  };
}

function mapGridPaths(width, height) {
  const paths = [];
  for (let column = 0; column <= width; column += 1) {
    const start = project(column, 0);
    const end = project(column, height);
    paths.push("M" + start.x + " " + start.y + " L" + end.x + " " + end.y);
  }
  for (let row = 0; row <= height; row += 1) {
    const start = project(0, row);
    const end = project(width, row);
    paths.push("M" + start.x + " " + start.y + " L" + end.x + " " + end.y);
  }
  return paths.join(" ");
}

function facilityTitle(facility) {
  return FACILITY_PRESENTATION[facility.type]?.label || facility.facilityKey;
}

function LocalOpenLandMarker({ plot }) {
  const center = project(plot.column + 3, plot.row + 2.5);
  return (
    <g
      className="gg-world-open-land-marker"
      transform={"translate(" + center.x + " " + center.y + ")"}
      aria-hidden="true"
    >
      <path d="M-72 0 L0 -36 L72 0 L0 36 Z"/>
      <path className="gg-world-open-land-marker-inner" d="M-55 0 L0 -27 L55 0 L0 27 Z"/>
      <text x="0" y="5" textAnchor="middle">OPEN LAND</text>
    </g>
  );
}

function FacilityBuilding({ facility, selected, onSelect }) {
  const rotation = facility.rotation || 0;
  const quarterTurn = rotation === 90 || rotation === 270;
  const footprintWidth = quarterTurn ? facility.footprint.height : facility.footprint.width;
  const footprintHeight = quarterTurn ? facility.footprint.width : facility.footprint.height;
  const center = project(
    facility.position.column + footprintWidth / 2,
    facility.position.row + footprintHeight / 2,
  );
  const presentation = FACILITY_PRESENTATION[facility.type] || { icon: "🏛️" };
  const scale = facility.level > 1 ? 1 + Math.min(facility.level - 1, 5) * 0.035 : 1;

  return (
    <g
      className={"gg-world-facility" + (selected ? " is-selected" : "")}
      transform={"translate(" + center.x + " " + center.y + ") rotate(" + rotation + ") scale(" + scale + ")"}
      role="button"
      tabIndex="0"
      aria-label={"Select " + facilityTitle(facility) + " facility"}
      onClick={() => onSelect(facility)}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(facility);
        }
      }}
    >
      <ellipse className="gg-world-facility-shadow" cx="0" cy="17" rx="49" ry="18"/>
      <path className="gg-world-facility-base" d="M-48 15 L0 -10 L48 15 L0 39 Z"/>
      <rect className="gg-world-facility-body" x="-27" y="-48" width="54" height="62" rx="5"/>
      <path className="gg-world-facility-roof" d="M-34 -47 L0 -70 L34 -47 Z"/>
      <text className="gg-world-facility-icon" x="0" y="-12" textAnchor="middle">{presentation.icon}</text>
      <g transform={"rotate(" + (-rotation) + ")"}>
        <rect className="gg-world-facility-label-bg" x="-76" y="43" width="152" height="27" rx="13.5"/>
        <text className="gg-world-facility-label" x="0" y="61" textAnchor="middle">{facilityTitle(facility)}</text>
      </g>
    </g>
  );
}

export default function WorldMapView({ world, data, onUpdated, onMessage }) {
  const [selectedFacilityKey, setSelectedFacilityKey] = useState("central-stadium");
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.7 });
  const [saving, setSaving] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const drag = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);

  const width = data.layout.gridWidth;
  const height = data.layout.gridHeight;
  const gridPath = useMemo(() => mapGridPaths(width, height), [width, height]);
  const selectedFacility = data.facilities.find(item => item.facilityKey === selectedFacilityKey) || null;
  const openLandMarkers = LOCAL_OPEN_LAND_MARKERS.filter(plot => {
    const plotBounds = { left: plot.column, top: plot.row, right: plot.column + 6, bottom: plot.row + 5 };
    return !data.facilities.some(facility => {
      const quarterTurn = [90, 270].includes(facility.rotation || 0);
      const width = quarterTurn ? facility.footprint.height : facility.footprint.width;
      const height = quarterTurn ? facility.footprint.width : facility.footprint.height;
      const bounds = {
        left: facility.position.column,
        top: facility.position.row,
        right: facility.position.column + width,
        bottom: facility.position.row + height,
      };
      return plotBounds.left < bounds.right && plotBounds.right > bounds.left &&
        plotBounds.top < bounds.bottom && plotBounds.bottom > bounds.top;
    });
  });

  const pointerDown = event => {
    // Facilities and viewport controls receive their own clicks; camera
    // gestures begin only on empty terrain.
    const isTouch = event.pointerType === "touch";
    const touchOnFacility = isTouch && event.target.closest?.(".gg-world-facility");
    const interactiveTarget = event.target.closest?.(".gg-world-facility, .gg-world-map-controls, button, a, input, textarea, select, [role='button']");
    if (
      (event.button !== 0 && !isTouch) ||
      (interactiveTarget && !touchOnFacility)
    ) return;

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    });
    const touchPointers = [...pointers.current.entries()]
      .filter(([, pointer]) => pointer.pointerType === "touch");
    if (touchPointers.length >= 2) {
      // A pinch may begin on a kingdom/facility. Capture both active pointers
      // only once the gesture is unambiguously a two-finger camera gesture.
      for (const [pointerId] of touchPointers.slice(-2)) {
        event.currentTarget.setPointerCapture?.(pointerId);
      }
      const [first, second] = touchPointers.slice(-2).map(([, pointer]) => pointer);
      pinch.current = {
        pointerIds: touchPointers.slice(-2).map(([id]) => id),
        startDistance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
        startZoom: camera.zoom,
      };
      drag.current = null;
      setIsPanning(true);
      return;
    }

    if (touchOnFacility) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
    };
    setIsPanning(true);
  };

  const pointerMove = event => {
    if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
      });
    }

    if (pinch.current) {
      const [firstId, secondId] = pinch.current.pointerIds;
      const first = pointers.current.get(firstId);
      const second = pointers.current.get(secondId);
      if (!first || !second) return;
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const start = pinch.current;
      setCamera(current => ({
        ...current,
        zoom: Math.max(0.4, Math.min(2.5, start.startZoom * distance / start.startDistance)),
      }));
      return;
    }

    if (!drag.current || drag.current.id !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setCamera(current => ({
      ...current,
      x: drag.current.cameraX + (event.clientX - drag.current.x) * VIEW_WIDTH / Math.max(bounds.width, 1),
      y: drag.current.cameraY + (event.clientY - drag.current.y) * VIEW_HEIGHT / Math.max(bounds.height, 1),
    }));
  };

  const pointerUp = event => {
    pointers.current.delete(event.pointerId);
    if (pinch.current?.pointerIds.includes(event.pointerId)) {
      pinch.current = null;
      const remaining = [...pointers.current.entries()]
        .find(([, pointer]) => pointer.pointerType === "touch");
      if (remaining) {
        const [id, pointer] = remaining;
        drag.current = {
          id,
          x: pointer.x,
          y: pointer.y,
          cameraX: camera.x,
          cameraY: camera.y,
        };
      } else {
        drag.current = null;
      }
    } else if (drag.current?.id === event.pointerId) {
      drag.current = null;
    }

    if (pointers.current.size === 0) setIsPanning(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleWheel = event => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    setCamera(current => ({
      ...current,
      zoom: Math.max(0.4, Math.min(2.5, current.zoom * factor)),
    }));
  };

  const moveSelected = async (deltaColumn, deltaRow) => {
    if (!data.permissions?.canEditMap || !selectedFacility || saving) return;
    const nextPosition = {
      column: selectedFacility.position.column + deltaColumn,
      row: selectedFacility.position.row + deltaRow,
    };

    setSaving(true);
    try {
      const result = await api(
        "/worlds/" + encodeURIComponent(world.slug) +
        "/map/facilities/" + encodeURIComponent(selectedFacility.facilityKey),
        {
          method: "PATCH",
          body: {
            expectedLayoutVersion: data.layout.layoutVersion,
            position: nextPosition,
            rotation: selectedFacility.rotation,
          },
        },
      );
      onMessage?.(facilityTitle(selectedFacility) + " placement saved.");
      await onUpdated?.(result);
    } catch (error) {
      onMessage?.(error?.message || "Could not move this facility.");
    } finally {
      setSaving(false);
    }
  };

  const rotateSelected = async () => {
    if (!data.permissions?.canEditMap || !selectedFacility || saving) return;
    setSaving(true);
    try {
      const result = await api(
        "/worlds/" + encodeURIComponent(world.slug) +
        "/map/facilities/" + encodeURIComponent(selectedFacility.facilityKey),
        {
          method: "PATCH",
          body: {
            expectedLayoutVersion: data.layout.layoutVersion,
            position: selectedFacility.position,
            rotation: (selectedFacility.rotation + 90) % 360,
          },
        },
      );
      onMessage?.(facilityTitle(selectedFacility) + " rotated.");
      await onUpdated?.(result);
    } catch (error) {
      onMessage?.(error?.message || "Could not rotate this facility.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="gg-world-map-view" aria-label={world.name + " World map"}>
      <div className="gg-world-map-heading">
        <div>
          <span className="gg-global-map-eyebrow">WORLD INTERIOR · {data.layout.theme.toUpperCase()}</span>
          <h2>{world.name}</h2>
          <p>{data.facilities.length} facilities · {width} × {height} tile map</p>
        </div>
        <span className="gg-world-map-version">LAYOUT v{data.layout.layoutVersion}</span>
      </div>

      <div
        className="gg-world-map-viewport"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onWheel={handleWheel}
      >
        <svg
          className="gg-world-map-svg"
          viewBox={"0 0 " + VIEW_WIDTH + " " + VIEW_HEIGHT}
          preserveAspectRatio="xMidYMid slice"
          role="group"
          aria-label="Isometric World facilities map"
        >
          <defs>
            <linearGradient id="gg-world-ground" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#637c56"/>
              <stop offset="100%" stopColor="#344f3d"/>
            </linearGradient>
          </defs>
          <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="#18323b"/>
          <g
            className={isPanning ? "gg-world-map-camera is-panning" : "gg-world-map-camera"}
            transform={"translate(" + (VIEW_WIDTH / 2 + camera.x) + " " + (VIEW_HEIGHT / 2 + camera.y) + ") scale(" + camera.zoom + ") translate(" + (-VIEW_WIDTH / 2) + " " + (-VIEW_HEIGHT / 2) + ")"}
          >
            <path
              className="gg-world-map-ground"
              d={[
                project(0, 0),
                project(width, 0),
                project(width, height),
                project(0, height),
              ].map((point, index) => (index === 0 ? "M" : "L") + point.x + " " + point.y).join(" ") + " Z"}
              fill="url(#gg-world-ground)"
            />
            <path className="gg-world-map-grid" d={gridPath}/>
            <path className="gg-world-map-road" d="M380 470 C600 360 740 580 930 470 S1280 340 1510 540"/>
            {openLandMarkers.map(plot => (
              <LocalOpenLandMarker key={plot.column + "-" + plot.row} plot={plot}/>
            ))}
            {data.facilities.map(facility => (
              <FacilityBuilding
                key={facility.facilityKey}
                facility={facility}
                selected={selectedFacilityKey === facility.facilityKey}
                onSelect={item => setSelectedFacilityKey(item.facilityKey)}
              />
            ))}
          </g>
        </svg>
        <div className="gg-world-map-controls">
          <button type="button" onClick={() => setCamera(current => ({ ...current, zoom: Math.min(2.5, current.zoom + 0.15) }))} aria-label="Zoom in">＋</button>
          <button type="button" onClick={() => setCamera(current => ({ ...current, zoom: Math.max(0.4, current.zoom - 0.15) }))} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setCamera({ x: 0, y: 0, zoom: 0.7 })} aria-label="Reset World map">⌖</button>
        </div>
        <div className="gg-world-map-hint">Drag to explore · Select a facility</div>
      </div>

      <aside className="gg-world-facility-panel" aria-label="Selected facility details">
        {selectedFacility ? (
          <>
            <div>
              <span className="gg-world-facility-kicker">SELECTED FACILITY</span>
              <h3>{facilityTitle(selectedFacility)}</h3>
              <p>Grid {selectedFacility.position.column}, {selectedFacility.position.row} · Rotation {selectedFacility.rotation}° · Level {selectedFacility.level}</p>
            </div>
            {data.permissions?.canEditMap ? (
              <div className="gg-world-facility-editor">
                <div className="gg-world-facility-move" aria-label="Move selected facility">
                  <button type="button" aria-label="Move north" disabled={saving} onClick={() => moveSelected(0, -1)}>↑</button>
                  <button type="button" aria-label="Move west" disabled={saving} onClick={() => moveSelected(-1, 0)}>←</button>
                  <button type="button" aria-label="Move south" disabled={saving} onClick={() => moveSelected(0, 1)}>↓</button>
                  <button type="button" aria-label="Move east" disabled={saving} onClick={() => moveSelected(1, 0)}>→</button>
                </div>
                <button type="button" className="gg-world-rotate-button" disabled={saving} onClick={rotateSelected}>
                  {saving ? "Saving…" : "Rotate 90°"}
                </button>
              </div>
            ) : (
              <span className="gg-world-map-readonly">Read-only map access</span>
            )}
          </>
        ) : (
          <p>Select a facility to view its details.</p>
        )}
      </aside>
      <p className="gg-world-map-footnote">
        {data.permissions?.canEditMap
          ? "Map edits are saved to this World and tracked by a layout version."
          : "Only this World's owner/admin can change facility placement."}
      </p>
    </section>
  );
}
