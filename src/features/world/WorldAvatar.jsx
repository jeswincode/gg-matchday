import { useEffect, useRef } from "react";
import { routeDuration, routePosition } from "../../../shared/communityWorld";
import CompanionPlayer from "../companion/CompanionPlayer";
import { useActionFinished } from "./useActionFinished";

const emotes = { wave: 1500, celebrate: 2400, kick: 650 };

export default function WorldAvatar({ player, self, receivedWave, selected, onSelect }) {
  const marker = useRef(null);
  const lifetime = routeDuration(player.route) || emotes[player.action] || 0;
  const finished = useActionFinished(player.startAt, lifetime);
  const ronaldo = player.look.celebration === "ronaldo";
  const celebrating = !finished && player.action === "celebrate";
  const action = finished ? undefined : {
    move: "walk", wave: "wave", kick: "kick", celebrate: ronaldo ? "siuu" : "sky",
  }[player.action];

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame;
    const duration = routeDuration(player.route);
    function place(now) {
      const elapsed = now - player.startAt;
      const { x, y } = routePosition(player.route, reduced.matches ? duration : elapsed);
      marker.current?.style.setProperty("--world-x", x + "%");
      marker.current?.style.setProperty("--world-y", y + "%");
      marker.current?.style.setProperty("--world-depth", Math.round(y * 10));
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
    {celebrating && ronaldo && <span className="gg-world-speech">SIUUU</span>}
    <CompanionPlayer key={player.revision} look={player.look} action={action} kit={celebrating ? ronaldo ? "madrid" : "barcelona" : undefined} />
    {!finished && player.action === "kick" && <span className="gg-world-ball" aria-hidden="true">⚽</span>}
  </Element>;
}
