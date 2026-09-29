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
  assert.ok(route.includes('const stats=buildStatistics(players,matches).find(s=>s.playerId===req.params.id)'));
  assert.ok(route.includes('res.json({player,stats,analytics:buildPlayerPerformanceAnalytics'));
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
  assert.match(app,/experience\s*,\s*setExperience\s*\]\s*=useState\('startup'\)/);
  assert.match(app,/activeExperience === "entry"/);
  assert.match(app,/activeExperience === "welcome"/);
  assert.match(app,/setExperience\("entry"\)/);
  assert.match(startup,/Continue with Google/);
  assert.match(startup,/Explore as Guest/);
  assert.match(startup,/ENTER MATCHDAY/);
  assert.match(app,/Sign in from the Matchday entry screen/);
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
  assert.match(route,/router\.patch\("\/:id\/background-video", requireAuth, requireAdmin/);
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


test('golden theme uses an inverted gold-surface and dark-ink palette',()=>{
  const features=read('src/components/features.css');
  const video=read('src/video-background.css');
  assert.match(features,/data-theme="golden"/);
  assert.match(features,/--bg:#8c6a2b/);
  assert.match(features,/--panel:#b9964d/);
  assert.match(features,/--text:#1a140a/);
  assert.match(features,/--accent:#1b150b/);
  assert.match(video,/html\[data-theme="golden"\] \.gg-video-overlay/);
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


test('guest mode keeps an explicit sign-in path after entering the app',()=>{const source=read('src/App.jsx');assert.match(source,/setExperience\("entry"\)/);assert.match(source,/>Sign In<\/button>/);});
test('admin player video drafts resync when the player list arrives',()=>{const source=read('src/features/admin/AdminPage.jsx');assert.match(source,/useEffect\(\(\)=>\{[\s\S]*setVideoDrafts\(/);assert.match(source,/\}, \[players\]\)/);});
