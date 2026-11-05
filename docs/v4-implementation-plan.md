# GG Matchday V4 implementation plan

## Protected baseline

- V3 remains the production baseline on `main`.
- V4 development takes place on `v4/development`, branched from the restored V3 commit.
- V4 work must not merge experimental World-rollout commits into V3.
- Render's current `gg-matchday` service is connected to `main`; V4 branch pushes are not production deploys.

## Data boundary

The existing application has two MongoDB connections. Matchday's Core database owns users, Firebase-linked identity records, player profiles and match history. The separately configured Clubs connection owns Ultimate Clubs data. V4's character, map, presence and training records must use the existing Clubs connection and its configured database; no new database or guessed connection string is introduced.

New V4 collections are additive:
- `worldMaps`: canonical Original GG world layout, districts and interactive locations.
- `playerAvatars`: one customisable pixel-footballer configuration per linked GG player.
- `worldPresence`: short-lived map presence, automatically expired by MongoDB TTL.
- `trainingProfiles`: aggregate exercise counters and personal bests.
- `trainingSessions`: idempotent workout history.

Existing `clubs`, contracts, wallets, transactions, match sync, reviews and applications are not repurposed or overwritten.

## World design direction

Original GG is a fictional football city, not a real-world geographic basemap. It uses an isometric 2:1-inspired visual grid with a clear district plan:
- Crown Quarter: GG Headquarters, trophy/social hall and civic plaza.
- Stadium Quarter: main stadium, stands, turnstiles, fan plaza and match-day approach.
- Training Grounds: training centre, gym, multiple pitches and workout counter area.
- Club District: club grounds and shared streets.
- Residence Gardens: public streets and private, owner-controlled home interiors.
- Market Square: future cosmetics and economy storefront.
- Garden Park: trees, paths, benches, lighting and small easter eggs.

The map should remain legible at city scale and reveal richer building/interior detail as the user zooms in. Interactive hit areas must be larger than decorative art, keyboard accessible, and usable on touchscreens.

## Reference-derived interaction principles

- Leaflet's map interaction patterns inform drag panning, zoom around pointer, inertia, smooth fly-to and boundary clamping.
- Pip's companion architecture informs a persistent avatar model, animation/state separation, contextual hints and guided onboarding. The Leaflet BookReader project is a reader app with a companion, not an isometric city renderer; its reader-specific modules are not copied wholesale into GG Matchday.
- PixiJS/pixi-viewport and Tiled are evaluated as future rendering/content tools. The first implementation keeps dependencies stable and uses React/SVG while the world data model and map interactions mature.

## Delivery phases

1. Safe branch, database boundary, additive schemas, Original GG map shell and responsive interactions.
2. Persistent character creator, character movement and guided tutorial.
3. Building entrances and interiors: HQ, training centre, club grounds and private residences.
4. Training session history, verified server-side counter updates, achievements and economy.
5. Shared social layer: presence, chat, interactions, moderation and club ownership permissions.
6. Performance, accessibility, mobile QA, regression suite and staged preview deployment.

## Release gates

- No writes to production data during schema design or preview testing.
- New collections are created only by first V4 use, after the existing Clubs connection is confirmed.
- Every write is authenticated, player-linked and validated server-side.
- Economy mutations require an idempotent server-side ledger; frontend balances are never authoritative.
- V3 tests, lint and build must remain green before V4 is promoted.
- V4 is not deployed to production until a preview is reviewed and the user approves promotion.
