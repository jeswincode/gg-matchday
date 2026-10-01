import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Clubs mode uses the viewer formation set and theme-aware premium dashboard", () => {
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");
  const styles = fs.readFileSync("src/features/clubs/clubs-mode.css", "utf8");

  assert.match(component, /Ultimate Clubs/);
  assert.match(component, /Player History/);
  assert.match(component, /Ultimate Clubs sections/);
  assert.match(component, /My Club sections/);
  assert.doesNotMatch(component, /<button[^>]*>Auctions<\\/button>/);
  assert.doesNotMatch(component, /<button[^>]*>Matches<\\/button>/);
  for (const formation of ["1-2-1", "2-1-1", "1-3", "3-1", "2-2"]) {
    assert.match(component, new RegExp(formation));
  }
  assert.match(styles, /clubs-command-grid/);
  assert.match(styles, /clubs-pitch/);
  assert.match(styles, /clubs-field-card/);
  assert.match(styles, /data-theme="golden"/);
});