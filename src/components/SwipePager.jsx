import { useEffect, useEffectEvent, useRef } from "react";
import { flushSync } from "react-dom";
import { scrollToPagerStart } from "../lib/pagerScroll";
import "./swipe-pager.css";

function allowsSwipe(target, root) {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false]), [role=dialog], [role=slider], [data-no-tab-swipe]")) return false;
  for (let element = target; element && element !== root; element = element.parentElement) {
    if (element.scrollWidth > element.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(element).overflowX)) return false;
  }
  return true;
}

export default function SwipePager({ tabs, active, onNavigate, onMotionChange, renderPane, id }) {
  const surface = useRef(null);
  const readTabs = useEffectEvent(() => tabs);
  const navigate = useEffectEvent(tab => onNavigate(tab));
  const reportMotion = useEffectEvent(moving => onMotionChange?.(moving));
  const activeIndex = tabs.indexOf(active);

  useEffect(() => {
    const pager = surface.current;
    const area = pager.closest("[data-page-swipes]") || pager;
    const currentTab = () => pager.querySelector('[data-pane="current"]')?.dataset.tab;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let gesture;
    let frame = 0;
    let completeSettle;
    let settleTimer = 0;
    let suppressClickUntil = 0;

    function clearMotion() {
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
      completeSettle = undefined;
      delete pager.dataset.swiping;
      delete pager.dataset.settling;
      pager.style.removeProperty("--pager-x");
      pager.style.removeProperty("--pager-top");
      reportMotion(false);
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
      const order = readTabs();
      const tab = currentTab();
      const index = order.findIndex(key => String(key) === tab);
      if (order.length < 2 || index < 0 || !allowsSwipe(event.target, area)) return;
      gesture = {
        pointer: event.pointerId, x: event.clientX, y: event.clientY,
        startedAt: event.timeStamp, sampleX: event.clientX, sampleTime: event.timeStamp,
        speed: 0, lastMove: event.timeStamp, order, index, tab, locked: false,
      };
    }

    function move(event) {
      const current = gesture;
      if (current?.pointer !== event.pointerId) return;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.locked) {
        if (Math.abs(dy) >= 12 && Math.abs(dy) > Math.abs(dx)) { gesture = undefined; return; }
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
        current.locked = true;
        reportMotion(true);
        current.width = pager.clientWidth;
        area.setPointerCapture(event.pointerId);
        pager.style.setProperty("--pager-top", Math.max(0, -pager.getBoundingClientRect().top) + "px");
      }
      const interval = event.timeStamp - current.sampleTime;
      if (interval >= 12) {
        current.speed = (event.clientX - current.sampleX) / interval;
        current.sampleTime = event.timeStamp;
        current.sampleX = event.clientX;
      }
      current.lastMove = event.timeStamp;
      const direction = dx <= 0 ? 1 : -1;
      const hasNeighbor = current.order[current.index + direction] !== undefined;
      const offset = Math.max(-current.width, Math.min(current.width, dx)) * (hasNeighbor ? 1 : .17);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        pager.dataset.swiping = direction > 0 ? "next" : "previous";
        pager.style.setProperty("--pager-x", offset + "px");
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
      const speed = current.sampleTime === current.startedAt
        ? distance / Math.max(1, event.timeStamp - current.startedAt)
        : event.timeStamp - current.lastMove <= 85 ? -current.speed * direction : 0;
      const flick = distance >= 22 && speed >= .28;
      const deliberate = distance >= Math.max(34, Math.min(58, current.width * .12));
      const next = (deliberate || flick) ? current.order[current.index + direction] : undefined;
      completeSettle = () => {
        clearMotion();
        if (next === undefined || currentTab() !== current.tab) return;
        flushSync(() => navigate(next));
        scrollToPagerStart(pager);
      };
      if (reducedMotion.matches || !pager.dataset.swiping) {
        completeSettle();
        return;
      }
      pager.dataset.swiping = direction > 0 ? "next" : "previous";
      pager.dataset.settling = "";
      pager.style.setProperty("--pager-x", (next === undefined ? 0 : -direction * current.width) + "px");
      settleTimer = window.setTimeout(completeSettle, 155);
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
