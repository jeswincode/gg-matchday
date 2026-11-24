import { actionIcons } from "./companionTouchLayout";

export default function CompanionTouchMenu({ layout }) {
  return <svg className="gg-companion-touch-menu" viewBox="-72 -72 144 144" aria-hidden="true"
    data-arc-side={layout.side} style={{ left: layout.x, top: layout.y }}>
    <path className="gg-companion-touch-rim" d={layout.arc} />
    <path className="gg-companion-touch-track" d={layout.arc} />
    {layout.options.map(({ action, x, y }) => <g key={action} data-companion-action={action}
      transform={"translate(" + x + " " + y + ")"}>
      <circle r="12" />
      <path className="gg-companion-touch-icon" transform="translate(-9 -9) scale(.75)" d={actionIcons[action]} />
    </g>)}
  </svg>;
}
