import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Welcome screen uses the cinematic GG Matchday video and emblem", () => {
  const component = fs.readFileSync("src/components/StartupExperience.jsx", "utf8");
  const styles = fs.readFileSync("src/refined-v2.css", "utf8");

  assert.match(component, /src="\/ggmatchdaybg\.mp4"/);
  assert.match(component, /autoPlay/);
  assert.match(component, /muted/);
  assert.match(component, /playsInline/);
  assert.match(component, /GGWelcomeEmblem/);
  assert.match(styles, /\.gg-welcome-video\s*\{/);
  assert.match(styles, /\.gg-welcome-video-overlay\s*\{/);
  assert.match(styles, /\.gg-welcome-shell\s*\{/);
  assert.match(styles, /\.gg-welcome-emblem\s*\{/);
});

test("Welcome screen has a dedicated gold-theme treatment", () => {
  const styles = fs.readFileSync("src/gold-theme-refined.css", "utf8");

  assert.match(styles, /html\[data-theme="golden"\] \.gg-welcome-screen/);
  assert.match(styles, /html\[data-theme="golden"\] \.gg-welcome-emblem \.gg-emblem-ring/);
  assert.match(styles, /html\[data-theme="golden"\] \.gg-welcome-shell \.gg-welcome-avatar/);
  assert.match(styles, /html\[data-theme="golden"\] \.gg-welcome-shell \.gg-enter-button/);
});
