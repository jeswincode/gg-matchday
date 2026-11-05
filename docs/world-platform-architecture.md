# GG Matchday — Single-World Platform Architecture

Status: current product direction and implementation contract

## Product decision

GG Matchday is moving from the original single Matchday application into one shared football World experience.

There is exactly one active football World: the existing Original GG World. This product decision supersedes the earlier multi-World discovery and join-request architecture described in previous drafts.

- The Global Map is the primary Home and shows one public kingdom.
- The kingdom preview is public; the local World interior is private.
- Entry requires a verified Gmail account explicitly linked by the platform administrator.
- World creation, switching and self-service join requests are disabled.
- Existing Matchday and Clubs workflows remain authoritative and must continue to work with their existing records.
- The World map is a presentation/navigation layer, not a second football database.

## Account, World and Player identity

### GG account

A global Firebase-authenticated account stored as a User record. Account email and Firebase UID must match the current verified Firebase identity.

### Original GG World

The one existing canonical World record. Production selects it through `GG_PRIMARY_WORLD_SLUG`; the server must fail closed if the configured World is missing or ambiguous.

### World membership and access grant

A WorldAccessGrant records the administrator-issued Gmail invitation and its invited/active/revoked state. WorldMembership records the active World role, status and optional Player profile link.

Both the exact verified Gmail grant and active membership are required for normal private access. The platform administrator is a separate, verified configured identity with `platformRole=platform_admin`; legacy global role strings are not a bypass.

### Player

Player remains the football identity inside the Original GG World. Existing Player IDs and references in historic matches must be preserved. WorldMembership.playerProfileId is the authoritative account-to-player link; a legacy User.playerProfile may be recovered only when it points to a Player in the canonical World and that Player is not already claimed by another membership.

### Club

A Club is an existing squad within the Original GG World, not a separate tenant. Existing formation, captain voting, contracts, market, auctions, budgets, wallets, fixtures, settlement, betting, statistics and history remain part of the Clubs subsystem.

## Global Map and private World map

### Global Map

The public map API returns exactly one safe Original GG kingdom projection. It must not expose the local map, facility coordinates, membership roster, emails, private player information, training records, Club financial data or moderation details.

Map navigation supports panning and zooming, including touch pinch gestures, mouse wheel and accessible zoom controls. Selecting the kingdom opens its preview. Only an active invited member can enter.

### Local World map

The private interior uses an isometric logical grid. Its standard facilities are:

- Central Stadium
- Club District
- Construction Grounds
- Captains' Arena
- Training Grounds
- Community Hall
- Hall of Fame
- Administration Building

The initial layout is a 60 × 60 tile map. Facility placement is persisted in logical grid coordinates. The backend validates bounds, overlaps and expected layout version in a transaction. Existing custom layouts and facility records must be preserved during initialization.

Only the owner/platform administrator may move or rotate facilities. Members can select facilities and inspect details in read-only mode.

## Existing Matchday compatibility

The original Matchday capabilities remain required:

- Player directory and profiles.
- Match recording, editing, deletion and archive.
- GG match ratings and separate defensive ratings.
- OVR and player performance tracking.
- Leaderboards and rankings.
- Monthly, annual and match-level awards.
- Awards history, Hall of Fame and achievements.
- Match calendar and match details.
- News, chat, notifications, rating explanations and disputes.
- Existing admin workflows.

The Global Map is the primary Home. The previous Matchday dashboard remains available as a secondary Matchday Journal so its latest-match summary, totals, news, player comparisons and Hall of Fame entry are not lost.

### Ratings and awards

Do not change the established GG match-rating formula, defensive-rating separation, OVR calculations or historical match results as part of World ownership work.

Player and season statistics snapshots must be keyed by World and Player. Monthly award finalization must be idempotent and World-scoped. Current-month awards remain provisional; closed-period awards and achievements remain immutable after finalization.

### Calendar and synchronization

Match create/edit/delete operations must refresh the shared application data state so Calendar, Matchday history, leaderboard, awards and related tabs show consistent data. Calendar reads use authenticated World-scoped APIs and bypass stale response caching when refreshing.

Match-to-Clubs synchronization remains durable and idempotent. Jobs carry World context, retry safely and reconcile linked Club matches and settlements without duplicating wallet transactions.

## Clubs compatibility

The existing Clubs workflows must be preserved:

- Flexible 4–5 member formation.
- Captain selection and voting.
- Captain-details approval and administrator review.
- Club renewals and retention.
- Player market and signing offers.
- Auction reservations and player choice.
- Captain approval and final settlement.
- Club and Player wallets.
- Budget/committed-balance reconciliation.
- Fixtures, bookings, Club matches and Matchday sync.
- Match rewards, betting and settlement.
- Club/player statistics, reviews, audit events and history.

World scoping must constrain Core and separate Clubs database operations. Background workers must explicitly process each World scope. Cross-database writes remain retryable and reconcilable; do not assume Core and Clubs transactions are shared.

## Data ownership and request context

Every World-owned record must carry a trusted World identifier. Reads, updates, deletes, aggregations, populations, nested references and background jobs must be constrained to the canonical World.

The client sends `X-World-Slug` as a selector. The backend resolves the configured World and verifies the active grant, membership and required capability on every private request. A client-supplied World ID is never authorization evidence.

The active World selector is part of GET cache and in-flight request identity. Signing out or leaving the World clears the selector. Private API responses and private media must remain network-only in the service worker.

## Database topology

Retain the existing Core MongoDB connection and separate Clubs MongoDB connection.

Core owns Users, Worlds, WorldMemberships, WorldAccessGrants and Matchday records. Clubs owns Club entities and operational/financial records. Shared collections are initially scoped with worldId; do not create a database per World.

## Rollout and migration constraints

The current branch includes a read-only Core/Clubs inventory. It does not include or execute a production data migration.

Before enabling the new World experience against production data:

1. Confirm the canonical existing Original GG World record.
2. Inventory all Core and Clubs collections.
3. Take and verify backups of both databases.
4. Reconcile every legacy null/missing-world record and all cross-collection references.
5. Build a resumable idempotent migration with dry-run, pre/post counts, orphan checks, financial reconciliation and operator confirmation.
6. Validate in staging.
7. Apply only after explicit approval and a tested rollback plan.

Do not merge, deploy to production, change production environment variables or migrate production data without explicit owner approval.
