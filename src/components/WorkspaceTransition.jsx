import { useWorkspaceBrand } from "../features/communities/WorkspaceBrand.jsx";
import { useEffect, useEffectEvent } from "react";

const timing = { covering: 180, covered: 130, revealing: 230 };

export default function WorkspaceTransition({ workspace, phase, onPhaseDone }) {
  const finish = useEffectEvent(() => onPhaseDone(phase));
  const duration = timing[phase];

  useEffect(() => {
    // The timer also runs if the browser skips an animation.
    const timer = window.setTimeout(finish, duration + (phase === "covered" ? 0 : 80));
    return () => window.clearTimeout(timer);
  }, [phase, duration]);

  return (
    <div className="gg-workspace-transition" data-workspace={workspace} data-phase={phase}
      style={{ "--shutter-duration": duration + "ms" }} aria-hidden="true">
      <div className="gg-workspace-shutter gg-workspace-shutter--top"
        onAnimationEnd={event => {
          if (event.target === event.currentTarget) onPhaseDone(phase);
        }} />
      <div className="gg-workspace-shutter gg-workspace-shutter--bottom" />
      <div className="gg-workspace-mark">
        <WorkspaceMonogram />
        <span className="gg-workspace-destination">{workspace === "clubs" ? "Clubs" : "Matchday"}</span>
      </div>
    </div>
  );
}

function WorkspaceMonogram() {
  return <span className="gg-workspace-monogram">{useWorkspaceBrand().monogram}</span>;
}
