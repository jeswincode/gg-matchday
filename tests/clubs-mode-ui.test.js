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
  for (const formation of ["1-2-1", "2-1-1", "1-3", "3-1", "2-2", "1-2-2", "2-2-1", "2-1-2", "1-3-1", "3-1-1"]) {
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

test("Clubs UI supports flexible 4-5 member formation and admin control center", () => {
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");
  const rules = fs.readFileSync("server/config/clubsRules.js", "utf8");
  const routes = fs.readFileSync("server/routes/clubs.js", "utf8");
  const applicationModel = fs.readFileSync("server/models/clubs/ClubFormationApplication.js", "utf8");
  const syncSource = fs.readFileSync("server/services/clubsMatchSync.js", "utf8");

  assert.match(rules, /CLUB_MIN_MEMBERS = 4/);
  assert.match(rules, /CLUB_MAX_MEMBERS = 5/);
  assert.match(rules, /CLUB_FORMATIONS_5/);
  assert.match(component, /Build a 4–5 player Club/);
  assert.match(component, /No fifth player/);
  assert.match(component, /activeSection === "adminDashboard"/);
  assert.match(component, /adminOnlyView/);
  assert.match(component, /\/clubs\/admin\/overview/);
  assert.match(component, /\/clubs\/admin\/clubs/);
  assert.match(component, /\/clubs\/admin\/matches/);
  assert.match(component, /Reason required to reject/);
  assert.match(applicationModel, /CLUB_MIN_MEMBERS/);
  assert.match(applicationModel, /CLUB_MAX_MEMBERS/);
  assert.match(routes, /const allMembersVoted/);
  assert.match(syncSource, /sideCounts\.A > 5/);
  assert.match(syncSource, /sideCounts\.B > 5/);
});

