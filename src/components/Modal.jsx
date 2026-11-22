import { createPortal } from "react-dom";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";

const tabbable = "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex='0']";
const exitDuration = 145;

export default function Modal({ title, onClose, children, className = "" }) {
  const dialogRef = useRef(null);
  const heading = useId();
  const [closing, setClosing] = useState(false);
  const finishClose = useEffectEvent(() => onClose());

  function dismiss() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) onClose();
    else setClosing(true);
  }

  const closeFromKeyboard = useEffectEvent(dismiss);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(finishClose, exitDuration + 35);
    return () => window.clearTimeout(timer);
  }, [closing]);

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
    <div className="gg-backdrop" data-closing={closing ? "" : undefined} style={{ "--signature-dialog-exit": exitDuration + "ms" }}
      onMouseDown={event => event.target === event.currentTarget && dismiss()}>
      <section ref={dialogRef} className={`gg-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={heading}
        onAnimationEnd={event => {
          if (closing && event.target === event.currentTarget && event.animationName === "signature-dialog-out") onClose();
        }}>
        <header className="gg-modal-head">
          <div><p className="eyebrow">GG MATCHDAY</p><h2 id={heading}>{title}</h2></div>
          <button type="button" className="secondary-button" aria-label="Close dialog" onClick={dismiss}>×</button>
        </header>
        {children}
      </section>
    </div>
  );
  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
