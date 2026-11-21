import { useRef } from "react";
import "./dock-drag.css";

export default function useDockDrag() {
  const drag = useRef(null);
  const suppressClick = useRef(false);

  function finish(event, commit) {
    const state = drag.current;
    if (state?.pointer !== event.pointerId) return;
    drag.current = null;
    if (!state.moving) return;
    const dock = event.currentTarget;
    delete dock.dataset.dragging;
    delete state.target.dataset.dragTarget;
    if (commit && event.clientY >= state.bounds.top - 24 &&
        event.clientY <= state.bounds.bottom + 24 &&
        event.clientX >= state.bounds.left && event.clientX <= state.bounds.right) {
      state.target.click();
    }
  }

  return {
    "data-drag-dock": "",
    "data-no-tab-swipe": "",
    onPointerDown(event) {
      if (drag.current) return;
      suppressClick.current = false;
      if (event.pointerType !== "touch" || !event.isPrimary ||
          !matchMedia("(max-width: 760px)").matches) return;
      const button = event.target.closest("button");
      if (!button || button.parentElement !== event.currentTarget || button.disabled) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const tabs = Array.from(event.currentTarget.children)
        .filter(child => child.matches("button:not(:disabled)"))
        .map(element => ({ element, box: element.getBoundingClientRect() }));
      drag.current = { pointer: event.pointerId, start: event.clientX, bounds, tabs };
    },
    onPointerMove(event) {
      const state = drag.current;
      if (state?.pointer !== event.pointerId) return;
      const dock = event.currentTarget;
      if (!state.moving) {
        if (Math.abs(event.clientX - state.start) < 7) return;
        dock.setPointerCapture(event.pointerId);
        state.moving = true;
        suppressClick.current = true;
        dock.dataset.dragging = "";
      }
      const { tabs, bounds } = state;
      const tab = tabs.find(({ box }, index) =>
        index === tabs.length - 1 || event.clientX < (box.right + tabs[index + 1].box.left) / 2);
      if (state.target !== tab.element) {
        if (state.target) delete state.target.dataset.dragTarget;
        state.target = tab.element;
        tab.element.dataset.dragTarget = "";
      }
      const left = Math.max(tabs[0].box.left, Math.min(tabs.at(-1).box.right - tab.box.width, event.clientX - tab.box.width / 2));
      dock.style.setProperty("--dock-x", (left - bounds.left - dock.clientLeft) + "px");
      dock.style.setProperty("--dock-y", (tab.box.top - bounds.top - dock.clientTop) + "px");
      dock.style.setProperty("--dock-w", tab.box.width + "px");
      dock.style.setProperty("--dock-h", tab.box.height + "px");
    },
    onPointerUp: event => finish(event, true),
    onPointerCancel: event => finish(event, false),
    onLostPointerCapture(event) {
      if (event.target === event.currentTarget) finish(event, false);
    },
    onClickCapture(event) {
      if (event.detail && suppressClick.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }
    },
  };
}
