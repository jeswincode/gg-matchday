import { useEffect, useId, useState } from "react";
import { companionLook, companionOptions, iconicCelebration } from "../../../shared/companion";
import { api } from "../../lib/api";
import { celebrationCues, celebrationFrame, celebrationTiming } from "./companionCelebration";
import CompanionPlayer from "./CompanionPlayer";

const labels = {
  character: ["Character", "Original", "Captain", "Winger"],
  style: ["Player style", "Striker", "Playmaker"],
  kit: ["Matchday kit", "Theme kit", "Away kit", "Training kit"],
  complexion: ["Complexion", "Sand", "Copper", "Umber"],
};
const angles = ["front", "left", "right", "back"];
const celebrations = { ronaldo: "Ronaldo · SIUUU", messi: "Messi · Point to the sky" };

import { useWorkspaceBrand } from "../communities/WorkspaceBrand.jsx";

export default function CompanionSettings({ look, name, role, clasicoSide, onSave }) {
  const { companion } = useWorkspaceBrand();
  const id = useId();
  const [draft, setDraft] = useState(() => companionLook(look));
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(0);
  const [frame, setFrame] = useState({});
  const [angle, setAngle] = useState("front");
  const celebration = iconicCelebration(role, clasicoSide, draft);

  useEffect(() => {
    if (!preview || !celebration) return;
    const timing = celebrationTiming(celebration);
    const timers = celebrationCues(timing).slice(1).map(at => setTimeout(() => {
      setFrame(celebrationFrame(timing, at));
    }, at));
    return () => timers.forEach(clearTimeout);
  }, [celebration, preview]);

  function update(field, value) {
    setDraft(current => ({ ...current, [field]: value }));
    setPreview(0);
    setFrame({});
    setStatus("");
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      // A previous API version still requires the saved celebration field.
      const { look: saved } = await api("/world/appearance", { method: "PUT", body: draft });
      if ((saved.character || "original") !== draft.character) {
        setError("Couldn’t save your selected character. Try again.");
        return;
      }
      onSave(saved);
      setStatus("Companion saved.");
    } catch {
      setError("Couldn’t save your companion. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="gg-account-setting gg-companion-settings">
    <h3>{companion}</h3>
    <form onSubmit={save}>
      <div className="gg-companion-locker">
        <div className="gg-locker-portrait">
          <div role="img" aria-label={`${name || "Your"} Companion kit preview, ${frame.facing || angle} view`}>
            <CompanionPlayer key={preview} look={draft} temporaryKit={frame.kit}
              action={frame.action} facing={frame.facing || angle} />
          </div>
          <div className="gg-locker-views" role="group" aria-label="Kit preview angle">
            {angles.map(side => <button key={side} type="button" aria-pressed={angle === side}
              onClick={() => { setPreview(0); setFrame({}); setAngle(side); }}>
              {side[0].toUpperCase() + side.slice(1)}
            </button>)}
          </div>
        </div>
        <div className="gg-locker-controls">
          {Object.entries(labels).map(([field, names]) => <div key={field}>
            <label htmlFor={id + field}>{names[0]}</label>
            <select id={id + field} value={draft[field]} disabled={saving}
              onChange={event => update(field, event.target.value)}>
              {companionOptions[field].map((value, index) => <option key={value} value={value}>{names[index + 1]}</option>)}
            </select>
          </div>)}
          {role === "admin" ? <fieldset className="gg-celebration-switch" disabled={saving}>
            <legend>Iconic Celebration</legend>
            <div>{companionOptions.celebration.map(value => <label key={value}>
              <input type="radio" name={id + "celebration"} value={value} checked={draft.celebration === value}
                onChange={() => update("celebration", value)} />
              {celebrations[value]}
            </label>)}</div>
          </fieldset> : <p className="muted">{celebration
            ? celebrations[celebration] + " · Your El Clásico side"
            : "Choose an El Clásico side on your linked player profile to unlock an Iconic Celebration."}</p>}
        </div>
      </div>
      <div className="gg-account-setting-actions">
        {celebration && <button type="button" className="secondary-button" onClick={() => {
          setFrame(celebrationFrame(celebrationTiming(celebration), 0));
          setPreview(value => value + 1);
        }}>Preview celebration</button>}
        <button type="submit" className="secondary-button" disabled={saving}>{saving ? "Saving…" : "Save companion"}</button>
      </div>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  </section>;
}
