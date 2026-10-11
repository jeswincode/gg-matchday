import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Clubs mode keeps formation controls, discovery and admin surfaces while using task navigation", () => {
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");
  const styles = fs.readFileSync("src/features/clubs/clubs-mode.css", "utf8");

  assert.match(component, /Ultimate Clubs/);
  assert.match(component, /Player History/);
  assert.match(component, /data-primary-tab="overview"/);
  assert.match(component, /data-primary-tab="myClub"/);
  assert.doesNotMatch(component, /aria-label="Ultimate Clubs sections"/);
  assert.doesNotMatch(component, /aria-label="My Club sections"/);
  assert.match(component, /clubs-subnav/);
  assert.match(component, /clubs-hub-discovery-grid/);
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
  assert.match(app, /const \[productMode,setProductMode\]=useState\("matchday"\)/);
  assert.doesNotMatch(app, /localStorage\.getItem\("gg-product-mode"\)/);
  assert.doesNotMatch(app, /localStorage\.setItem\("gg-product-mode"/);
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
  assert.match(component, /Form a 4–5 player Club/);
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

test("Clubs command center explains both captain-details and admin-review waiting states", () => {
  const routes = fs.readFileSync("server/routes/clubs.js", "utf8");
  assert.match(routes, /title: "Club formation submitted"/);
  assert.match(routes, /waiting for administrator review/i);
  assert.match(routes, /Details approved — awaiting co-captain/);
  assert.match(routes, /The other elected captain must approve the same details/);
});

test("Club Hub is formation-first and keeps Club credits out of the first-screen showcase", () => {
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");
  const styles = fs.readFileSync("src/features/clubs/clubs-mode.css", "utf8");

  assert.match(component, /<h1>\{adminOnlyView \? "Clubs Admin" : "Club Hub"\}<\/h1>/);
  assert.match(component, /data-primary-tab="overview"/);
  assert.match(component, /data-primary-tab="myClub"/);
  assert.match(component, /data-primary-tab="market"/);
  assert.match(component, /data-primary-tab="matches"/);
  assert.match(component, /data-primary-tab="players"/);
  assert.match(component, /data-primary-tab="reviews"/);
  assert.match(component, /Your formation progress/);
  assert.match(component, /clubs-hub-pipeline-actions/);
  assert.match(component, /OFFICIAL CLUB DIRECTORY/);
  assert.match(component, /clubs-formation-form/);
  assert.match(component, /clubs-official-directory/);
  assert.match(component, /clubs-wallet-dashboard/);
  assert.match(component, /MY CLUB \/ DASHBOARD/);
  assert.match(component, /AVAILABLE CLUB BUDGET/);
  assert.match(component, /clubs-myclub-overview-grid/);
  assert.match(component, /clubs-myclub-quick-actions/);
  assert.match(component, /FORMATION IN PROGRESS/);
  assert.match(component, /Manage signings/);
  assert.match(component, /Club matches/);
  assert.doesNotMatch(component, /aria-labelledby="clubs-hub-title"/);
  assert.doesNotMatch(component, /CLUB STARTING BUDGET/);
  assert.doesNotMatch(component, /clubs-hub-starter-budget/);

  const hubStart = component.indexOf('{activeSection === "overview" && ultimateSubsection === "overview" ? (');
  const formation = component.indexOf('id="clubs-formation-pipeline"', hubStart);
  const stats = component.indexOf('className="clubs-hub-stat-grid"', hubStart);
  assert.ok(hubStart >= 0 && formation > hubStart && stats > formation, "Formation progress should appear before overview cards");

  assert.match(styles, /\.clubs-hub-stat-grid\s*\{/);
  assert.match(styles, /\.clubs-hub-next-step\s*\{/);
  assert.match(styles, /\.clubs-hub-discovery-grid\s*\{/);
  assert.match(styles, /\.clubs-hub-pipeline-actions\s*\{/);
  assert.match(styles, /\.clubs-myclub-overview-grid\s*\{/);
  assert.match(styles, /\.clubs-myclub-quick-actions\s*\{/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
  assert.match(styles, /@media\s*\(max-width:\s*520px\)/);
});

test("Club primary navigation uses top-level Market and Matches with guarded touch-swipe navigation", () => {
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");
  const styles = fs.readFileSync("src/features/clubs/clubs-mode.css", "utf8");

  assert.match(component, /const primaryTabKeys =/);
  assert.match(component, /const navigatePrimaryTab = key =>/);
  assert.match(component, /onTouchStart=\{handleClubsTouchStart\}/);
  assert.match(component, /onTouchEnd=\{handleClubsTouchEnd\}/);
  assert.match(component, /Math\.abs\(dx\) < 72/);
  assert.match(component, /input, textarea, select, button, a, \[contenteditable='true'\]/);
  assert.match(component, /activeSection === "market"/);
  assert.match(component, /setActiveSection\("market"\)/);
  assert.match(component, /Swipe left or right to switch tabs/);
  assert.doesNotMatch(component, /aria-label="Ultimate Clubs sections"/);
  assert.doesNotMatch(component, /aria-label="My Club sections"/);

  assert.match(styles, /\.clubs-swipe-hint\s*\{/);
  assert.match(styles, /scroll-snap-type:\s*x mandatory/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
});


test("Dark Clubs theme shares Matchday's navy and blue palette without changing Gold", () => {
  const styles = fs.readFileSync("src/features/clubs/clubs-mode.css", "utf8");
  const darkThemeStart = styles.lastIndexOf("/* ---------- Dark theme continuity: Matchday navy / blue atmosphere ---------- */");
  assert.ok(darkThemeStart >= 0, "Dark theme continuity overrides should be present");
  const darkTheme = styles.slice(darkThemeStart);

  for (const selector of [
    ".clubs-app", ".clubs-topbar", ".clubs-nav", ".clubs-section-tabs",
    ".clubs-primary-button", ".clubs-secondary-button", ".clubs-application",
    ".club-card", ".clubs-hub-stat", ".clubs-myclub-overview-stat",
  ]) {
    assert.ok(darkTheme.includes(selector), `Dark blue theme should style ${selector}`);
  }

  assert.match(darkTheme, /--clubs-bg:\s*#080d17/i);
  assert.match(darkTheme, /--clubs-panel:\s*#101827/i);
  assert.match(darkTheme, /--clubs-surface-2:\s*#142238/i);
  assert.match(darkTheme, /--clubs-border:\s*#2a3b57/i);
  assert.match(darkTheme, /--clubs-accent-contrast:\s*#101a2b/i);
  assert.match(darkTheme, /rgba\(39, 101, 193, \.31\)/);
  assert.match(darkTheme, /#dce8f8/i);
  assert.match(darkTheme, /\.clubs-formation-stepper span\[data-state="current"\] b/);
  assert.match(darkTheme, /html\[data-theme="dark"\]\[data-product-mode="clubs"\]/);
  assert.match(darkTheme, /Preserve the warm Gold theme exactly as designed/);
  assert.doesNotMatch(darkTheme, /html\[data-theme="golden"\]/);
  assert.match(styles, /html\[data-theme="golden"\]\[data-product-mode="clubs"\] \.clubs-app/);
});


test("Clubs mobile scrolling remains vertical and Players subsection tabs fit the viewport", () => {
  const component = fs.readFileSync("src/features/clubs/ClubsMode.jsx", "utf8");
  const styles = fs.readFileSync("src/features/clubs/clubs-mode.css", "utf8");

  assert.match(component, /onTouchMove=\{handleClubsTouchMove\}/);
  assert.match(component, /const handleClubsTouchMove = event =>/);
  assert.match(component, /We never prevent the browser's default vertical scrolling behavior\./);
  assert.match(component, /clubs-players-section/);
  assert.match(styles, /overflow-x:\s*clip;\s*overflow-y:\s*visible;/);
  assert.match(styles, /html\[data-product-mode="clubs"\] body/);
  assert.match(styles, /html\[data-product-mode="clubs"\] #root/);
  assert.match(styles, /overflow-x:\s*clip;\s*overflow-y:\s*visible;/);
  assert.match(styles, /touch-action:\s*pan-y pinch-zoom/);
  assert.match(styles, /\.clubs-players-section > \.clubs-section-heading/);
  assert.match(styles, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /\.clubs-players-section \.clubs-subnav button/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
});
