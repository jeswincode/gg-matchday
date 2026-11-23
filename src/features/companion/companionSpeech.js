import { clamp } from "./companionWorld";

export function createCompanionSpeech(bubble, motion, schedule) {
  const lineSize = document.createElement("span");
  lineSize.className = "gg-companion-speech-size";
  lineSize.setAttribute("aria-hidden", "true");
  const visibleLine = document.createElement("span");
  visibleLine.setAttribute("aria-hidden", "true");
  const announcement = document.createElement("span");
  announcement.className = "gg-companion-speech-live";
  bubble.replaceChildren(lineSize, visibleLine, announcement);

  let speech;
  let expiry;
  let width = 0;
  let height = 0;
  const resize = new ResizeObserver(() => {
    width = bubble.offsetWidth;
    height = bubble.offsetHeight;
    if (speech) schedule();
  });
  resize.observe(bubble);

  function hide() {
    clearTimeout(expiry);
    speech = undefined;
    bubble.hidden = true;
    announcement.textContent = "";
  }

  function say(text, { duration, priority = 0 } = {}) {
    const line = text.trim().slice(0, 160);
    if (!line || (speech && priority < speech.priority)) return;
    hide();
    const characters = Array.from(line);
    const revealTime = motion.matches ? 0 : Math.min(780, characters.length * 22);
    speech = { characters, revealTime, priority, start: performance.now(), shown: 0 };
    lineSize.textContent = line;
    visibleLine.textContent = revealTime ? "" : line;
    bubble.hidden = false;
    announcement.textContent = line;
    width = bubble.offsetWidth;
    height = bubble.offsetHeight;
    expiry = setTimeout(hide, duration ?? clamp(2050 + characters.length * 47, 2900, 6700));
    schedule();
  }

  function draw(actor, room, bodySize, now) {
    if (!speech) return false;
    const { characters, revealTime, start } = speech;
    const progress = revealTime ? clamp((now - start) / revealTime, 0, 1) : 1;
    const shown = Math.floor(characters.length * progress);
    if (shown !== speech.shown) {
      visibleLine.textContent = characters.slice(0, shown).join("");
      speech.shown = shown;
    }

    if (width && height) {
      const head = actor.y - bodySize * (actor.pose === "sit" ? .86 : .97);
      const left = clamp(actor.x - width / 2, room.left + 8, room.right - width - 8);
      const above = head - height - 9;
      const below = above < room.top + 6;
      const top = below ? clamp(actor.y + 8, room.top + 6, room.bottom - height - 6) : above;
      bubble.style.setProperty("--speech-left", left + "px");
      bubble.style.setProperty("--speech-top", top + "px");
      bubble.style.setProperty("--speech-tail", clamp(actor.x - left, 9, width - 9) + "px");
      bubble.toggleAttribute("data-below", below);
    }
    return progress < 1;
  }

  return { say, hide, draw, release: () => { hide(); resize.disconnect(); } };
}
