import { useEffect, useMemo, useState } from "react";
import { auth } from "../firebase";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const PREFERRED_POSITIONS = [
  "GK",
  "CB",
  "LB",
  "RB",
  "LWB",
  "RWB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST",
  "CF",
];

async function authenticatedFetch(url, options = {}) {
  if (!auth?.currentUser) {
    throw new Error("Authentication required.");
  }

  const token = await auth.currentUser.getIdToken();

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export default function AdminPreferredPositions() {
  const [editing, setEditing] = useState(false);
  const [player, setPlayer] = useState(null);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedKey = useMemo(
    () => selected.join("|"),
    [selected]
  );

  useEffect(() => {
    let cancelled = false;

    const findPlayer = async () => {
      const form = document.querySelector(".player-profile form");
      const heading = document.querySelector(".player-profile .profile-heading h2");
      const playerName = heading?.textContent?.trim();
      const isEditing = Boolean(form && playerName);

      if (!isEditing) {
        if (!cancelled) {
          setEditing(false);
          setPlayer(null);
          setMessage("");
        }
        return;
      }

      try {
        const response = await fetch(`${API_URL}/players`);
        if (!response.ok) return;

        const players = await response.json();
        const match = players.find(
          (item) => item.name?.trim() === playerName
        );

        if (!cancelled) {
          setEditing(true);
          setPlayer(match || null);
          setSelected(
            Array.isArray(match?.preferredPositions)
              ? [...match.preferredPositions]
              : []
          );
        }
      } catch {
        if (!cancelled) setPlayer(null);
      }
    };

    findPlayer();

    const observer = new MutationObserver(() => {
      const form = document.querySelector(".player-profile form");
      const heading = document.querySelector(".player-profile .profile-heading h2");
      const currentName = heading?.textContent?.trim() || "";
      const currentEditing = Boolean(form && currentName);

      setEditing((previous) => {
        if (previous !== currentEditing) return currentEditing;
        return previous;
      });

      if (!currentEditing) {
        setPlayer(null);
        setMessage("");
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [editing, selectedKey]);

  if (!editing || !player) return null;

  async function save() {
    try {
      setSaving(true);
      setMessage("");

      const response = await authenticatedFetch(
        `${API_URL}/players/${player._id}/preferred-positions`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            preferredPositions: selected,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Could not update preferred positions."
        );
      }

      setPlayer(data);
      setSelected(
        Array.isArray(data.preferredPositions)
          ? [...data.preferredPositions]
          : []
      );
      setMessage("Preferred positions updated.");
    } catch (error) {
      setMessage(error.message || "Could not update preferred positions.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: "1rem" }}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">SQUAD BUILDER</p>
          <h3>Preferred Positions</h3>
          <p>
            Select every position this player is approved to play. These positions
            control Squad Builder eligibility.
          </p>
        </div>
      </div>

      <fieldset className="gg-associations">
        <legend>Approved positions</legend>
        {PREFERRED_POSITIONS.map((position) => (
          <label key={position}>
            <input
              type="checkbox"
              checked={selected.includes(position)}
              onChange={(event) => {
                setSelected((current) =>
                  event.target.checked
                    ? [...new Set([...current, position])]
                    : current.filter((item) => item !== position)
                );
                setMessage("");
              }}
            />
            {position}
          </label>
        ))}
      </fieldset>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "1rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="save-button"
          disabled={saving}
          onClick={save}
        >
          {saving ? "Saving..." : "Save Preferred Positions"}
        </button>
        {message && <span className="muted">{message}</span>}
      </div>
    </section>
  );
}
