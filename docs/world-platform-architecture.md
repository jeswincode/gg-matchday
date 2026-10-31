# GG World Platform Architecture

Status: approved product direction and implementation contract  
Initial implementation baseline: main at 4cd537e9865c5ec8c56c1e626d80fac12041764b

## Product decisions

- Brand: GG.
- Every World is publicly discoverable.
- Joining a World requires owner/admin approval.
- A GG account can belong to multiple Worlds.
- The Global Map is the primary discovery and navigation experience.
- The Global Map uses an isometric strategy-game presentation.
- Each World owner/admin controls the placement of its local facilities and Club buildings.
- Club formation remains an approval-based workflow.
- Training includes individual workouts and organised team drills.
- Individual training records are private by default.
- Media is stored in GG-managed object storage; Google Drive is optional for exports/backups.
- Progression is cosmetic only.
- The map is the main experience, but conventional navigation and direct links remain available.

## Domain boundaries

### GG account

A global identity authenticated through Firebase. A user account is not a player profile and does not imply membership of any World.

Global account data includes authentication identity, account email, account preferences, connected login providers and platform-level permissions.

### World

A World is an independent football community. It owns its map, members, player profiles, matches, ratings, statistics, awards, news, conversations, training programmes and other World-scoped activity.

The first World will represent the existing GG Matchday group. Its public identity and slug will be finalised before production migration.

### World membership

Membership connects one global account to one World. It owns the World-specific role, membership status and optional player profile link.

A single account can have multiple memberships and a different Player profile in each World.

### Club

A Club is a team/squad within a World. It is not a World or a tenant. Existing Club rules, auctions, contracts, wallets, fixtures, settlement and history remain part of the Clubs subsystem.

## Data ownership invariant

Every World-owned record must carry a trusted World identifier. Every read, update, delete, aggregation, population and nested reference must be constrained to the resolved World.

A MongoDB document ID is never sufficient authorization by itself.

World context is derived server-side from a selected World slug and the authenticated user's membership. Client-provided world IDs are selectors at most; they are never authorization evidence.

## Database topology

Retain the existing Core MongoDB connection and separate Clubs MongoDB connection.

Core database owns global Users, Worlds, WorldMemberships and World-scoped Matchday data. Clubs database owns Club entities and financial/operational records.

Use shared collections with worldId scoping initially. Do not create one MongoDB database per World.

Cross-database writes cannot be assumed to share one transaction. Continue using idempotent jobs, retries and reconciliation for core Match to Clubs synchronization and settlement.

## Global Map

The Global Map is a GG-controlled, deterministic isometric map. It presents public Worlds as neighbouring kingdoms.

Global placement is assigned and validated by the platform. World owners do not control global kingdom coordinates.

The public map API returns a bounded projection of World data only: slug, display name, public emblem, public member-count bucket or count, map coordinates and public status. It must not return member lists, emails, private profiles, training data, wallet data or internal moderation details.

A selected kingdom can be previewed by any visitor. Entry into the internal World map requires active membership. Pending members see request status; non-members can submit a join request.

## World map

Each World has an owner/admin-managed isometric layout. The layout stores logical grid coordinates, not screen pixels. Map rendering is a projection of authoritative World and Club records, not a duplicate football database.

World facilities include the central stadium, Club District, Construction Grounds, Captains' Arena, Training Grounds, Community Hall, Hall of Fame and Administration Building.

Club buildings point to existing Club records. Construction plots point to the existing Club formation application workflow. Facility state must not become a competing source of truth for Club approvals.

## Existing Matchday compatibility

The current Matchday and Clubs workflows remain authoritative. The map is a navigation and presentation layer.

Do not change rating formulas, historic match results, OVR calculations, wallet balances or Club rules as part of tenant ownership work.

The old User.playerProfile field remains available during migration. WorldMembership.playerProfileId becomes the authoritative World-specific link only after the migration and all consumers have been updated.

## Storage

MongoDB stores structured records and metadata. GG-managed object storage holds large binary objects such as images, kits, profile media and training attachments.

Private media access is authorized by the backend. Do not expose provider credentials or permanent private object URLs to the browser.

Google Drive is an optional user-authorized export/backup destination. It is not the canonical data store and is not required to use GG.

## Rollout constraints

1. Build and test World models and authorization additively.
2. Add World scoping to every domain and background worker.
3. Validate Global Map projection and public response contracts using fixture data.
4. Dry-run a migration assigning existing records to the first World.
5. Test against a staging database and verify match/player/Club/ledger counts and references.
6. Only then migrate production data and enable the public Global Map experience.

## Non-goals for the initial foundation

- Cross-World matches or tournaments.
- Full direct messaging/friends/activity feed.
- Full game economy or pay-to-win progression.
- Native Rust/Tauri rewrite.
- Required Google Drive integration.
- Automatic player rating or OVR changes from training activity.
- Public exposure of private World or member data.
