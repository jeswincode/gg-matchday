import { useEffect, useRef, useState } from "react";

const icons = {
  overview: "M3 10 12 3l9 7v10H3Z M9 20v-6h6v6",
  myClub: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z M8 12l3 3 5-5",
  matches: "M4 6h16v14H4Z M4 10h16 M8 3v5m8-5v5 M8 15h2m4 0h2",
  betting: "M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4Z M12 8v2m0 2v2m0 2v1",
  playerDesk: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M5 21v-2a7 7 0 0 1 14 0v2",
  market: "M4 8h15l-3-3m3 3-3 3 M20 16H5l3-3m-3 3 3 3",
  players: "M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M7 20v-2a5 5 0 0 1 10 0v2 M4 8a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6",
  reviews: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z",
  admin: "M4 5h6v6H4Zm10 0h6v6h-6ZM4 15h6v6H4Zm10 0h6v6h-6Z",
  adminApplications: "M6 4h12v16H6Z M9 9h6m-6 4h6m-6 4h4",
  more: "M5 12h.1m6.9 0h.1m6.9 0h.1",
};

function NavigationIcon({ name }) {
  const mapped = { adminDashboard: "admin", adminClubs: "myClub", adminMatches: "matches" }[name] || name;
  return (
    <svg className="clubs-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth={name === "more" ? 3 : 1.65} strokeLinecap="round" strokeLinejoin="round">
      <path d={icons[mapped]} />
    </svg>
  );
}

export default function ClubsNavigation({ items, active, onNavigate, adminOnly }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigation = useRef(null);
  const moreButton = useRef(null);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const dismiss = event => {
      if (navigation.current?.contains(event.target)) return;
      setMoreOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [moreOpen]);

  function choose(item, event) {
    if (item.secondary && moreButton.current?.getClientRects().length && event.detail === 0) {
      moreButton.current.focus();
    }
    setMoreOpen(false);
    onNavigate(item.key);
  }

  const renderItem = item => (
    <button key={item.key} type="button" data-primary-tab={item.key} aria-current={active === item.key ? "page" : undefined}
      aria-label={item.badge ? `${item.label}, ${item.badge} pending` : item.label}
      className={active === item.key ? "active" : ""} onClick={event => choose(item, event)}>
      <NavigationIcon name={item.key} />
      <span>{item.label}</span>
      {item.badge > 0 && <span className="clubs-nav-badge" aria-hidden="true">{item.badge}</span>}
    </button>
  );

  const secondary = items.filter(item => item.secondary);
  return (
    <nav ref={navigation} className="clubs-nav clubs-destination-nav" aria-label={adminOnly ? "Clubs admin navigation" : "Clubs navigation"}
      onKeyDown={event => {
        if (event.key !== "Escape" || !moreOpen) return;
        setMoreOpen(false);
        moreButton.current?.focus();
      }}>
      <div className="clubs-nav-main">{items.filter(item => !item.secondary).map(renderItem)}</div>
      {secondary.length > 0 && <>
        <button ref={moreButton} type="button" className="clubs-nav-more" aria-expanded={moreOpen}
          aria-controls="clubs-secondary-destinations" data-section-active={secondary.some(item => item.key === active)}
          onClick={() => setMoreOpen(open => !open)}>
          <NavigationIcon name="more" /><span>More</span>
        </button>
        <div id="clubs-secondary-destinations" className="clubs-nav-secondary" data-open={moreOpen}>
          {secondary.map(renderItem)}
        </div>
      </>}
    </nav>
  );
}
