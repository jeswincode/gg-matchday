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
  assert.match(component, /clubs-subnav/);
  const topLevelNav = component.slice(component.indexOf('<nav className="clubs-nav"'), component.indexOf("</nav>") + 6);
  assert.ok(!topLevelNav.includes(">Auctions</button>"));
  assert.ok(!topLevelNav.includes(">Matches</button>"));
  for (const formation of ["1-2-1", "2-1-1", "1-3", "3-1", "2-2"]) {
    assert.match(component, new RegExp(formation));
  }
  assert.match(styles, /clubs-command-grid/);
  assert.match(styles, /clubs-pitch/);
  assert.match(styles, /clubs-field-card/);
  assert.match(styles, /data-theme="golden"/);
  assert.match(styles, /\.clubs-subnav\s*\{/);
  assert.match(styles, /\.clubs-subnav button\.active/);
});