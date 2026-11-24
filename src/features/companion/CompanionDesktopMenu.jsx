import { useId } from "react";
import { companionActions } from "./companionTouchLayout";

const width = 352;
const height = 82;
const firstX = 17;
const span = width - firstX * 2;
const breaks = [0, .145, .48, .635, 1];

function point(t, below) {
  const y = 18 + 40 * (2 * t - 1) ** 2;
  return { x: firstX + span * t, y: below ? height - y : y };
}

function path(from, to, below, offset = 0) {
  const start = point(from, below);
  const end = point(to, below);
  const middle = point((from + to) / 2, below);
  const controlY = 2 * middle.y - (start.y + end.y) / 2;
  return "M" + start.x + " " + (start.y + offset) + " Q" +
    middle.x + " " + (controlY + offset) + " " + end.x + " " + (end.y + offset);
}

export default function CompanionDesktopMenu({ menuRef, below, onSelect }) {
  const id = useId();
  const track = path(0, 1, below);
  return <div className="gg-companion-actions" ref={menuRef} role="group" aria-label="Companion actions"
    data-below={below || undefined}>
    <svg viewBox={"0 0 " + width + " " + height} aria-hidden="true">
      <defs>
        <mask id={id + "-track"}><path d={track} fill="none" stroke="white" strokeWidth="30" strokeLinecap="round" /></mask>
      </defs>
      <path className="gg-companion-menu-rim" d={track} />
      <path className="gg-companion-menu-track" d={track} />
      {companionActions.map(([action, label], index) => {
        const from = breaks[index];
        const to = breaks[index + 1];
        const labelId = id + "-" + action;
        return <g key={action} data-menu-segment={action}>
          <path className="gg-companion-menu-highlight" d={path(from, to, below)} mask={"url(#" + id + "-track)"} />
          <path id={labelId} d={path(from, to, below, 4)} fill="none" />
          <text><textPath href={"#" + labelId} startOffset="50%">{label}</textPath></text>
        </g>;
      })}
    </svg>
    {companionActions.map(([action, label], index) => {
      const from = breaks[index];
      const to = breaks[index + 1];
      const center = point((from + to) / 2, below);
      return <button key={action} type="button" data-companion-action={action} aria-label={label}
        style={{ left: center.x / width * 100 + "%", top: center.y / height * 100 + "%",
          width: (to - from) * span / width * 100 + "%" }}
        onClick={() => onSelect(action)} />;
    })}
  </div>;
}
