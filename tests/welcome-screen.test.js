import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Welcome screen selects the correct poster, fills the viewport without stretching, and exposes full-screen entry", () => {
  const component = fs.readFileSync("src/components/StartupExperience.jsx", "utf8");
  const styles = fs.readFileSync("src/welcome-reference.css", "utf8");
  const app = fs.readFileSync("src/App.jsx", "utf8");

  assert.ok(component.includes('src="/enter-matchday.png"'));
  assert.ok(component.includes('srcSet="/enter-matchday-mobile.png"'));
  assert.ok(component.includes('media="(max-aspect-ratio: 3 / 4)"'));
  assert.ok(component.includes('className="gg-welcome-image-button"'));
  assert.ok(component.includes("onClick={onEnter}"));
  assert.ok(component.includes('aria-label="Enter Matchday"'));
  assert.ok(component.includes('window.addEventListener("keydown", handleGlobalEnter)'));
  assert.ok(component.includes('event.key !== "Enter"'));
  assert.ok(component.includes("Click anywhere on the poster or press Enter"));
  assert.ok(component.includes('fetchPriority="high"'));
  assert.ok(component.includes('loading="eager"'));
  assert.ok(component.includes("onError={() =>"));
  assert.ok(app.includes('<WelcomeScreen onEnter={() => setExperience("app")} />'));

  assert.ok(styles.includes("position: absolute;\n  inset: 0;"));
  assert.ok(styles.includes("width: 100%;\n  height: 100%;"));
  assert.ok(styles.includes("object-fit: cover"));
  assert.ok(styles.includes(".gg-welcome-button-visual"));
  assert.ok(styles.includes("left: 33.25%"));
  assert.ok(styles.includes("top: 77.45%"));
  assert.ok(styles.includes("left: 16%"));
  assert.ok(styles.includes("top: 78.9%"));
  assert.ok(styles.includes("height: 6.3%"));
  assert.ok(styles.includes(".gg-welcome-image-button:focus-visible"));
});

test("Welcome screen keeps the dedicated portrait asset and respects reduced motion", () => {
  const component = fs.readFileSync("src/components/StartupExperience.jsx", "utf8");
  const styles = fs.readFileSync("src/welcome-reference.css", "utf8");

  assert.ok(component.includes('<picture className="gg-welcome-poster-picture">'));
  assert.ok(component.includes('srcSet="/enter-matchday-mobile.png"'));
  assert.ok(styles.includes("@media (max-aspect-ratio: 3 / 4)"));
  assert.ok(styles.includes("@media (prefers-reduced-motion: reduce)"));
  assert.ok(styles.includes(".gg-welcome-poster-picture"));
});
