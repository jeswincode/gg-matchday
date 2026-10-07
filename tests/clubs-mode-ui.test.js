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


test("GG Assistant backend is grounded and navigation-safe", () => {
  const service = fs.readFileSync("server/services/ggAssistant.js", "utf8");
  const route = fs.readFileSync("server/routes/assistant.js", "utf8");
  const app = fs.readFileSync("server/app.js", "utf8");
  const ui = fs.readFileSync("src/components/GGAssistant.jsx", "utf8");
  const styles = fs.readFileSync("src/components/gg-assistant.css", "utf8");

  assert.match(service, /Player\.find/);
  assert.match(service, /Match\.find/);
  assert.match(service, /buildStatistics/);
  assert.match(service, /Never invent statistics/);
  assert.match(service, /Never invent.*players/);
  assert.match(service, /Allowed navigation actions/);
  assert.match(service, /\["player", "Open Player Profile"\]/);
  assert.match(route, /requireAuth/);
  assert.match(route, /answerAssistant/);
  assert.match(app, /app\.use\("\/api\/assistant", assistantRoutes\)/);
  assert.match(ui, /GG Assistant/);
  assert.match(ui, /one-tap|action/i);
  assert.match(styles, /\.gg-assistant-fab/);
  assert.match(styles, /@media\(max-width:560px\)/);
});


test("GG Assistant has a fast lane for deterministic GG questions", () => {
  const service = fs.readFileSync("server/services/ggAssistant.js", "utf8");
  const ui = fs.readFileSync("src/components/GGAssistant.jsx", "utf8");

  assert.match(service, /SNAPSHOT_TTL_MS/);
  assert.match(service, /fastAnswer/);
  assert.match(service, /most goals\|top scorer/);
  assert.match(service, /You can .* opening|Got it — opening/);
  assert.match(service, /generatedBy: "fast"/);
  assert.match(service, /needsAi/);
  assert.match(service, /getStatisticsSnapshot/);
  assert.match(ui, /GG is thinking through that analysis/);
  assert.match(ui, /GG is checking the Matchday database/);
});


test("GG Assistant keeps normal comparisons and performance questions on the fast lane", () => {
  const service = fs.readFileSync("server/services/ggAssistant.js", "utf8");
  assert.match(service, /function needsAi/);
  assert.doesNotMatch(service, /compare with\|comparison/);
  assert.match(service, /real\[- \]?life/);
  assert.match(service, /improve\|improvement/);
});
