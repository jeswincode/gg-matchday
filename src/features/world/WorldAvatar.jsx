import { useEffect, useRef, useState } from "react";
import { routeDuration, routePosition } from "../../../shared/communityWorld";
import { celebrationCues, celebrationFrame, celebrationTiming } from "../companion/companionCelebration";
import CompanionPlayer from "../companion/CompanionPlayer";
import { useActionFinished } from "./useActionFinished";

const emotes = { wave: 1500, kick: 650 };

export default function WorldAvatar({ player, self, receivedWave, selected, onSelect }) {
  const marker = useRef(null);
  const [frame, setFrame] = useState(null);
  const celebration = player.action === "celebrate" ? player.look.celebration : null;
  const timing = celebration ? celebrationTiming(celebration) : null;
  const lifetime = routeDuration(player.route) || timing?.finishAt || emotes[player.action] || 0;
  const finished = useActionFinished(player.startAt, lifetime);
  const look = !finished && timing
    ? frame?.revision === player.revision ? frame : celebrationFrame(timing, 0) : {};
  const action = finished ? undefined : {
    move: "walk", wave: "wave", kick: "kick", celebrate: look.action,
  }[player.action];

  useEffect(() => {
    if (!celebration) return;
    const timing = celebrationTiming(celebration);
    const elapsed = performance.now() - player.startAt;
    if (elapsed >= timing.finishAt) return;
    const cues = celebrationCues(timing);
    const next = [Math.max(0, ...cues.filter(at => at <= elapsed)), ...cues.filter(at => at > elapsed)];
    const timers = next.map(at => window.setTimeout(() => {
      setFrame({ ...celebrationFrame(timing, at), revision: player.revision });
    }, Math.max(0, at - elapsed)));
    return () => timers.forEach(window.clearTimeout);
  }, [celebration, player.revision, player.startAt]);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const rig = marker.current?.querySelector(".gg-footballer");
    let frame;
    const duration = routeDuration(player.route);
    function place(now) {
      const elapsed = now - player.startAt;
      const { x, y } = routePosition(player.route, reduced.matches ? duration : elapsed);
      marker.current?.style.setProperty("--world-x", x + "%");
      marker.current?.style.setProperty("--world-y", y + "%");
      marker.current?.style.setProperty("--world-depth", Math.round(y * 10));
      if (duration && rig) {
        const next = routePosition(player.route, elapsed + 16);
        const dx = next.x - x;
        const dy = next.y - y;
        const facing = reduced.matches || elapsed >= duration ? "front" : Math.abs(dx) > Math.abs(dy)
          ? dx > 0 ? "right" : "left" : dy < 0 ? "back" : "front";
        if (rig.dataset.facing !== facing) rig.dataset.facing = facing;
      }
      if (!reduced.matches && elapsed < duration) frame = requestAnimationFrame(place);
    }
    place(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [player]);

  const selection = self ? {} : { onClick: onSelect, "aria-pressed": selected };
  const Element = self ? "div" : "button";
  const offset = player.slot === 0 ? 0 : Math.ceil((player.slot % 12) / 2) * (player.slot % 2 ? 1 : -1);
  return <Element ref={marker} style={{ "--player-lane": offset, "--player-row": Math.floor(player.slot / 12) + (player.slot % 2) * .7 }} className="gg-world-avatar" data-self={self || undefined}
    data-pose={player.action === "sit" ? "sit" : undefined}
    data-selected={selected || undefined} {...selection} {...(self ? {} : { type: "button" })}>
    <span className="gg-world-name">{player.name}{self && <small> · You</small>}</span>
    {!finished && player.action === "wave" && <span className="gg-world-speech" role={receivedWave ? "status" : undefined}>{receivedWave ? "Waving to you!" : "Hello!"}</span>}
    {action === "impact" && <span className="gg-world-speech">SIUUU</span>}
    <CompanionPlayer key={player.revision} look={player.look} action={action} temporaryKit={look.kit} facing={look.facing} />
    {!finished && player.action === "kick" && <span className="gg-world-ball" aria-hidden="true">⚽</span>}
  </Element>;
}
