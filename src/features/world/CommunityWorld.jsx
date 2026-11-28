import { useState } from "react";
import { facilities, routeDuration, stops } from "../../../shared/communityWorld";
import { useActionFinished } from "./useActionFinished";
import Modal from "../../components/Modal";
import useCommunityRoom from "./useCommunityRoom";
import WorldAvatar from "./WorldAvatar";
import WorldMap from "./WorldMap";
import "./community-world.css";

const formatStatus = {
  connecting: "Connecting to the pitch…",
  reconnecting: "Connection interrupted. Rejoining…",
  unauthorized: "Sign in again to join Community World.",
};

export default function CommunityWorld({ onClose }) {
  const room = useCommunityRoom();
  const [selection, setSelection] = useState("");
  const self = room.players.find(player => player.id === room.self);
  const selected = room.players.find(player => player.id === selection && player.id !== room.self);
  const live = room.status === "live";
  const destination = self?.route.at(-1);
  const location = stops[destination]?.label;
  const arrived = useActionFinished(self?.startAt, self ? routeDuration(self.route) : 0);
  const disabled = !live || room.busy || !arrived;

  function selectPoint(event) {
    if (event.target.closest("button") || disabled) return;
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - left) / width * 100;
    const y = (event.clientY - top) / height * 100;
    const nearest = Object.keys(stops).reduce((best, stop) =>
      Math.hypot(stops[stop].x - x, stops[stop].y - y) < Math.hypot(stops[best].x - x, stops[best].y - y)
        ? stop : best, "gate");
    if (nearest !== destination) void room.act("move", { destination: nearest });
  }

  return <Modal title="Community World" className="gg-world-dialog" onClose={onClose}>
    <div className="gg-world-shell">
      <header className="gg-campus-heading">
        <div><p className="gg-campus-label">GG FOOTBALL CAMPUS</p><h3>Matchday Grounds</h3></div>
        <span className="gg-world-live" data-online={live} role="status">
          {live ? `${room.players.length} on the grounds` : formatStatus[room.status]}
        </span>
      </header>
      <div className="gg-campus-map" role="group" aria-label="Football campus map" onClick={selectPoint} data-no-tab-swipe>
        <WorldMap />
        {facilities.map(key => <button type="button" key={key} className="gg-campus-stop"
          style={{ "--stop-x": stops[key].x + "%", "--stop-y": stops[key].y + "%" }}
          disabled={disabled} aria-current={destination === key ? "location" : undefined}
          onClick={() => { if (destination !== key) void room.act("move", { destination: key }); }}>
          {stops[key].label}
        </button>)}
        {room.players.map(player => <WorldAvatar key={player.id} player={player}
          self={player.id === room.self} receivedWave={player.target === room.self} selected={player.id === selected?.id}
          onSelect={() => setSelection(current => current === player.id ? "" : player.id)} />)}
      </div>
      <div className="gg-campus-controls">
        <div className="gg-world-instructions">
          <strong>{arrived ? location || "Main gate" : `Walking to ${location}`}</strong>
          <p>Tap the map to walk the paths. Select a player to wave to them.</p>
        </div>
        <div className="gg-world-buttons" role="group" aria-label="World actions">
          <button className="secondary-button" type="button" disabled={disabled}
            onClick={() => room.act("wave", { target: selected?.id })}>{selected ? `Wave to ${selected.name}` : "Wave"}</button>
          <button className="secondary-button" type="button" disabled={disabled}
            onClick={() => room.act("celebrate")}>Emote</button>
          <button className="secondary-button" type="button" disabled={disabled || !["training", "pitch"].includes(destination)}
            onClick={() => room.act("kick")}>Kick</button>
          <button className="secondary-button" type="button" disabled={disabled || destination !== "clubhouse"}
            onClick={() => room.act("sit")}>Sit</button>
        </div>
      </div>
      {live && room.players.length > 1 && <div className="gg-world-roster" role="group" aria-label="Players on the grounds">
        {room.players.filter(player => player.id !== room.self).map(player => <button key={player.id}
          type="button" className="secondary-button" aria-pressed={player.id === selected?.id}
          onClick={() => setSelection(current => current === player.id ? "" : player.id)}>{player.name}</button>)}
      </div>}
      {live && room.players.length === 1 && <p className="gg-world-note">You’re first on the grounds. Other signed-in players appear when they join.</p>}
      {room.status === "reconnecting" && <button className="secondary-button" type="button" onClick={room.reconnect}>Reconnect now</button>}
      {room.error && <p className="gg-world-note" role="alert">{room.error}</p>}
    </div>
  </Modal>;
}
