import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("the intro uses only the optional video and removes the retired public posters", () => {
  const component = fs.readFileSync("src/components/StartupExperience.jsx", "utf8");
  const styles = fs.readFileSync("src/welcome-reference.css", "utf8");
  assert.match(component, /if \(!introVideo \|\| videoFailed \|\| reduceMotion\) return null/);
  assert.match(component, /onError=\{\(\) => setVideoFailed\(true\)\}/);
  assert.match(styles, /\.gg-matchday-intro--mobile \.gg-intro-video\s*\{\s*opacity: \.25/);
  assert.deepEqual(fs.readdirSync("public").filter(file => file.startsWith("enter-matchday")), []);
});
