import { useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import "./world-map-view.css";

const VIEW_WIDTH = 1920;
const VIEW_HEIGHT = 1080;
const TILE_WIDTH = 32;
const TILE_HEIGHT = 16;
const ORIGIN_X = VIEW_WIDTH / 2;
const ORIGIN_Y = 60;

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
  const drag = useRef(null);

  const width = data.layout.gridWidth;
  const height = data.layout.gridHeight;
  const gridPath = useMemo(() => mapGridPaths(width, height), [width, height]);
  const selectedFacility = data.facilities.find(item => item.facilityKey === selectedFacilityKey) || null;

  const pointerDown = event => {
    // Facilities and viewport controls must receive their own clicks;
    // camera pointer capture is reserved for empty terrain.
    if (
      event.button !== 0 ||
      event.target.closest?.(".gg-world-facility, .gg-world-map-controls, button, a, input, textarea, select, [role='button']")
    ) return;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const pointerMove = event => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setCamera(current => ({
      ...current,
      x: drag.current.cameraX + (event.clientX - drag.current.x) * VIEW_WIDTH / Math.max(bounds.width, 1),
      y: drag.current.cameraY + (event.clientY - drag.current.y) * VIEW_HEIGHT / Math.max(bounds.height, 1),
    }));
  };

  const pointerUp = event => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
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
      >
        <svg
          className="gg-world-map-svg"
          viewBox={"0 0 " + VIEW_WIDTH + " " + VIEW_HEIGHT}
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
