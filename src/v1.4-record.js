/*
 * GG Matchday v1.4 — Record page reorganization
 *
 * Keeps the existing React data/state logic intact while presenting one
 * compact row per player: player name, side selection, goals and assists.
 */

const RECORD_MARKER = "data-gg-v14-record";
const RECORD_SIGNATURE = "data-gg-v14-signature";

function normalize(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeButton(className, label, onClick, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function readCounterRow(row) {
  const name = normalize(row.querySelector("strong")?.textContent);
  const buttons = Array.from(row.querySelectorAll(".counter button"));
  const value = normalize(row.querySelector(".counter > strong")?.textContent);

  return {
    name,
    value: value || "0",
    minus: buttons[0] || null,
    plus: buttons[1] || null,
  };
}

function getSignature(record) {
  const assignmentSection = Array.from(record.querySelectorAll(".subsection")).find(
    (section) => normalize(section.textContent).includes("Assign Players")
  );

  if (!assignmentSection) return "";

  const assignment = Array.from(assignmentSection.querySelectorAll(".assignment-row"))
    .map((row) => {
      const name = normalize(row.querySelector(".assignment-player strong")?.textContent);
      const side = normalize(row.querySelector(".assignment-player small")?.textContent);
      const teamButtons = Array.from(row.querySelectorAll(".team-switch button"));
      const active = teamButtons.findIndex((button) => button.classList.contains("active"));
      return `${name}|${side}|${active}`;
    })
    .join("||");

  const statValues = Array.from(record.querySelectorAll(".stat-entry"))
    .map((row) => normalize(row.textContent))
    .join("||");

  return `${assignment}###${statValues}`;
}

function buildRecordStats(record) {
  const assignmentSection = Array.from(record.querySelectorAll(".subsection")).find(
    (section) => normalize(section.textContent).includes("Assign Players")
  );

  if (!assignmentSection) return;

  const assignmentRows = Array.from(assignmentSection.querySelectorAll(".assignment-row"));
  if (!assignmentRows.length) return;

  const originalSections = Array.from(record.querySelectorAll(".subsection"));
  const goalSections = originalSections.filter(
    (section) => normalize(section.querySelector(".eyebrow")?.textContent) === "GOALS"
  );
  const assistSection = originalSections.find(
    (section) => normalize(section.querySelector(".eyebrow")?.textContent) === "ASSISTS"
  );

  const goals = new Map();
  goalSections.forEach((section) => {
    section.querySelectorAll(".stat-entry").forEach((row) => {
      const item = readCounterRow(row);
      if (item.name) goals.set(item.name, item);
    });
  });

  const assists = new Map();
  assistSection?.querySelectorAll(".stat-entry").forEach((row) => {
    const item = readCounterRow(row);
    if (item.name) assists.set(item.name, item);
  });

  const combined = document.createElement("section");
  combined.className = "subsection v14-record-stats";
  combined.setAttribute(RECORD_MARKER, "true");

  combined.innerHTML = `
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">PLAYER STATS</p>
        <h3>Goals &amp; Assists</h3>
      </div>
      <span class="muted">Assign a side, then add stats</span>
    </div>
    <div class="v14-stat-head">
      <span>PLAYER</span>
      <span>SIDE</span>
      <span>GOALS</span>
      <span>ASSISTS</span>
    </div>
    <div class="v14-stat-list"></div>
  `;

  const list = combined.querySelector(".v14-stat-list");

  assignmentRows.forEach((assignmentRow) => {
    const name = normalize(assignmentRow.querySelector(".assignment-player strong")?.textContent);
    if (!name) return;

    const teamButtons = Array.from(assignmentRow.querySelectorAll(".team-switch button"));
    const activeSideIndex = teamButtons.findIndex((button) => button.classList.contains("active"));
    const goal = goals.get(name);
    const assist = assists.get(name);
    const sideText = normalize(assignmentRow.querySelector(".assignment-player small")?.textContent);
    const assigned = sideText !== "Not participating";

    const row = document.createElement("div");
    row.className = "v14-stat-row";

    const playerCell = document.createElement("div");
    playerCell.className = "v14-player-cell";
    const playerName = document.createElement("strong");
    playerName.textContent = name;
    const teamLabel = document.createElement("small");
    teamLabel.textContent = sideText;
    playerCell.append(playerName, teamLabel);

    const sideCell = document.createElement("div");
    sideCell.className = "v14-side-cell";
    ["1", "2"].forEach((label, index) => {
      const source = teamButtons[index];
      const sideButton = makeButton(
        "v14-side-button",
        label,
        () => {
          if (!source) return;
          source.click();
          Array.from(sideCell.children).forEach((button) => button.classList.remove("active"));
          sideButton.classList.add("active");
          teamLabel.textContent = index === 0 ? "Team A" : "Team B";
        },
        !source
      );

      if (assigned && activeSideIndex === index) {
        sideButton.classList.add("active");
      }

      sideCell.appendChild(sideButton);
    });

    function counterCell(item) {
      const cell = document.createElement("div");
      cell.className = "v14-counter-cell";
      const minus = makeButton(
        "v14-counter-button",
        "−",
        () => item?.minus?.click(),
        !item || !assigned
      );
      const value = document.createElement("strong");
      value.className = "v14-counter-value";
      value.textContent = item?.value || "0";
      const plus = makeButton(
        "v14-counter-button",
        "+",
        () => item?.plus?.click(),
        !item || !assigned
      );
      cell.append(minus, value, plus);
      return cell;
    }

    row.append(playerCell, sideCell, counterCell(goal), counterCell(assist));
    list.appendChild(row);
  });

  assignmentSection.parentNode.insertBefore(combined, assignmentSection);
  assignmentSection.style.display = "none";
  goalSections.forEach((section) => {
    section.style.display = "none";
  });
  if (assistSection) assistSection.style.display = "none";

  record.setAttribute(RECORD_MARKER, "true");
  record.setAttribute(RECORD_SIGNATURE, getSignature(record));
}

function scan() {
  document.querySelectorAll(".tab-content").forEach((section) => {
    const heading = normalize(section.querySelector(".page-title h2")?.textContent);
    if (heading !== "Record a Match" && heading !== "Edit Match") return;

    const assignmentSection = Array.from(section.querySelectorAll(".subsection")).find(
      (item) => normalize(item.textContent).includes("Assign Players")
    );
    if (!assignmentSection) return;

    const signature = getSignature(section);
    const existing = section.querySelector(`[${RECORD_MARKER}="true"]`);
    const previousSignature = section.getAttribute(RECORD_SIGNATURE) || "";

    if (existing && signature === previousSignature) return;

    if (existing) existing.remove();
    section.querySelectorAll(".subsection").forEach((item) => {
      item.style.display = "";
    });
    section.removeAttribute(RECORD_MARKER);
    section.removeAttribute(RECORD_SIGNATURE);

    buildRecordStats(section);
  });
}

let scheduled = false;
const observer = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scan();
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scan, { once: true });
} else {
  scan();
}
