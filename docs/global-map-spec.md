# GG Global Map Specification

Status: approved product direction; implementation begins with projection primitives and fixture data.

## Purpose

The Global Map is the primary entry experience for GG. It presents public Football Worlds as neighbouring kingdoms in a custom isometric strategy-game environment.

It is not a geographic street map. It uses original fictional terrain, roads, rivers, coastlines, castles and kingdom artwork.

## Product behaviour

- Logged-in and logged-out visitors may explore public kingdom previews.
- A public kingdom preview exposes only approved public information.
- An active member may enter that World.
- A pending member sees their request status and cannot enter internal facilities.
- A non-member may submit a join request.
- A member of multiple Worlds can switch between those Worlds.
- The user can return to the Global Map from any World.
- Existing feature navigation and direct routes remain accessible.

## Global placement

Global placement belongs to GG platform administration/map placement logic, not individual World owners.

Each World has logical coordinates (mapId, x, y). Coordinates are not CSS pixels and must not be recalculated from the current viewport.

Active kingdom placements must not overlap. Use a unique compound index or an explicit placement allocator that guarantees deterministic non-overlapping coordinates.

Map layout changes must be versioned. A map seed can generate decorative terrain, but authoritative World identity and placement must not depend on nondeterministic client-side generation.

## Public map projection

The public map endpoint returns a minimal projection:
- world slug
- display name
- public description summary, if approved
- public emblem asset reference
- public member count or bucket
- global map coordinates
- public World status

It must not return private Player profiles, emails, membership lists, training records, chat, wallet balances, moderation details or Club financial data.

Member-specific entry eligibility is returned separately for the authenticated user, or derived through a membership endpoint. Do not leak membership lists to all visitors.

## Entry state machine

- loading
- global
- selected
- preview
- entering
- internal

A kingdom selection opens a preview. An authenticated active member can enter. An unauthenticated visitor is directed to authentication before submitting a join request. Pending and rejected members cannot transition to internal.

The zoom transition is presentation only. Backend authorization still occurs when loading internal World data.

## Isometric projection contract

Map positions are stored as integer tile coordinates (column, row). For tile dimensions tileWidth/tileHeight:

screenX = originX + (column - row) * tileWidth / 2  
screenY = originY + (column + row) * tileHeight / 2

Screen coordinates are derived and never persisted.

The inverse projection is required for hit testing and map editing. Map camera zoom and pan remain client-side state.

## Rendering architecture

React 19 remains the application shell and owns accessible interface panels, menus, dialogs and existing feature screens.

A dedicated renderer owns terrain, sprites, hit testing, isometric depth ordering, camera movement, pan/zoom and transitions. PixiJS is the preferred candidate to evaluate against a lightweight Canvas/SVG prototype; no renderer dependency is approved until a performance/accessibility prototype is measured.

Renderer input is a bounded map-scene DTO, not raw Mongoose documents.

Do not load full match histories, training logs, chat history or financial data to render the map.

## Performance and accessibility

- Render visible map tiles and objects only where possible.
- Keep map art and sprite assets versioned and cacheable.
- Support mouse, keyboard, touch and pinch zoom.
- Provide a reduced-motion mode and respect OS accessibility preferences.
- Keep a conventional searchable World list as an alternative to the map.
- On mobile, preserve large tap targets and prevent accidental page scroll while panning.
- Do not make map interaction the only route to football records.

## Initial prototype scope

- A fixed seeded map with fixture kingdom data.
- Isometric tile projection and inverse hit testing.
- Pan/zoom camera boundary.
- Selectable kingdom markers/buildings.
- Public preview panel contract.
- A stubbed entry transition.

The prototype must not connect to production World data until World access middleware is ready.
