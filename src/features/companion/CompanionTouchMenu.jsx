const icons = {
  games: "M8 6h8c2.1 0 3.5 1.1 4 3l1.7 6.4a2.5 2.5 0 0 1-4.1 2.5L14.5 15h-5l-3.1 2.9a2.5 2.5 0 0 1-4.1-2.5L4 9c.5-1.9 1.9-3 4-3Zm0 3v5m-2.5-2.5h5m5-1h.1m2.4 2h.1",
  world: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18ZM3 12h18M12 3c-5 4-5 14 0 18m0-18c5 4 5 14 0 18",
  emote: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18Zm0 5 4 3-1.5 4.5h-5L8 11l4-3Zm0 0V3m9 6-5 2m2 7-3.5-2.5m-9 2.5 4-2.5M3 9l5 2",
  celebration: "M7 3h10v6a5 5 0 1 1-10 0V3Zm0 2H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4m-5 3v6m-4 1h8",
};

export default function CompanionTouchMenu({ layout }) {
  return <svg className="gg-companion-touch-menu" viewBox="-72 -72 144 144" aria-hidden="true"
    data-arc-side={layout.side} style={{ left: layout.x, top: layout.y }}>
    <path className="gg-companion-touch-rim" d={layout.arc} />
    <path className="gg-companion-touch-track" d={layout.arc} />
    {layout.options.map(({ action, x, y }) => <g key={action} data-companion-action={action}
      transform={"translate(" + x + " " + y + ")"}>
      <circle r="12" />
      <path className="gg-companion-touch-icon" transform="translate(-9 -9) scale(.75)" d={icons[action]} />
    </g>)}
  </svg>;
}
