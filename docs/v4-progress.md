# GG Matchday V4 — implementation progress

## Safety and release state

- Development branch: v4/development.
- Baseline: restored V3 main branch at c78e25c.
- Production main and the current Render production service have not been changed by V4 work.
- Vercel branch previews are isolated from the Render production API. The Express API remains on the production branch, so a complete browser end-to-end preview still requires a separate safe V4 API deployment/configuration.
- The V4 JSX build error in `src/features/WorldSocialPanel.jsx` was corrected on the branch. Vercel automatically produced a READY preview at `gg-matchday-n7cninonx-jeswincode.vercel.app` from commit `f7eb2d3`, which includes the sprite-animation and realtime-interaction implementation. The final presence GET-response, unit-test/documentation and verified-training-celebration commits were added after that preview, so the exact latest branch head still needs a fresh build. An explicit Vercel deployment API request is currently blocked by the Hobby plan's daily deployment API limit.
- No V4 data collections have been seeded in the production Clubs database by this implementation work.

## Existing database boundary

The application has separate Core and Clubs MongoDB connections. V4 world/player progression data is routed through the existing Clubs connection and configured database. No new database or guessed URI is introduced.

Additive collections:
- worldMaps — versioned isometric world layout, district coordinates, render layers and landmark interior room definitions.
- clubGrounds — persistent map position, level and access policy for each approved club.
- playerAvatars — one configurable human footballer per linked player.
- playerResidences — each linked player's home location, privacy and interior room layout.
- worldPresence — short-lived player position heartbeat with TTL expiry.
- trainingProfiles — lifetime workout counters and personal bests.
- trainingSessions — idempotent workout records.
- worldEconomies / worldEconomyLedger — server-authoritative GG Coins, XP, level progression and an auditable transaction ledger.
- worldInventoryItems — purchased and equipped character cosmetics.
- worldDailyProgress — UTC daily XP/coin caps and training reward limits.
- worldRewardClaims / worldAchievements — idempotent one-time reward claims and training milestones.

Existing clubs, player profiles, contracts, wallets, transactions, match history and account records are not repurposed.

## Current V4 implementation

- Coded responsive Enter Matchday welcome page replaces the poster-only click target. It includes a stadium scene, accessible entry button, keyboard entry, product notes and reduced-motion handling.
- Player profile page is accessible from the profile icon and includes account identity, linked-player status and avatar studio.
- Original GG world bootstrap creates or migrates the versioned city layout. The city is divided into Crown Quarter, Stadium Quarter, Training Grounds, Club District and Residence Gardens, with a stadium, HQ, academy, training centre, market and park.
- The map uses isometric tile metadata (128 × 64), ordered terrain/road/landscape/building/interaction/entity layers, responsive drag, wheel zoom, pinch zoom and bounded movement.
- Approved clubs receive persistent individual ground coordinates.
- Linked players receive a private residence record on first Original GG entry. Its exterior is visible in the shared city; the interior endpoint allows the owner only unless privacy is explicitly made public.
- HQ, stadium, training centre, academy, market and park room layouts are stored in the versioned world map document. Residence rooms are stored in the player's residence document.
- Human footballer sprites are rendered using the procedural pixel drawing primitives reused from Leaflet BookReader's Pip engine. The player artwork is original GG Matchday art, not Pip's plant character.
- The Matchday companion now follows Leaflet's pickup/throw physics: a damped cursor-pivot swing, carried angular momentum on release, Leaflet-matched gravity and wall/bounce thresholds, and touch-specific drag slop. On compact touch layouts it stays on the navigation lane unless a surface is explicitly marked as a companion ledge, avoiding accidental perching over page controls.
- Original GG now has four-way player facing (front/back/left/right), a frame-based walking cycle, idle fidgets, cheer/celebration poses and wave, high-five, cheer and dance gestures. Realtime interaction events animate the sender and recipient for connected clients; the last facing direction is validated and included in world-presence updates. Animation profiles and presence direction have unit coverage in `tests/characterAnimation.test.js`.
- Avatar fields include skin tone, body type, modular hairstyles, hair colours, kit colours, boots and headwear. The shared option catalogue separates free options from shop-unlocked options; the API checks ownership before saving paid looks.
- The avatar studio now supports up to five named saved appearance presets. Applying a preset revalidates cosmetic ownership.
- The Market also sells home furniture. Owners can place purchased furniture into compatible residence rooms; inventory consumption, room updates and a furnishing ledger entry are committed transactionally.
- Player movement is persisted through presence heartbeats. Other active players are rendered as clickable pixel characters; presence refreshes periodically.
- Training supports push-up, pull-up, squat and plank-hold counters, session duration, lifetime totals and personal bests. Sessions have unique idempotency keys and are validated server-side.
- The Training Centre also includes a Ball Control Challenge: each run receives a server seed, directional inputs are sequenced and queued, the server deterministically replays the run before accepting a score, repeat attempts are hourly-limited and verified best times feed a city leaderboard. A successful server-verified run triggers a celebration animation on the player's footballer. This is the first playable version; balance, accessibility and anti-abuse tuning still need playtesting.
- XP progression is server-owned with a 100-level nonlinear threshold curve, progress-to-next-level fields, a 250 XP / 120 coin global UTC daily cap, and lower dedicated training reward caps (150 XP / 70 coins).
- Reward sources include the one-time Original GG tutorial (40 XP / 20 coins), capped training-session rewards based on bounded server-validated session data, one-time training achievements, and capped level-up coin bonuses.
- Market items are data-driven in `shared/worldCustomization.js` (`WORLD_MARKET_CATALOG`): categories, appearance slots, collections, rarity, sort order, server-owned prices and level gates. The shop supports search, category and collection filters; adding new items does not require rewriting purchase routes.
- Market purchases use server catalogue prices, conditional balance debits, transaction ledger entries, per-player idempotency keys and inventory writes in one MongoDB transaction. Cosmetics equip by slot and update the saved avatar; owned options become available in the avatar studio.
- The versioned map now adds Fan Boulevard, GG Esports Arena and Community Pitches, with new Supporters and Community districts. The world renderer consumes stored map locations and has matching landmark art/icons.
- Player homes have a coin-priced upgrade path (levels 1–10), gated by player level and protected by idempotent ledger-backed transactions. No real-money purchase flow exists.
- A first-visit guided tour introduces city navigation, the avatar and training.
- HQ interior provides an entry point to the existing Matchday chat. This is not yet the complete in-world chat/notification/social system.

## Extensibility contract

- `docs/original-gg-extensibility.md` defines how to add shop items, avatar slots, map content and reward sources without rewriting core workflows.
- `docs/original-gg-economy-design.md` records the XP curve, sources, sinks, limits and transaction model.

## Reference reuse and design

- Leaflet BookReader is MIT licensed. Its procedural pixel drawing engine is reused in src/features/companion/leaflet-pip-engine.js. The required notice is in THIRD_PARTY_NOTICES.md.
- Leaflet interaction principles inform map drag, wheel zoom and pinch zoom.
- Tiled's layer separation informs the stored world layout.
- The map is a fictional football city rather than a geographic street basemap. The visual direction is a premium green football campus with a gold/black HQ, stadium bowl, club grounds, training pitches, residences, academy, market square, landscaped paths and parks.

## Remaining V4 work

1. Add a dedicated V4 API preview service or another isolated preview API target; do not point the V4 frontend at a production backend that lacks these routes.
2. Build detailed, bespoke isometric tile/building art and true 2D room scenes; current landmark rooms are structured and navigable previews.
3. Build full HQ social spaces: realtime in-world chat, notifications, player-to-player interactions, moderation and presence safeguards.
4. Build club-ground ownership controls, club-specific interiors, residence visitor permissions and broader furnishing sets.
5. Playtest and tune the Ball Control Challenge, including difficulty progression, mobile controls, replay edge cases, leaderboard abuse monitoring and score-validation coverage.
6. Extend the economy with broader furnishing collections, plot and club-ground upgrade sinks, reward tuning from playtest data, seasonal catalogues and abuse monitoring. The initial server-authoritative XP/coin wallet, ledger, capped training rewards, achievements, data-driven cosmetics catalogue/equipping, avatar presets and player-home upgrades are implemented on the V4 branch. Do not add real-money purchases in the initial release.
7. Extend the new Original GG movement, directional sprites and interaction animations into the other Matchday pages; add context-aware idle activities and celebration triggers there as well.
8. Complete mobile/accessibility/performance QA, add route/API tests, and run V3 regression checks before any production promotion.

## Validation

The GitHub validation workflow is enabled on v4/development. It runs lint, unit tests, build, bundle checks, server syntax checks, E2E tests and the isolated encrypted MongoDB restore smoke test. The latest Vercel status currently reports the deployment rate limit, so the new code has not yet been confirmed by a fresh V4 preview build. A preview build being READY is not equivalent to an end-to-end API-backed release.


## V4 companion, navigation and theme pass — 6 November 2026

- The Matchday companion now starts on the floating **My Profile** control (with the account avatar button as a fallback) in a dedicated seated pose. The sprite draws a seated torso, hands by the hips and slightly spread legs reaching forward over the pill. The permanent gold orbit/ring has been removed.
- Tapping the character now plays a short landing hop and the dialogue reads “10 out of 10 landing!”. The character name is no longer repeated above the dialogue. Original GG remains available from the companion action menu, while drag/throw physics are preserved.
- Navigation following now measures the selected tab's actual DOM rectangle and perches directly on that surface rather than walking toward it at the character's 46 px/s world speed. Scroll/resize refreshes the resting surface position. This follows Leaflet Pip's measured-footing/direct-transform principle while retaining the Matchday bottom bar as a fixed overlay.
- On mobile, holding and dragging horizontally across the five bottom tabs selects each tab as the finger crosses it. The translucent glass highlight is positioned from the measured button bounds and follows during the drag; the tab content previews live. A vertical gesture still remains available for page scrolling.
- Dark mode now uses neon-violet accents and Gold mode uses neon-green accents for navigation, profile/world surfaces and Clubs controls. The translucent material is concentrated on navigation and active controls; the world map and room illustrations keep their own game art rather than being recoloured into UI panels.
- Avatar saves and preset applications emit a shared avatar-updated event. The mounted Matchday companion receives linked-account edits immediately, and local visitor edits continue to refresh through the local-storage event.
- The first pass of the home-perch geometry and tab-perch geometry has focused unit coverage in `tests/companionLayout.test.js`. The walking/throwing physics regression tests remain in `tests/companionPhysics.test.js`.

### Remaining world-depth work

The current V4 world already provides a draggable/zoomable football-city map, a persistent character marker, landmark entry points, walkable room scenes, furniture interactions and training challenges. These are still the initial playable scenes, not a full Leaflet-scale simulation. The next world pass should deepen the resident/house interiors, arena activity loops, player-to-player social interactions, animation/state persistence and district-specific environmental interactions. The visual/theme pass above does not claim those deeper systems are complete.


### Room interaction pass — 6 November 2026

- Existing clickable room props now resolve to contextual player actions after the footballer walks to the object: sitting on sofas/benches/tactics tables/gaming stations, celebrating at football/training objects, and waving at banners/trophy displays.
- Character speech now appears after the approach animation completes, so the dialogue corresponds to the object being reached rather than starting at the far side of the room.
- Keyboard Enter/Space activates focused room objects as well as click/touch.
- The room interaction mapping is isolated in `shared/worldRoomInteractions.js` and covered by `tests/worldRoomInteractions.test.js`.
