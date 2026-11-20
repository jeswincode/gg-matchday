import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { scrollToPagerStart } from "../lib/pagerScroll";
import "./swipe-pager.css";

function blocksSwipe(target, root) {
  if (!(target instanceof Element)) return true;
  if (target.closest("button, a, input, textarea, select, label, summary, [contenteditable], [role=dialog], [data-no-tab-swipe]")) return true;
  for (let element = target; element && element !== root; element = element.parentElement) {
    if (element.scrollWidth > element.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(element).overflowX)) return true;
  }
  return false;
}

export default function SwipePager({ tabs, active, onNavigate, renderPane, id }) {
  const surface = useRef(null);
  const gesture = useRef(null);
  const frame = useRef(0);
  const timer = useRef(0);
  const activeIndex = tabs.indexOf(active);

  function reset(element) {
    cancelAnimationFrame(frame.current);
    clearTimeout(timer.current);
    gesture.current = null;
    delete element.dataset.swiping;
    delete element.dataset.settling;
    element.style.removeProperty("--pager-x");
    element.style.removeProperty("--pager-top");
  }

  useEffect(() => {
    const element = surface.current;
    return () => { if (element) reset(element); };
  }, [active]);

  function start(event) {
    const element = event.currentTarget;
    if (element.dataset.settling || tabs.length < 2) return;
    if (event.touches.length !== 1 || blocksSwipe(event.target, element)) {
      reset(element);
      return;
    }
    const { clientX: x, clientY: y } = event.touches[0];
    if (x < 20 || x > window.innerWidth - 20) return;
    gesture.current = { x, y, at: event.timeStamp, direction: 0 };
  }

  function move(event) {
    const current = gesture.current;
    const element = event.currentTarget;
    if (!current) return;
    if (event.touches.length !== 1) { reset(element); return; }
    const { clientX, clientY } = event.touches[0];
    const dx = clientX - current.x;
    const dy = clientY - current.y;
    if (!current.direction) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { reset(element); return; }
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      current.direction = dx < 0 ? 1 : -1;
      current.width = element.clientWidth;
      element.dataset.swiping = current.direction > 0 ? "next" : "previous";
      element.style.setProperty("--pager-top", Math.max(0, -element.getBoundingClientRect().top) + "px");
    }
    const available = tabs[activeIndex + current.direction];
    const distance = Math.min(current.width, Math.max(0, dx * -current.direction));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() =>
      element.style.setProperty("--pager-x", (-current.direction * distance * (available ? 1 : .17)) + "px"));
  }

  function finish(event, cancelled = false) {
    const current = gesture.current;
    gesture.current = null;
    if (!current?.direction) {
      // Some short touch sequences arrive with a start and end only.
      if (!cancelled && current && event.changedTouches.length === 1) {
        const finger = event.changedTouches[0];
        const dx = finger.clientX - current.x;
        const dy = finger.clientY - current.y;
        const next = tabs[activeIndex + (dx < 0 ? 1 : -1)];
        if (next && Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          onNavigate(next);
          scrollToPagerStart(event.currentTarget);
        }
      }
      return;
    }
    const element = event.currentTarget;
    cancelAnimationFrame(frame.current);
    const next = tabs[activeIndex + current.direction];
    const distance = (current.x - (event.changedTouches[0]?.clientX ?? current.x)) * current.direction;
    const flick = distance >= 24 && distance / Math.max(1, event.timeStamp - current.at) >= .42;
    const commit = !cancelled && next && (distance >= Math.min(68, current.width * .18) || flick);
    const settle = () => {
      if (commit) {
        flushSync(() => onNavigate(next));
        scrollToPagerStart(element);
      }
      reset(element);
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { settle(); return; }
    element.dataset.settling = "";
    element.style.setProperty("--pager-x", (commit ? -current.direction * current.width : 0) + "px");
    timer.current = window.setTimeout(settle, 155);
  }

  return (
    <div id={id} ref={surface} className="swipe-pager" onTouchStart={start} onTouchMove={move}
      onTouchEnd={finish} onTouchCancel={event => finish(event, true)}>
      {tabs.map((tab, index) => (
        <div className="swipe-pane" key={tab} data-pane={index === activeIndex ? "current" :
          index === activeIndex + 1 ? "next" : index === activeIndex - 1 ? "previous" : "parked"}
          inert={index !== activeIndex}>
          {renderPane(tab)}
        </div>
      ))}
    </div>
  );
}
