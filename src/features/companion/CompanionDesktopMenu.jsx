import { actionIcons, companionActions } from "./companionTouchLayout";

export default function CompanionDesktopMenu({ menuRef, layout, onSelect }) {
  return <div className="gg-companion-actions" ref={menuRef} role="group" aria-label="Companion actions"
    data-arc-side={layout.side}>
    <svg viewBox="-72 -72 144 144" aria-hidden="true">
      <path className="gg-companion-touch-rim" d={layout.arc} />
      <path className="gg-companion-touch-track" d={layout.arc} />
    </svg>
    {layout.options.map(({ action, x, y }, index) => {
      const label = companionActions[index][1];
      return <button key={action} type="button" data-companion-action={action} aria-label={label}
        style={{ left: 72 + x, top: 72 + y }} onClick={() => onSelect(action)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path className="gg-companion-touch-icon" d={actionIcons[action]} /></svg>
        <span aria-hidden="true">{label}</span>
      </button>;
    })}
  </div>;
}
