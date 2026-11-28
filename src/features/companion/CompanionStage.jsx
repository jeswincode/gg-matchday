import { useEffect, useEffectEvent, useRef, useState } from "react";
import CompanionPlayer from "./CompanionPlayer";
import CompanionDesktopMenu from "./CompanionDesktopMenu.jsx";
import CompanionTouchMenu from "./CompanionTouchMenu.jsx";
import runCompanion from "./runCompanion";
import { useWorkspaceBrand } from "../communities/WorkspaceBrand.jsx";
import { useCompanionGuide } from "./useCompanionGuide";

export default function CompanionStage({ account, look, celebration, legacy, guide, onVote, onFixture }) {
  const brand = useWorkspaceBrand();
  const stage = useRef(null);
  const token = useRef(null);
  const bubble = useRef(null);
  const menu = useRef(null);
  const [menuMode, setMenuMode] = useState(null);
  const open = menuMode !== null;
  const desktopMenu = menuMode?.type === "desktop";
  const currentAccount = useEffectEvent(() => account);
  const currentCelebration = useEffectEvent(() => celebration);
  const brief = useCompanionGuide(legacy ? null : account, guide, onVote, onFixture);
  const currentGuide = useEffectEvent(() => brief);

  function selectAction(action) {
    setMenuMode(null);
    token.current?.focus({ preventScroll: true });
    const detail = action === "world" || action === "games" ? { type: "say", text: "Work in Progress" }
      : { type: action === "emote" ? "skill" : "emote" };
    window.dispatchEvent(new CustomEvent("gg:companion", { detail }));
  }
  const selectFromGesture = useEffectEvent(selectAction);

  useEffect(() => {
    return runCompanion(stage.current, token.current, bubble.current,
      document.querySelectorAll(".gg-companion-rail"), {
        legacy, account: currentAccount, celebration: currentCelebration, guide: currentGuide,
        showMenu: setMenuMode,
        hideMenu: () => setMenuMode(null),
        selectMenu: selectFromGesture,
      });
  }, [legacy]);

  useEffect(() => {
    if (!desktopMenu) return;
    if (menuMode.keyboard) menu.current?.querySelector("button")?.focus({ preventScroll: true });
    function dismiss(event) {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && (menu.current?.contains(event.target) || token.current?.contains(event.target))) return;
      setMenuMode(null);
      if (event.type === "keydown") token.current?.focus();
    }
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
    };
  }, [desktopMenu, menuMode]);

  return (
    <div className="gg-companion-stage" data-legacy={legacy || undefined} ref={stage} data-no-tab-swipe>
      <button type="button" className="gg-companion-token" ref={token}
        aria-label={legacy ? brand.companion + " preview" : brand.companion}
        aria-expanded={legacy ? undefined : open} aria-keyshortcuts={legacy ? undefined : "Shift+F10 ArrowDown"}
        title={legacy ? undefined : "Tap for a tip. Right-click, or hold for 0.8 seconds and drag to choose an action."} hidden>
        <CompanionPlayer look={look} />
      </button>
      <svg className="gg-companion-ball" viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true">
        <path className="gg-ball-shell" d="M8 2h8v2h4v4h2v8h-2v4h-4v2H8v-2H4v-4H2V8h2V4h4Z" />
        <path className="gg-ball-panels" d="M8 3h5v4h-3v3H5V7h3Zm9 5h4v7h-4v-3h-3V9h3ZM7 14h5v4h4v3H8v-3H5v-3h2Z" />
        <path className="gg-ball-shine" d="M8 5h3v2H8Zm9 11h2v2h-2Z" />
      </svg>
      <svg className="gg-companion-sparks" viewBox="0 0 44 44" shapeRendering="crispEdges" aria-hidden="true">
        <path className="gg-spark-wave" d="M10 12h3v-3h4V7h12v2h4v3h3v8h-2v-7h-3v-2H15v2h-3v5h-2Zm3 16h3v3h4v2h10v2H19v-2h-5v-3h-1Z" />
        <path className="gg-spark-fire" d="M7 8h3v3H7Zm26-4h4v4h-4ZM4 23h5v2H4Zm31-1h3v4h-3Zm-12 16h3v3h-3Z" />
      </svg>
      <div className="gg-companion-speech" ref={bubble} hidden />
      {open && (desktopMenu
        ? <CompanionDesktopMenu menuRef={menu} layout={menuMode} onSelect={selectAction} />
        : <CompanionTouchMenu layout={menuMode} />)}
    </div>
  );
}
