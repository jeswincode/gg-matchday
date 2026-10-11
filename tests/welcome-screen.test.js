import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Welcome screen selects desktop or portrait poster and keeps a real entry action", () => {
  const component = fs.readFileSync("src/components/StartupExperience.jsx", "utf8");
  const styles = fs.readFileSync("src/welcome-reference.css", "utf8");
  const app = fs.readFileSync("src/App.jsx", "utf8");

  assert.ok(component.includes('src="/enter-matchday.png"'));
  assert.ok(component.includes('srcSet="/enter-matchday-mobile.png"'));
  assert.ok(component.includes('media="(max-aspect-ratio: 3 / 4)"'));
  assert.ok(component.includes('className={`gg-welcome-image-button'));
  assert.ok(component.includes("onClick={onEnter}"));
  assert.ok(component.includes('aria-label="Enter Matchday"'));
  assert.ok(component.includes("fetchPriority=\"high\""));
  assert.ok(component.includes("loading=\"eager\""));
  assert.ok(component.includes("onError={() =>"));
  assert.ok(app.includes('<WelcomeScreen onEnter={() => setExperience("app")} />'));
  assert.ok(styles.includes("aspect-ratio: 1648 / 928"));
  assert.ok(styles.includes("aspect-ratio: 9 / 16"));
  assert.ok(styles.includes("width: min(100vw, 56.25dvh)"));
  assert.ok(styles.includes("top: 78.9%"));
  assert.ok(styles.includes("width: 68%"));
  assert.ok(styles.includes(".gg-welcome-image-button:focus-visible"));
});

test("Welcome screen keeps the portrait image clean and respects reduced motion", () => {
  const component = fs.readFileSync("src/components/StartupExperience.jsx", "utf8");
  const styles = fs.readFileSync("src/welcome-reference.css", "utf8");

  assert.ok(component.includes('<picture className="gg-welcome-poster-picture">'));
  assert.ok(!component.includes('className="gg-welcome-mobile-button"'));
  assert.ok(!component.includes("SAME PLAYERS. NEW STORIES.</p>"));
  assert.ok(styles.includes("@media (max-aspect-ratio: 3 / 4)"));
  assert.ok(styles.includes("@media (prefers-reduced-motion: reduce)"));
  assert.ok(styles.includes(".gg-welcome-poster-picture"));
});
