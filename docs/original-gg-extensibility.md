# Original GG V4 — Extensibility Contract

The Original GG world is designed as a platform that can accept new content without changing the core player, inventory, map or reward workflows.

## Shop content

Add a cosmetic in `shared/worldCustomization.js` (`WORLD_MARKET_CATALOG`) with:

- Stable unique `id` (never reuse an ID after release).
- `name`, `description`, `category`, and appearance `slot`.
- Server-owned integer `price` and `minLevel`.
- `rarity`, `collection`, and `sortOrder` metadata.
- A validated `appearancePatch` containing only supported avatar appearance fields.

The catalogue drives API responses, purchase validation, avatar unlock validation, slot-based equipping, furniture placement and shop filtering. Furniture items use a `furniturePlacement` definition with allowed room IDs and a stable furniture key; placement consumes one owned inventory unit and writes a ledger event transactionally. The frontend does not own prices or unlock requirements. New categories should be added to `WORLD_COSMETIC_CATEGORIES`; new appearance fields must be added to the shared options, free-option policy, avatar Mongoose schema and pixel renderer before being sold.

Do not delete or recycle an item ID that appears in an inventory or ledger. Retire old catalogue entries by marking them unavailable in a future catalogue status field while preserving inventory history.

## Avatar customisation

- `AVATAR_OPTIONS` is the complete set of values the data model and renderer can represent.
- `FREE_AVATAR_OPTIONS` is the subset available without a shop unlock.
- Owned cosmetics extend the player's editable choices.
- The API verifies ownership when saving a paid appearance, not only when equipping from the shop.
- The pixel renderer is data-driven and should retain a safe fallback for unknown/old values.
- Up to five named appearance presets are stored on the player's avatar. Applying a preset rechecks ownership so old data cannot bypass a later unlock policy.

To add a new slot: define its values, add a schema field, define the renderer layer, define its free-option policy, and then add catalogue entries. Existing appearance documents should receive safe defaults.

## World map content

The map blueprint in `server/config/ggWorldRules.js` is versioned. New districts, locations, plots, interiors and render layers are additive. Bump `DEFAULT_WORLD_LAYOUT.version` when the stored blueprint changes.

Migration rules:
- Preserve player/club-owned coordinates and existing plot state.
- Add new default locations and districts.
- Preserve unknown custom locations/plots rather than dropping them.
- Refresh system-owned landmark descriptions/interiors where explicitly versioned.
- Keep stable IDs for any location referenced by player presence or ownership.

The client renders locations from the stored world layout, so new locations should not require a separate frontend hard-coded map list. Add building artwork and a location icon for any new `kind`, with a generic fallback for unknown kinds.

## Progression and rewards

New rewards should use the shared progression service and a stable, unique source key. Never accept XP, coin values, prices or level from a browser request. Add a source-specific cap when a new activity could be repeated or automated. One-time achievements need a stable achievement ID and unique player/achievement record. Add both reward source and currency sink; avoid inflation by creating a meaningful use for new currencies.

## Persistence and compatibility

All Original GG data remains on the existing Clubs MongoDB connection. Extend the dedicated world collections; do not repurpose V3 wallet, transaction or player records. Use MongoDB transactions for operations that change more than one durable collection. Use unique indexes and idempotency keys for repeatable actions.

## Definition of done for new content

1. Shared catalogue/schema data and safe defaults exist.
2. Server validates ownership, eligibility and input.
3. The user interface discovers content from the API response.
4. Renderer supports the visual state and unknown values degrade safely.
5. Migration does not delete user-owned data.
6. Tests cover IDs, option validity, unlocks, transaction invariants and map versions.
7. Lint, unit, build, bundle, server and E2E checks pass.
