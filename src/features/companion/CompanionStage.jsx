import { useEffect, useEffectEvent, useRef, useState } from "react";
import CompanionPlayer from "./CompanionPlayer";
import runCompanion from "./runCompanion";

export default function CompanionStage({ account, look, legacy, onWorld }) {
  const stage = useRef(null);
  const token = useRef(null);
  const bubble = useRef(null);
  const menu = useRef(null);
  const [open, setOpen] = useState(false);
  const currentAccount = useEffectEvent(() => account);

  useEffect(() => runCompanion(stage.current, token.current, bubble.current,
    document.querySelectorAll(".gg-companion-rail"), {
      legacy, account: currentAccount,
      showMenu: () => setOpen(true), hideMenu: () => setOpen(false),
    }), [legacy]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector("button")?.focus();
    function dismiss(event) {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && (menu.current?.contains(event.target) || token.current?.contains(event.target))) return;
      setOpen(false);
      if (event.type === "keydown") token.current?.focus();
    }
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
    };
  }, [open]);

  function emote() {
    setOpen(false);
    token.current?.focus();
    window.dispatchEvent(new CustomEvent("gg:companion", { detail: { type: "emote" } }));
  }

  return (
    <div className="gg-companion-stage" data-legacy={legacy || undefined} ref={stage} data-no-tab-swipe>
      <button type="button" className="gg-companion-token" ref={token}
        aria-label={legacy ? "GG Companion preview" : "GG Companion"}
        aria-expanded={legacy ? undefined : open} aria-keyshortcuts={legacy ? undefined : "Shift+F10 ArrowDown"}
        title={legacy ? undefined : "Tap for a tip. Right-click or hold for actions."} hidden>
        <CompanionPlayer look={look} />
      </button>
      <p className="gg-companion-speech" ref={bubble} role="status" hidden />
      {open && <div className="gg-companion-actions" ref={menu} role="group" aria-label="Companion actions">
        <button type="button" onClick={() => { setOpen(false); token.current?.focus(); onWorld(); }}>
          <span aria-hidden="true">◉</span> Enter Community World
        </button>
        <button type="button" onClick={emote}><span aria-hidden="true">✦</span> Emote</button>
      </div>}
    </div>
  );
}
