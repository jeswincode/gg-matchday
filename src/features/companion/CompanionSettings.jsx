import { useEffect, useId, useState } from "react";
import { companionLook, companionOptions } from "../../../shared/companion";
import { api } from "../../lib/api";
import { celebrationFrame, celebrationTiming } from "./companionCelebration";
import CompanionPlayer from "./CompanionPlayer";

const labels = {
  style: ["Player style", "Striker", "Playmaker"],
  kit: ["Matchday kit", "Theme kit", "Away kit", "Training kit"],
  complexion: ["Complexion", "Sand", "Copper", "Umber"],
  celebration: ["Celebration", "Ronaldo · SIUUU", "Messi · Point to the sky"],
};

export default function CompanionSettings({ look, name, onSave }) {
  const id = useId();
  const [draft, setDraft] = useState(() => companionLook(look));
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(0);
  const [frame, setFrame] = useState({});

  useEffect(() => {
    if (!preview) return;
    const timing = celebrationTiming(draft.celebration);
    const cues = [timing.moveAt / 2, timing.moveAt, timing.poseAt, timing.restoreAt,
      (timing.restoreAt + timing.finishAt) / 2, timing.finishAt];
    const timers = cues.map(at => setTimeout(() => {
      setFrame(celebrationFrame(timing, at));
    }, at));
    return () => timers.forEach(clearTimeout);
  }, [draft.celebration, preview]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const result = await api("/world/appearance", { method: "PUT", body: draft });
      onSave(result.look);
      setStatus("Companion saved.");
    } catch {
      setError("Couldn’t save your companion. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="gg-account-setting gg-companion-settings">
    <h3>GG Companion</h3>
    <form onSubmit={save}>
      <div className="gg-companion-locker">
        <div className="gg-locker-portrait" role="img" aria-label={(name || "Your") + " Companion kit preview"}>
          <CompanionPlayer key={preview} look={draft} temporaryKit={frame.kit} action={frame.action} />
        </div>
        <div className="gg-locker-controls">
          {Object.entries(companionOptions).map(([field, values]) => <div key={field}>
            <label htmlFor={id + field}>{labels[field][0]}</label>
            <select id={id + field} value={draft[field]} disabled={saving} onChange={event => {
              const value = event.target.value;
              setDraft(current => ({ ...current, [field]: value }));
              setPreview(0);
              setFrame({});
              setStatus("");
            }}>
              {values.map((value, index) => <option key={value} value={value}>{labels[field][index + 1]}</option>)}
            </select>
          </div>)}
        </div>
      </div>
      <div className="gg-account-setting-actions">
        <button type="button" className="secondary-button" onClick={() => {
          setFrame(celebrationFrame(celebrationTiming(draft.celebration), 0));
          setPreview(value => value + 1);
        }}>Preview celebration</button>
        <button type="submit" className="secondary-button" disabled={saving}>{saving ? "Saving…" : "Save companion"}</button>
      </div>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  </section>;
}
