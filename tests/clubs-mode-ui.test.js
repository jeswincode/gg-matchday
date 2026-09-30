import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Clubs mode uses the locked rose-gold identity and formation set", () => {
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");
  const styles = fs.readFileSync("src/features/clubs/clubs-mode.css", "utf8");

  assert.match(component, /Ultimate Clubs/);
  for (const formation of ["1-2-1", "2-1-1", "1-3", "3-1", "2-2"]) {
    assert.match(component, new RegExp(formation));
  }
  assert.match(styles, /#d9a0a2/i);
  assert.match(styles, /#0c0c0e/i);
});