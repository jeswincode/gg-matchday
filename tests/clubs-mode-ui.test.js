import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Clubs mode uses the viewer formation set and theme-aware premium dashboard", () => {
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");
  const styles = fs.readFileSync("src/features/clubs/clubs-mode.css", "utf8");

  assert.match(component, /Ultimate Clubs/);
  assert.match(component, /Player History/);
  assert.match(component, /Ultimate Clubs sections/);
  assert.match(component, /Clubs is temporarily locked/);
  assert.match(component, /isAdmin&&<button className="secondary-button" type="button" onClick/);
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

test("Clubs mode is admin-only at the frontend entry point", () => {
  const app = fs.readFileSync("src/App.jsx", "utf8");
  assert.match(app, /if \(!isAdmin\) \{/);
  assert.match(app, /Clubs is temporarily locked/);
  assert.match(app, /isAdmin&&<button className="secondary-button" type="button" onClick=\{\(\)=>switchProductMode\("clubs"\)\}/);
});

test("Clubs operational API is admin-only", () => {
  const routes = fs.readFileSync("server/routes/clubs.js", "utf8");
  assert.match(routes, /router\.use\(requireAuth, requireAdmin\)/);
});
