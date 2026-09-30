import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PERFORMANCE_CODE_CATEGORIES } from "./matchCalculator";

function getPerformanceLabel(code) {
  for (const category of PERFORMANCE_CODE_CATEGORIES) {
    const entry = category.codes.find(item => item.code === code);
    if (entry) return entry.label;
  }
  return code;
}

export default function PerformancePicker({ value = [], onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selected = new Set(value);

  useEffect(() => {
    if (!open) return undefined;
    function positionMenu() {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const rect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const gap = 7;
      const padding = 12;
      const left = Math.max(padding, Math.min(rect.left, window.innerWidth - menuRect.width - padding));
      const spaceBelow = window.innerHeight - rect.bottom - padding;
      const top = spaceBelow >= menuRect.height + gap ? rect.bottom + gap : Math.max(padding, rect.top - menuRect.height - gap);
      setMenuPosition({ top, left });
    }
    function handlePointerDown(event) {
      const target = event.target;
      if (!pickerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    const frame = window.requestAnimationFrame(positionMenu);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  function toggle(code, category) {
    const categoryCodes = PERFORMANCE_CODE_CATEGORIES.find(item => item.key === category)?.codes || [];
    const withoutCategory = [...selected].filter(existing => !categoryCodes.some(item => item.code === existing));
    onChange(selected.has(code) ? withoutCategory : [...withoutCategory, code]);
  }

  const selectedLabels = value.map(getPerformanceLabel).join(" · ");
  const menu = open ? (
    <div ref={menuRef} className="gg-code-menu gg-code-menu-portal" role="dialog" aria-label="Performance codes" style={{ top: menuPosition.top + "px", left: menuPosition.left + "px" }}>
      <div className="gg-code-menu-header">
        <span>Select one level per category</span>
        <button type="button" onClick={() => onChange([])} disabled={!value.length}>Clear</button>
      </div>
      <div className="gg-code-menu-scroll">
        {PERFORMANCE_CODE_CATEGORIES.map(category => (
          <div className="gg-code-menu-category" key={category.key}>
            <span>{category.label}</span>
            <div>
              {category.codes.map(code => (
                <button type="button" key={code.code} aria-pressed={selected.has(code.code)} className={selected.has(code.code) ? "active" : ""} onClick={() => toggle(code.code, category.key)}>
                  {code.label}<small>{code.match > 0 ? "+" : ""}{code.match.toFixed(2)}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className={"gg-code-dropdown" + (open ? " is-open" : "")} ref={pickerRef}>
      <button ref={triggerRef} type="button" className={"gg-code-trigger " + (open ? "open" : "")} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(current => !current)}>
        <span className="gg-code-trigger-text">{selectedLabels || "Choose performance codes"}</span>
        <span className="gg-code-count">{value.length}</span>
        <span className="gg-code-chevron" aria-hidden="true">⌄</span>
      </button>
      {typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}
