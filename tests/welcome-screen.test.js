import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Welcome screen displays the supplied poster with a real Enter Matchday button", () => {
  const component = fs.readFileSync("src/components/StartupExperience.jsx", "utf8");
  const styles = fs.readFileSync("src/welcome-reference.css", "utf8");
  const app = fs.readFileSync("src/App.jsx", "utf8");

  assert.match(component, /src="\/enter-matchday\.png"/);
  assert.match(component, /className=\{\x60gg-welcome-poster-frame\$\{posterLoaded \? " is-loaded" : ""\}\$\{!posterLoaded && !posterFailed \? " is-loading" : ""\}/);
  assert.match(component, /fetchPriority="high"/);
  assert.match(component, /loading="eager"/);
  assert.match(styles, /\.gg-welcome-poster-frame\.is-loading \.gg-welcome-image-button/);
  assert.match(component, /gg-welcome-screen gg-welcome-image-screen/);
  assert.match(component, /className=\{\x60gg-welcome-image-button/);
  assert.match(component, /onClick=\{onEnter\}/);
  assert.match(component, /aria-label="Enter Matchday"/);
  assert.match(component, /onError=\{\(\) =>/);
  assert.doesNotMatch(component, /ggmatchdaybg\.mp4/);
  assert.doesNotMatch(component, /GGWelcomeEmblem/);
  assert.match(app, /<WelcomeScreen onEnter=\{\(\) => setExperience\("app"\)\} \/>/);
  assert.match(styles, /\.gg-welcome-poster-frame/);
  assert.match(styles, /aspect-ratio: 1648 \/ 928/);
  assert.match(styles, /\.gg-welcome-image-button\.is-image-overlay/);
  assert.match(styles, /:focus-visible/);
});

test("Welcome poster stays clean in both themes and respects reduced motion", () => {
  const styles = fs.readFileSync("src/welcome-reference.css", "utf8");

  assert.match(styles, /html\[data-theme="golden"\] \.gg-welcome-screen\.gg-welcome-image-screen/);
  assert.match(styles, /\.gg-welcome-screen\.gg-welcome-image-screen::before/);
  assert.match(styles, /@media \(max-aspect-ratio: 3 \/ 4\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.ok(component.includes('className="gg-welcome-mobile-button"'));
  assert.ok(component.includes("SAME PLAYERS. NEW STORIES."));
  assert.ok(component.includes("posterLoaded || posterFailed ? \" is-ready\" : \"\""));
  assert.ok(styles.includes("aspect-ratio: 1648 / 719"));
  assert.ok(styles.includes("width: min(175vw, 700px)"));
  assert.ok(styles.includes("top: calc(min(76.35vw, 305.5px) + 12px)"));
  assert.ok(styles.includes(".gg-welcome-image-screen.is-ready .gg-welcome-mobile-button"));
  assert.ok(styles.includes(".gg-welcome-image-button {\n    display: none;"));
});
