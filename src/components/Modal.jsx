import { createPortal } from "react-dom";
import { useEffect, useEffectEvent, useId, useRef } from "react";

const tabbable = "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex='0']";

export default function Modal({ title, onClose, children, className = "" }) {
  const dialogRef = useRef(null);
  const heading = useId();
  const closeFromKeyboard = useEffectEvent(() => onClose());

  useEffect(() => {
    const dialog = dialogRef.current;
    const prior = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector("button")?.focus();

    function handleKey(event) {
      if (event.key === "Escape") closeFromKeyboard();
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll(tabbable)].filter(node => node.offsetParent !== null);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKey);
      prior?.focus();
    };
  }, []);

  const modal = (
    <div className="gg-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className={`gg-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={heading}>
        <header className="gg-modal-head">
          <div><p className="eyebrow">GG MATCHDAY</p><h2 id={heading}>{title}</h2></div>
          <button type="button" className="secondary-button" aria-label="Close dialog" onClick={onClose}>×</button>
        </header>
        {children}
      </section>
    </div>
  );
  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
