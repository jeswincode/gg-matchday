import { useState } from "react";
import { api } from "../lib/api";

const positions = ["GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];

export default function AdminPreferredPositions({ player }) {
  const [selected, setSelected] = useState(() => player.preferredPositions || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const updated = await api(`/players/${encodeURIComponent(player._id)}/preferred-positions`, {
        method: "PATCH",
        body: { preferredPositions: selected },
      });
      setSelected(updated.preferredPositions || []);
      setMessage("Preferred positions updated.");
    } catch (error) {
      setMessage(error.message || "Could not update preferred positions.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card admin-preferred-positions" style={{ marginTop: "1rem" }}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">SQUAD BUILDER</p>
          <h3>Preferred Positions</h3>
          <p>These approved positions control Squad Builder eligibility.</p>
        </div>
      </div>
      <fieldset className="gg-associations" disabled={saving}>
        <legend>Approved positions</legend>
        {positions.map(position => (
          <label key={position}>
            <input
              type="checkbox"
              checked={selected.includes(position)}
              onChange={event => {
                const checked = event.target.checked;
                setSelected(current => checked ? [...current, position] : current.filter(item => item !== position));
                setMessage("");
              }}
            />
            {position}
          </label>
        ))}
      </fieldset>
      <button type="button" className="save-button" disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save Preferred Positions"}
      </button>
      {message && <p className="muted" role="status">{message}</p>}
    </section>
  );
}
