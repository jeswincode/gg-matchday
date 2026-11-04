import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Player Comparisons keeps its player dependency stable and supports the comparison contract',()=>{
  const source=read('src/components/PlayerComparisons.jsx');
  assert.match(source,/const players=useMemo\(\(\)=>Array\.isArray\(playerData\)\?playerData:\[\],\[playerData\]\);/);
  assert.match(source,/selectedIds\.length>=2&&selectedIds\.length<=3/);
  assert.match(source,/Promise\.all\(selectedIds\.map\(playerId=>api\(`\/stats\/player\/\$\{playerId\}\?historyLimit=all`\)\)\)/);
  assert.match(source,/Goals/);
  assert.match(source,/Assists/);
  assert.match(source,/Attacking/);
  assert.match(source,/Defending/);
  assert.match(source,/GG Rating/);
  assert.match(source,/Performance trend/);
  assert.match(source,/Recorded match ratings from oldest to newest/);
});

test('Latest News uses an internal scroll viewport rather than growing the page',()=>{
  const css=read('src/news-scroll.css');
  const home=read('src/features/home/HomePage.jsx');
  assert.match(css,/\.news-list\{[^}]*max-height:476px[^}]*overflow-y:auto/);
  assert.match(css,/\.news-card\{min-height:145px\}/);
  assert.match(css,/@media\(max-width:600px\)\{\.news-list\{max-height:440px/);
  assert.match(home,/<div className="news-list">/);
  assert.match(home,/news\s*\.slice\(\s*0\s*,\s*6\s*\)\s*\.map/);
});
test('Calendar hover popover preserves all matches from the main baseline',()=>{
  const calendar=read('src/features/calendar/Calendar.jsx');
  assert.match(calendar,/\{dayMatches\.map\(match=>/);
  assert.doesNotMatch(calendar,/dayMatches\.slice\(\s*0\s*,\s*3\s*\)/);
});

test('Player Performance API exposes the canonical GG-v3 career rating used by the profile',()=>{
  const route=read('server/routes/stats.js');
  assert.ok(route.includes("router.get('/player/:id/performance'"));
  assert.ok(route.includes("loadPlayerStatistics([player])"));
  assert.ok(route.includes("buildPlayerPerformanceAnalytics(players, matches, req.params.id)"));
  assert.match(route,/res\.json\(\{\s*player,\s*stats:\s*rows\[0\],\s*analytics:\s*buildPlayerPerformanceAnalytics/);
});

test('post-merge cleanup keeps Gemini debug route unique and match save invalidation single-shot',()=>{
  const news=read('server/routes/news.js');
  const app=read('src/App.jsx');
  assert.equal((news.match(/router\.get\(\s*["']\/debug\/gemini["']/g)||[]).length,1);
  assert.match(app,/invalidate\(\);\s*resetMatchForm\(\);\s*await Promise\.all\(\[/);
  assert.doesNotMatch(app,/invalidate\(\);\s*resetMatchForm\(\);\s*invalidate\(\);/);
});


test('Player Comparisons trend uses GG-v3-aware effective ratings',()=>{
  const source=read('src/components/PlayerComparisons.jsx');
  assert.match(source,/participant\?\.ratingSystem==='gg-v3'/);
  assert.match(source,/effectiveRating\(participant\)/);
  assert.equal(source.includes('Number(rating)-(Number.isFinite(ownGoals)?ownGoals:0)'),false);
});


test('mobile Record rows collapse non-participants and expose rating points on demand',()=>{
  const css=read('src/own-goals-ui.css');
  const component=read('src/features/matches/MatchRecordForm.jsx');
  assert.match(css,/\.gg-performance-row:not\(\.assigned\) \.counter/);
  assert.match(css,/\.gg-performance-row:not\(\.assigned\) \.gg-code-cell/);
  assert.match(css,/\.gg-mobile-rating-details\s*\{[^}]*display:\s*block/s);
  assert.match(component,/className="gg-mobile-rating-details"/);
});

test('Refined startup flow replaces the account-bar login with startup, entry, and welcome gates',()=>{
  const app=read('src/App.jsx');
  const startup=read('src/components/StartupExperience.jsx');
  assert.match(app,/const \[experience,setExperience\]=useState\(\(\) => \{/);
  assert.match(app,/e2eRole === "guest" \? "entry" : "startup"/);
  assert.match(app,/activeExperience === "entry"/);
  assert.match(app,/activeExperience === "welcome"/);
  assert.match(app,/setExperience\("entry"\)/);
  assert.match(startup,/Continue with Google/);
  assert.ok(startup.includes("Explore the Global Map as Guest"));
  assert.match(startup,/aria-label="Enter Matchday"/);
  assert.doesNotMatch(startup,/gg-welcome-button-visual|>ENTER MATCHDAY/);
  assert.match(app,/Read-only access/);
});

test('Player profile supports cinematic video, image, and global background fallback',()=>{
  const profile=read('src/features/players/PlayerProfile.jsx');
  const model=read('server/models/Player.js');
  assert.match(model,/backgroundVideoUrl:/);
  assert.match(profile,/player\.backgroundVideoUrl/);
  assert.match(profile,/profile-hero-video/);
  assert.match(profile,/profile-hero-image/);
  assert.match(profile,/poster=\{player\.profileImage \|\| undefined\}/);
});

test('Player background video management is admin-only at the API boundary',()=>{
  const route=read('server/routes/players.js');
  const admin=read('src/features/admin/AdminPage.jsx');
  assert.ok(route.includes('router.patch("/:id/background-video", requireAuth, requireDomainCapability("world:manage", requireAdmin)'));
  assert.match(route,/backgroundVideoUrl/);
  assert.match(route,/valid http\(s\) URL/);
  assert.match(admin,/Background Videos/);
  assert.match(admin,/Video URL/);
  assert.match(admin,/onUpdatePlayerBackgroundVideo/);
});


test('Refined visual layer keeps viewport-fixed navigation stable and avoids transformed app ancestors',()=>{
  const refined=read('src/refined-v2.css');
  assert.match(refined,/\.app\s*\{[\s\S]*?animation:\s*gg-app-fade-in/);
  assert.doesNotMatch(refined,/animation:\s*gg-app-enter/);
  assert.match(refined,/\.gg-backdrop\s*\{[\s\S]*?min-height:\s*100dvh/);
});


test('golden theme uses the refined dark hierarchy and cinematic overlay',()=>{
  const gold=read('src/gold-theme-refined.css');
  const video=read('src/video-background.css');
  assert.match(gold,/--bg:\s*#090805/);
  assert.match(gold,/--panel:\s*#11100d/);
  assert.match(gold,/--text:\s*#f6f1e7/);
  assert.match(gold,/--accent:\s*#e3bc67/);
  assert.match(video,/html\[data-theme="golden"\] \.gg-video-overlay/);
  assert.doesNotMatch(video,/rgba\(185,150,77/);
});

test('gold theme keeps the premium dark hierarchy with gold used as the accent',()=>{
  const gold=read('src/gold-theme-refined.css');
  assert.match(gold,/--bg:\s*#090805/);
  assert.match(gold,/--panel:\s*#11100d/);
  assert.match(gold,/--text:\s*#f6f1e7/);
  assert.match(gold,/--accent:\s*#e3bc67/);
  assert.match(gold,/color-scheme:\s*dark/);
  assert.match(gold,/bottom-nav button\.active/);
});


test('guest mode keeps an explicit sign-in path after entering the app',()=>{const source=read('src/App.jsx');assert.match(source,/setExperience\("entry"\)/);assert.match(source,/className="secondary-button"[\s\S]*?Sign In/);});
test('admin player video inputs fall back to loaded player video URLs',()=>{const source=read('src/features/admin/AdminPage.jsx');assert.match(source,/videoDrafts\[id\] \?\? player\.backgroundVideoUrl \?\? ""/);});


test('mobile navigation keeps exactly five Matchday destinations and leaves Global Map on Home',()=>{
  const app=read('src/App.jsx');
  const map=read('src/features/globalMap/GlobalMapPage.jsx');
  const css=read('src/features/globalMap/immersive-world-map.css');
  assert.match(app,/const TAB_ORDER = \[\s*TABS\.HOME,\s*TABS\.RECORD,\s*TABS\.LEADERBOARD,\s*TABS\.CALENDAR,\s*TABS\.PLAYERS,\s*\]/);
  assert.doesNotMatch(app,/TABS\.GLOBAL_MAP/);
  assert.match(app,/if \(activeTab === TABS\.HOME\)[\s\S]*?<GlobalMapPage/);
  assert.match(map,/const items = \[\s*\{ id: "home"[\s\S]*?\{ id: "players"/);
  assert.match(css,/\.gg-world-bottom-nav\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css,/\.gg-world-screen\{[^}]*position:fixed/);
  assert.match(app,/onTouchStart=\{handleAppTouchStart\}/);
  assert.match(app,/onTouchEnd=\{handleAppTouchEnd\}/);
});

test('entering a World activates app-wide API context and logout clears it',()=>{
  const page=read('src/features/globalMap/GlobalMapPage.jsx');
  const app=read('src/App.jsx');
  assert.match(page,/setApiActiveWorld\(world\.slug\)/);
  assert.match(app,/setApiActiveWorld\(null\)/);
  assert.match(app,/async function logout\(\)/);
});

test('immersive Home restores an active World and preserves admin access',()=>{
  const page=read('src/features/globalMap/GlobalMapPage.jsx');
  assert.match(page,/getActiveWorldSlug\(\)/);
  assert.match(page,/result\.membershipStates\[activeSlug\] !== "active"/);
  assert.match(page,/setEnteredWorld\(world\)/);
  assert.match(page,/setApiActiveWorld\(null\)/);
  assert.match(page,/isAdmin && <button[^>]*gg-world-admin-link/);
  assert.ok(page.includes('onNavigateAdmin={enteredWorld ? () => onNavigateTab?.("admin") : null}'));
  assert.ok(page.includes('{isAdmin && onNavigateAdmin && <button'));
});

test('Global Map always projects one kingdom and never exposes claimable World plots',()=>{
  const page=read('src/features/globalMap/GlobalMapPage.jsx');
  const scene=read('src/features/globalMap/GlobalMapScene.jsx');
  const routes=read('server/routes/worlds.js');
  assert.ok(page.includes("slice(0, 1)"));
  assert.ok(!["availablePlots","claimPlot","globalMapSlotIndex","createModalOpen"].some(value => page.includes(value)));
  assert.ok(!["availablePlots","ClaimPlot","onClaimPlot"].some(value => scene.includes(value)));
  assert.ok(routes.includes("worlds: [safeWorld(world)]"));
  assert.ok(!routes.includes("availablePlots"));
});

test('GG sign-in supports Google, email/password, account creation and password reset',()=>{
  const login=read('src/components/StartupExperience.jsx');
  const app=read('src/App.jsx');
  const firebase=read('src/firebase.js');
  assert.match(login,/Continue with Google/);
  assert.match(login,/onEmailSignIn/);
  assert.match(login,/onCreateAccount/);
  assert.match(login,/onPasswordReset/);
  assert.match(login,/Create your GG account/);
  assert.match(login,/Forgot password\?/);
  assert.match(app,/signInWithEmailAndPassword/);
  assert.match(app,/createUserWithEmailAndPassword/);
  assert.match(app,/sendEmailVerification/);
  assert.match(app,/sendPasswordResetEmail/);
  assert.match(firebase,/getAuth\(initializeApp\(firebaseConfig\)\)/);
});

test('single-World entry is grant-gated and preserves one player identity inside Original GG',()=>{
  const page=read('src/features/globalMap/GlobalMapPage.jsx');
  const routes=read('server/routes/worlds.js');
  const player=read('server/models/Player.js');
  assert.ok(page.includes("slice(0, 1)"));
  assert.doesNotMatch(page,/function WorldSwitcher|Your Worlds/);
  assert.ok(page.includes('accessStatus !== "active"'));
  assert.match(page,/function PlayerProfileModal/);
  assert.ok(page.includes("/player-profiles"));
  assert.ok(routes.includes("/:slug/player-profiles"));
  assert.ok(routes.includes("worldId: req.worldId"));
  assert.ok(routes.includes("playerProfileId = created._id"));
  assert.match(player,/player_world_name_unique/);
  assert.match(player,/worldId: 1, nameNormalized: 1/);
});

test('Original GG map shows decorative open land markers without claim interactions',()=>{
  const view=read('src/features/globalMap/WorldMapView.jsx');
  const css=read('src/features/globalMap/world-map-view.css');
  assert.match(view,/LOCAL_OPEN_LAND_MARKERS/);
  assert.match(view,/function LocalOpenLandMarker/);
  assert.match(view,/const openPlots = LOCAL_OPEN_PLOTS\.filter/);
  assert.match(view,/openPlots\.map\(plot/);
  assert.match(css,/\.gg-world-open-plot/);
});

test('Global Map administrator links and revokes Gmail access instead of creating Worlds',()=>{
  const page=read('src/features/globalMap/GlobalMapPage.jsx');
  const routes=read('server/routes/worlds.js');
  assert.ok(page.includes("function WorldAccessManager"));
  assert.ok(page.includes('api("/worlds/admin/access")'));
  assert.ok(page.includes('method: "POST"') && page.includes('method: "DELETE"'));
  assert.ok(page.includes('method: "POST"') && page.includes('method: "DELETE"'));
  assert.ok(routes.includes('router.post("/admin/access"'));
  assert.ok(routes.includes('router.delete("/admin/access/:grantId"'));
  assert.ok(routes.includes("SINGLE_WORLD_ONLY"));
  assert.ok(routes.includes("WORLD_INVITATION_REQUIRED"));
  assert.ok(!["globalMapSlotIndex","onClaimPlot","claimPlot"].some(value => page.includes(value)));
});

test('World navigation separates public discovery, member entry, and owner map editing',()=>{
  const page=read('src/features/globalMap/GlobalMapPage.jsx');
  const scene=read('src/features/globalMap/WorldMapView.jsx');
  const routes=read('server/routes/worlds.js');
  assert.ok(page.includes('api("/worlds/admin/access")'));
  assert.match(page,/\/map"\)/);
  assert.match(page,/onEnterWorld=\{enterWorld\}/);
  assert.match(scene,/permissions\?\.canEditMap/);
  assert.match(scene,/expectedLayoutVersion/);
  assert.match(scene,/quarterTurn/);
  assert.match(scene,/rotate\(" \+ rotation \+ "\)/);
  assert.match(routes,/requireActiveWorldMembership/);
  assert.match(routes,/requireWorldCapability\("map:edit"\)/);
});

test('mobile calendar hides hover match popovers while preserving day details',()=>{
  const css=read('src/index.css');
  const calendar=read('src/features/calendar/Calendar.jsx');
  assert.match(css,/@media \(max-width: 760px\) \{[\s\S]*?\.calendar-popover\s*\{[\s\S]*?display: none !important/s);
  assert.match(calendar,/onClick=\{\(\)=>setSelectedDay\(day\)\}/);
  assert.match(calendar,/DAY DETAILS/);
});


test('mobile tab swipe visibly drags the full application stage and settles to the next tab',()=>{
  const app=read('src/App.jsx');
  const css=read('src/mobile-ux.css');
  assert.match(app,/onTouchMove=\{handleAppTouchMove\}/);
  assert.match(app,/setSwipeOffset\(deltaX\)/);
  assert.match(app,/translate3d\(\$\{swipeOffset\}px,0,0\)/);
  assert.match(app,/setSwipeOffset\(deltaX<0 \? -window\.innerWidth : window\.innerWidth\)/);
  assert.match(app,/setActiveTab\(TAB_ORDER\[nextIndex\]\)/);
  assert.match(css,/\.mobile-tab-stage\s*\{/);
  assert.match(css,/touch-action:\s*pan-y/);
});


test('decorative star background stylesheet is not loaded',()=>{
  const main=read('src/main.jsx');
  assert.doesNotMatch(main,/v1\.3-stars\.css/);
});


test('shared Modal renders through document.body so nested page animations and fixed navigation cannot contain it',()=>{
  const modal=read('src/components/Modal.jsx');
  assert.match(modal,/createPortal\(modal,document\.body\)/);
  assert.match(modal,/document\.body\.style\.overflow='hidden'/);
});

test('player performance keeps the modal as the single scroll container',()=>{
  const css=read('src/components/player-performance-dashboard.css');
  assert.doesNotMatch(css,/\.perf-dashboard\{[^}]*overflow\s*:/);
  assert.doesNotMatch(css,/\.perf-dashboard\{[^}]*max-height\s*:/);
});
