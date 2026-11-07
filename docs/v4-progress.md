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

1. Complete signed-in V4 API runtime verification and run the full API/E2E suite against the isolated preview databases; the dedicated V4 API service is now deployed.
2. Build detailed, bespoke isometric tile/building art and true 2D room scenes; current landmark rooms are structured and navigable previews.
3. Build full HQ social spaces: realtime in-world chat, notifications, player-to-player interactions, moderation and presence safeguards.
4. Expand club-ground ownership/transfer administration and club-specific interiors. Residence privacy, invited visitors and consent-based residence ownership transfer are now implemented on the V4 branch.
5. Playtest and tune the Ball Control Challenge, including difficulty progression, mobile controls, replay edge cases, leaderboard abuse monitoring and score-validation coverage.
6. Extend the economy with broader furnishing collections, plot and club-ground upgrade sinks, reward tuning from playtest data, seasonal catalogues and abuse monitoring. The initial server-authoritative XP/coin wallet, ledger, capped training rewards, achievements, data-driven cosmetics catalogue/equipping, avatar presets and player-home upgrades are implemented on the V4 branch. Do not add real-money purchases in the initial release.
7. Extend the new Original GG movement, directional sprites and interaction animations into the other Matchday pages; add context-aware idle activities and celebration triggers there as well.
8. Complete mobile/accessibility/performance QA, add route/API tests, and run V3 regression checks before any production promotion.

## Validation

The GitHub validation workflow is enabled on v4/development. It runs lint, unit tests, build, bundle checks, server syntax checks, E2E tests and the isolated encrypted MongoDB restore smoke test. The latest Vercel status currently reports the deployment rate limit, so the new code has not yet been confirmed by a fresh V4 preview build. A preview build being READY is not equivalent to an end-to-end API-backed release.


## V4 companion, navigation and theme pass — 6 November 2026

- The Matchday companion now starts seated on the **upper-left account avatar** (not the separate floating My Profile shortcut). The sprite draws a seated torso, hands by the hips and slightly spread legs reaching forward over the account icon. The permanent gold orbit/ring has been removed.
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


## Single Original GG World and verified account access — 6 November 2026

- The upper-left account avatar is now the companion's profile resting anchor. Its resting layer is positioned absolutely inside the scrolling Matchday app so it scrolls with the account bar; selected navigation tabs remain viewport-fixed and use measured geometry. The player is held at rest on those two UI perches.
- The permanent gold orbit/ring is removed. Dark and Gold companion shadows inherit violet and green accents respectively.
- Original GG remains one canonical world identified by `WORLD_MAP_SLUG`; no per-user World creation is introduced.
- `GET /world/public-map` is a read-only static projection containing only district and landmark geometry. It excludes interiors, plots, player markers, avatar appearance, residence ownership/privacy, training, chat, economy and player IDs.
- All other `/world/*` APIs and all `/world/economy/*` APIs require a valid Firebase token with `email_verified=true`, an exact `@gmail.com` address matching the stored user, and an administrator-linked player profile. Non-production E2E test identities have a constrained test-only bypass.
- The admin account picker disables accounts that are not explicitly verified Gmail identities, and the server independently enforces the same rule on admin linking.
- Plot claiming, the claim endpoint, plot map markers and new default plot seeds are removed. Legacy WorldPlot/database records are intentionally left untouched; no destructive cleanup or migration runs in this pass.
- No V4 backend deployment, database migration, or PR merge is part of this change. V3 `main` is left independent.

### Follow-through — 6 November 2026

- The seated account-avatar perch and active-tab perch keep a front-facing pose and only use an occasional wave while anchored. Cheer/dance idle frames are disabled on both anchors so the legs do not lift off the surface. The selected-tab perch follows the measured active button centre; its 240 ms transform transition now overrides the legacy `transition:none!important` rule, while finger-driven tab scrubbing remains transition-free.
- The Original GG room scene no longer draws a character-name plaque below the sprite. Room interaction dialogue remains the only character speech label; the HQ room E2E test now asserts there is no text attached to the character sprite.
- The companion wrapper remains aligned to the measured anchor, while the actual painted sprite pixels are bottom-aligned inside the button: the seated profile sprite accounts for two transparent bottom rows and the standing nav sprite for one. Desktop/mobile bleed offsets are separately calibrated. The E2E test measures the rendered canvas foot line against the avatar seat line and selected-tab perch line (under 2 px tolerance), and checks the front-facing pose.
- The account avatar, Pip dialogue bubble and Pip action menu now inherit Matchday's violet dark-theme and green Gold-theme variables instead of hard-coded gold borders/surfaces.
- The admin account-link API independently rejects non-Gmail and unverified Gmail accounts. The companion menu also requires the verified Firebase email to match the backend account email exactly. API integration coverage includes both rejected link cases, an allowed verified Gmail link, and denial of private World access to a verified-but-unlinked Gmail account.
- These changes are committed only on `v4/development`. The V3 `main` branch, Render production service and shared Clubs database remain untouched.

### Pip profile perch and navigation movement correction — 6 November 2026

- The account-avatar perch now uses an exact centre anchor with a symmetric soft footprint; the app edge no longer clips the perch and offsets Pip from the avatar centre.
- Wrapper positioning uses the rendered wrapper height (desktop and mobile) instead of assuming a fixed 92 px height.
- The actual pixel sprite is bottom-aligned inside its button, compensating for transparent rows beneath the seated and standing boot pixels so the boots meet the measured perch line.
- The selected navigation tab is reached by the frame-based walking physics across the full navigation rail. Normal tab changes no longer assign Pip's x/y directly. Only horizontal finger-scrubbing directly tracks the selected tab.
- The layout observer no longer recentres Pip when the tab content resizes. It retargets through the same walking controller, and profile-anchor remeasurement cannot reset an in-progress jump. Both the sticky account avatar and fixed navigation now use viewport coordinates, with scroll/resize remeasurement keeping the sprite attached.
- Removed CSS transform transitions that were being restarted on every physics frame. The animation loop now owns the movement timing.
- Ordinary content-card clicks cannot pull Pip away from the profile or navigation resting anchors; the explicit Explore action remains available for roaming.
- Anchored idle behavior stays front-facing and prevents cheer/dance frames that lift his feet; seated idle frames also suppress the one-pixel body bob so the boots stay level on the avatar.
- The Matchday E2E test now checks the seated profile pose, actual foot-to-avatar alignment, standing navigation foot contact, and that switching between navigation tabs enters the walking phase. These tests are committed but have not yet been run in a fresh deployed preview.


### Community moderation follow-through — 7 November 2026

- Added an authenticated administrator-only Original GG moderation queue at `/admin/gg/world-messages`, with open, resolved and all-report filters.
- Administrators can hide a message, restore a previously hidden message, or dismiss its reports without changing the message. Decisions, reviewer identity, timestamp and optional note are retained on report records.
- The queue groups multiple reports against the same message and shows the message, location, sender, moderation state and individual report reasons.
- The player-facing live chat now removes hidden messages and inserts restored messages from the server event stream.
- Added an isolated integration test suite using separate in-memory Core and Clubs databases. It covers admin-only access, hide/restore/dismiss lifecycle, audit notes and invalid moderation requests.
- Render's dedicated `gg-matchday-v4-api` service now runs commit `108974aea685e152dc6afac541db2983783dd740` from `v4/development`. The deployment completed successfully on 7 November 2026.
- V4 preview startup logs confirm `V4 preview Core database connected`, `Clubs MongoDB connected`, and `V4 preview mode enabled; legacy background workers are disabled.`
- The database guard now accepts explicit source names for Atlas URIs that omit a database path. Read-only Atlas metadata identified the existing V3 databases as Core `test` and Clubs `gg_matchday_clubs`. Render's V4-only source-comparison settings name those sources, while the connection overrides point to `gg_matchday_v4_preview_core` and `gg_matchday_v4_preview_clubs`.
- Read-only Atlas verification confirms both V4 staging databases exist separately from the V3 databases, with 13 Core collections and 35 Clubs collections. No V3 records were copied or altered by this setup.
- Vercel's `VITE_API_URL` is branch-scoped to `v4/development` and points at `https://gg-matchday-v4-api.onrender.com/api`. The latest V4 frontend deployment is READY; production remains on the restored V3 `main` commit `c78e25c3d40e0e3319c5e5b27735c12e1e8cb2e1`.
- The new moderation integration tests and existing full unit/API/E2E suites are committed but have not yet been executed in this session. Browser-level visual confirmation of Pip and the complete signed-in V4 flows remains outstanding.


### Residence ownership transfer — 7 November 2026

- Added persistent `ResidenceTransfer` invitations with pending/accepted/declined/cancelled/expired states, seven-day expiry, audit timestamps and unique pending-transfer indexes for both the source residence and intended recipient.
- Home owners can search and invite only verified, linked Gmail players. The residence directory now filters out players who cannot enter Original GG.
- Only the intended recipient can accept or decline. Only the current owner can cancel. Acceptance uses a Clubs-database transaction to transfer the residence, replace only an untouched Level 1 recipient starter home, reset privacy to private and clear the previous owner's visitor list.
- Upgraded or furnished recipient homes are never overwritten. The acceptance route rechecks the recipient's home immediately before applying the transfer, so a home upgraded after invitation remains protected.
- The home privacy panel now displays incoming/outgoing invitations, accept/decline/cancel actions and refreshes the World map after a transfer is accepted.
- Added isolated integration tests for Gmail/link requirements, directory filtering, wrong-recipient acceptance, ownership transfer, access reset, existing-home protection, decline/cancel, expiry and post-invitation upgrades. Tests are committed but have not yet been executed in this session.
