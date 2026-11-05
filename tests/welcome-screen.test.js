import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Welcome screen is a coded Matchday entry experience with accessible keyboard entry", () => {
  const component = fs.readFileSync("src/components/StartupExperience.jsx", "utf8");
  const styles = fs.readFileSync("src/welcome-reference.css", "utf8");
  const app = fs.readFileSync("src/App.jsx", "utf8");

  assert.ok(component.includes('className="gg-welcome-screen gg-welcome-coded-screen"'));
  assert.ok(component.includes('className="gg-welcome-stadium-art"'));
  assert.ok(component.includes('className="gg-welcome-enter"'));
  assert.ok(component.includes('aria-label="Enter Matchday"'));
  assert.ok(component.includes("onClick={onEnter}"));
  assert.ok(component.includes('window.addEventListener("keydown", handleGlobalEnter)'));
  assert.ok(component.includes('event.key !== "Enter"'));
  assert.ok(component.includes("THE ARCHIVE"));
  assert.ok(component.includes("THE PLAYERS"));
  assert.ok(component.includes("THE CLUBS"));
  assert.ok(component.includes("YOUR V3 HISTORY STAYS WITH YOU"));
  assert.ok(!component.includes("enter-matchday.png"));
  assert.ok(!component.includes("gg-welcome-image-button"));
  assert.ok(app.includes('<WelcomeScreen onEnter={() => setExperience("app")} />'));

  assert.ok(styles.includes(".gg-welcome-coded-screen"));
  assert.ok(styles.includes(".gg-welcome-enter:focus-visible"));
  assert.ok(styles.includes("@media(max-width:800px)"));
  assert.ok(styles.includes("@media(max-width:480px)"));
  assert.ok(styles.includes("@media(prefers-reduced-motion:reduce)"));
});

test("Welcome screen provides a reduced-motion-friendly stadium entry and responsive layout", () => {
  const component = fs.readFileSync("src/components/StartupExperience.jsx", "utf8");
  const styles = fs.readFileSync("src/welcome-reference.css", "utf8");
  assert.ok(component.includes("gg-welcome-ball"));
  assert.ok(component.includes("gg-welcome-side-note"));
  assert.ok(component.includes("ENTER"));
  assert.ok(styles.includes("gg-welcome-ball-float"));
  assert.ok(styles.includes("prefers-reduced-motion"));
  assert.ok(styles.includes("min-height:100dvh"));
});
