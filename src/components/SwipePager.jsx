import { useEffect, useEffectEvent, useRef } from "react";
import { flushSync } from "react-dom";
import { useTabScroll } from "../lib/tabHistory";
import "./swipe-pager.css";

function isHorizontalScroller(target, root) {
  for (let element = target; element && element !== root; element = element.parentElement) {
    if (element.scrollWidth > element.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(element).overflowX)) return true;
  }
  return false;
}

export default function SwipePager({ tabs, active, onNavigate, onMotionChange, renderPane, id }) {
  const surface = useRef(null);
  const readTabs = useEffectEvent(() => tabs);
  const navigate = useEffectEvent(tab => onNavigate(tab));
  const reportMotion = useEffectEvent(moving => onMotionChange?.(moving));
  const activeIndex = tabs.indexOf(active);
  useTabScroll(id, active);

  useEffect(() => {
    const pager = surface.current;
    const area = pager.closest("[data-page-swipes]") || pager;
    const activePane = () => pager.querySelector('[data-pane="current"]');
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let gesture;
    let frame = 0;
    let completeSettle;
    let settleTimer = 0;
    let suppressClickUntil = 0;
    let movingPane;
    let movingNeighbor;

    function clearMotion() {
      cancelAnimationFrame(frame);
      frame = 0;
      clearTimeout(settleTimer);
      completeSettle = undefined;
      delete pager.dataset.swiping;
      delete pager.dataset.settling;
      movingPane?.style.removeProperty("transform");
      movingNeighbor?.style.removeProperty("transform");
      movingPane = movingNeighbor = undefined;
      reportMotion(false);
    }

    function paint(current, offset, direction) {
      const neighbor = direction === 1 ? current.pane.nextElementSibling : current.pane.previousElementSibling;
      if (movingNeighbor !== neighbor) movingNeighbor?.style.removeProperty("transform");
      movingPane = current.pane;
      movingNeighbor = neighbor;
      const activeDirection = direction === 1 ? "next" : "previous";
      if (pager.dataset.swiping !== activeDirection) pager.dataset.swiping = activeDirection;
      movingPane.style.transform = `translate3d(${offset}px, 0, 0)`;
      if (movingNeighbor) {
        movingNeighbor.style.transform = `translate3d(calc(${direction * 100}% + ${offset}px), ${current.top}px, 0)`;
      }
    }

    function start(event) {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        suppressClickUntil = 0;
        return;
      }
      if (!event.isPrimary) {
        gesture = undefined;
        clearMotion();
        return;
      }
      // A fresh swipe can immediately pick up where the last swipe landed.
      completeSettle?.();
      suppressClickUntil = 0;
      const target = event.target;
      if (!(target instanceof Element) || target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false]), [role=dialog], [role=slider], [data-no-tab-swipe]")) return;
      const order = readTabs();
      const pane = activePane();
      const index = order.findIndex(key => String(key) === pane?.dataset.tab);
      if (order.length < 2 || index < 0) return;
      gesture = {
        pointer: event.pointerId, x: event.clientX, y: event.clientY,
        startedAt: event.timeStamp, sampleX: event.clientX, sampleTime: event.timeStamp,
        speed: 0, order, index, pane, target, locked: false,
      };
    }

    function move(event) {
      const current = gesture;
      if (current?.pointer !== event.pointerId) return;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.locked) {
        if (Math.abs(dy) >= 12 && Math.abs(dy) > Math.abs(dx) * 1.2) { gesture = undefined; return; }
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy) * 1.08) return;
        if (isHorizontalScroller(current.target, area)) { gesture = undefined; return; }
        current.locked = true;
        const bounds = pager.getBoundingClientRect();
        current.width = bounds.width;
        current.top = Math.max(0, -bounds.top);
        area.setPointerCapture(event.pointerId);
        reportMotion(true);
      }
      const interval = event.timeStamp - current.sampleTime;
      if (interval >= 8) {
        current.speed = (event.clientX - current.sampleX) / interval;
        current.sampleTime = event.timeStamp;
        current.sampleX = event.clientX;
      }
      current.direction = dx <= 0 ? 1 : -1;
      const hasNeighbor = current.order[current.index + current.direction] !== undefined;
      current.offset = Math.max(-current.width, Math.min(current.width, dx)) * (hasNeighbor ? 1 : .17);
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        paint(current, current.offset, current.direction);
      });
    }

    function release(event) {
      const current = gesture;
      if (current?.pointer !== event.pointerId) return;
      gesture = undefined;
      if (!current.locked) return;
      suppressClickUntil = event.timeStamp + 350;
      cancelAnimationFrame(frame);
      const dx = event.clientX - current.x;
      const distance = Math.abs(dx);
      const direction = dx <= 0 ? 1 : -1;
      const elapsed = Math.max(1, event.timeStamp - current.startedAt);
      const recentSpeed = event.timeStamp - current.sampleTime <= 85 ? -current.speed * direction : 0;
      const flick = distance >= 18 && (recentSpeed >= .26 || (elapsed <= 100 && distance / elapsed >= .26));
      const deliberate = distance >= Math.max(28, Math.min(46, current.width * .09));
      const next = (deliberate || flick) ? current.order[current.index + direction] : undefined;
      completeSettle = () => {
        clearMotion();
        if (next === undefined || activePane() !== current.pane) return;
        flushSync(() => navigate(next));
      };
      if (reducedMotion.matches || !pager.dataset.swiping) {
        completeSettle();
        return;
      }
      pager.dataset.settling = "";
      paint(current, next === undefined ? 0 : -direction * current.width, direction);
      settleTimer = window.setTimeout(completeSettle, 125);
    }

    function cancel(event) {
      if (gesture?.pointer !== event.pointerId) return;
      gesture = undefined;
      clearMotion();
    }

    function captureClick(event) {
      if (event.detail === 0 || event.timeStamp > suppressClickUntil) return;
      event.preventDefault();
      event.stopPropagation();
    }

    function finishTransition(event) {
      if (event.propertyName === "transform" && event.target.parentElement === pager && event.target.dataset.pane === "current") {
        completeSettle?.();
      }
    }

    area.addEventListener("pointerdown", start);
    area.addEventListener("pointermove", move);
    area.addEventListener("pointerup", release);
    area.addEventListener("pointercancel", cancel);
    area.addEventListener("click", captureClick, true);
    pager.addEventListener("transitionend", finishTransition);
    return () => {
      clearMotion();
      area.removeEventListener("pointerdown", start);
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerup", release);
      area.removeEventListener("pointercancel", cancel);
      area.removeEventListener("click", captureClick, true);
      pager.removeEventListener("transitionend", finishTransition);
    };
  }, []);

  return (
    <div id={id} ref={surface} className="swipe-pager">
      {tabs.map((tab, index) => (
        <div className="swipe-pane" key={tab} data-tab={tab} data-pane={index === activeIndex ? "current" :
          index === activeIndex + 1 ? "next" : index === activeIndex - 1 ? "previous" : "parked"}
          inert={index !== activeIndex}>
          {renderPane(tab)}
        </div>
      ))}
    </div>
  );
}
