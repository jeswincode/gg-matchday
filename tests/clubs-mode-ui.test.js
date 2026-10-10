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
  assert.match(component, /clubs-next-action/);
  assert.match(component, /clubs-formation-stepper/);
  assert.match(component, /clubs-scout-card/);
  assert.match(component, /clubs-review-received/);
  assert.match(component, /NEEDS ATTENTION/);
  assert.match(component, /clubs-history-summary-grid/);
  assert.match(component, /clubs-admin-club-card/);
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

test("Clubs mode is available from the main navigation to every viewer", () => {
  const app = fs.readFileSync("src/App.jsx", "utf8");
  assert.match(app, /<button className="secondary-button" type="button" onClick=\{\(\)=>switchProductMode\("clubs"\)\}>Clubs<\/button>/);
  assert.doesNotMatch(app, /Clubs is temporarily locked/);
  assert.match(app, /localStorage\.setItem\("gg-product-mode",nextMode\)/);
  assert.match(app, /url\.searchParams\.delete\("mode"\)/);
});

test("Clubs API uses per-endpoint permissions instead of a global admin lock", () => {
  const routes = fs.readFileSync("server/routes/clubs.js", "utf8");
  assert.doesNotMatch(routes, /router\.use\(requireAuth, requireAdmin\)/);
  assert.match(routes, /router\.get\("\/"/);
  assert.match(routes, /requireAdmin/);
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



test("Clubs renewal policy allows 4-5 retained players and archives smaller outcomes", () => {
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");
  const routes = fs.readFileSync("server/routes/clubs.js", "utf8");
  const economy = fs.readFileSync("server/services/clubsEconomy.js", "utf8");

  assert.match(component, /Retain 4–5 players to renew/);
  assert.doesNotMatch(component, /current\.length < 2/);
  assert.doesNotMatch(component, /fewer than 2 dissolves/);
  assert.match(routes, /retained\.length < 4/);
  assert.match(economy, /At least one existing captain must be retained/);
});

test("Club public responses do not expose Club wallet balance and auction offers are authenticated", () => {
  const routes = fs.readFileSync("server/routes/clubs.js", "utf8");
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");

  assert.match(routes, /router\.get\("\/", async/);
  assert.match(routes, /\.select\("_id name nameNormalized description logoUrl memberIds captainIds status approvedAt"\)/);
  assert.match(routes, /router\.get\("\/auction\/offers\/:playerId", requireAuth/);
  assert.match(routes, /Auction offers are private to the player receiving them/);
  assert.match(routes, /router\.get\("\/players\/discovery"/);
  assert.match(component, /api\("\/clubs\/" \+ currentClub\._id \+ "\/wallet"\)/);
  assert.match(component, /clubWallet\?\.club\?\.balance/);
});


test("Clubs admin KPI and latest-club surfaces have dedicated responsive styles", () => {
  const styles = fs.readFileSync("src/features/clubs/clubs-mode.css", "utf8");
  assert.match(styles, /\.clubs-history-summary-grid\s*\{/);
  assert.match(styles, /\.clubs-history-stat\s*\{/);
  assert.match(styles, /\.clubs-admin-club-card\s*\{/);
  assert.match(styles, /@media \(max-width: 920px\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
});

test("Club formation stepper distinguishes captain-details approval from admin approval", () => {
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");
  const styles = fs.readFileSync("src/features/clubs/clubs-mode.css", "utf8");
  const routes = fs.readFileSync("server/routes/clubs.js", "utf8");
  const model = fs.readFileSync("server/models/clubs/ClubFormationApplication.js", "utf8");

  assert.match(component, /\["pendingCaptainDetailsApproval", "Club details"\]/);
  assert.match(component, /\["pendingAdminApproval", "Admin approval"\]/);
  assert.match(component, /pendingCaptainDetailsApproval: 5/);
  assert.match(component, /pendingAdminApproval: 6/);
  assert.match(component, /Waiting for captain details approval/);
  assert.match(component, /Waiting for admin approval/);
  assert.match(component, /application\.electedCaptainIds\?\.some/);
  assert.match(component, /application\.detailsApprovedBy\?\.some/);
  assert.match(component, /detailDrafts\[application\._id\] \?\? application\.details \?\? ""/);
  assert.match(component, /<textarea/);
  assert.match(component, /waitingForCoCaptain/);
  assert.match(styles, /\.clubs-name-proposal textarea/);
  assert.match(styles, /\.clubs-formation-status-note/);

  assert.match(model, /"pendingCaptainDetailsApproval"/);
  assert.match(routes, /function captainDetailsAreApproved/);
  assert.match(routes, /if \(!captainDetailsAreApproved\(application\)\)/);
  assert.match(routes, /Every elected captain must approve non-empty Club details before admin approval/);
  assert.match(routes, /normalizeLegacyFormationStage/);
});
