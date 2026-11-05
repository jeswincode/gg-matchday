# GG Matchday V4 — implementation progress

## Safety and release state

- Development branch: v4/development.
- Baseline: restored V3 main branch at c78e25c.
- Production main and the current Render production service have not been changed by V4 work.
- Vercel creates branch preview builds for v4/development. The Express API remains on the production branch, so a complete browser end-to-end preview still requires a separate safe V4 API deployment/configuration.
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
- Avatar fields include skin tone, body type, modular hairstyles, hair colours, kit colours, boots and headwear. The shared option catalogue separates free options from shop-unlocked options; the API checks ownership before saving paid looks.
- The avatar studio now supports up to five named saved appearance presets. Applying a preset revalidates cosmetic ownership.
- The Market also sells home furniture. Owners can place purchased furniture into compatible residence rooms; inventory consumption, room updates and a furnishing ledger entry are committed transactionally.
- Player movement is persisted through presence heartbeats. Other active players are rendered as clickable pixel characters; presence refreshes periodically.
- Training supports push-up, pull-up, squat and plank-hold counters, session duration, lifetime totals and personal bests. Sessions have unique idempotency keys and are validated server-side.
- XP progression is server-owned with a 100-level nonlinear threshold curve, progress-to-next-level fields, a 250 XP / 120 coin global UTC daily cap, and lower dedicated training reward caps (150 XP / 70 coins).
- Reward sources include the one-time Original GG tutorial (40 XP / 20 coins), capped training-session rewards based on bounded server-validated session data, one-time training achievements, and capped level-up coin bonuses.
- Market items are data-driven in `shared/worldCustomization.js`: categories, appearance slots, collections, rarity, sort order, server-owned prices and level gates. The shop supports search, category and collection filters; adding new items does not require rewriting purchase routes.
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
4. Build club-ground ownership controls, club-specific interiors, residence visitor permissions and home furnishing.
5. Build the training mini-game, anti-cheat scoring and leaderboard.
6. Extend the economy with broader furnishing collections, plot and club-ground upgrade sinks, reward tuning from playtest data, seasonal catalogues and abuse monitoring. The initial server-authoritative XP/coin wallet, ledger, capped training rewards, achievements, data-driven cosmetics catalogue/equipping, avatar presets and player-home upgrades are implemented on the V4 branch. Do not add real-money purchases in the initial release.
7. Add character movement/idle/throw/swirl animations and companion presence across the existing Matchday pages.
8. Complete mobile/accessibility/performance QA, add route/API tests, and run V3 regression checks before any production promotion.

## Validation

The GitHub validation workflow is enabled on v4/development. It runs lint, unit tests, build, bundle checks, server syntax checks, E2E tests and the isolated encrypted MongoDB restore smoke test. A preview build being READY is not equivalent to an end-to-end API-backed release.
