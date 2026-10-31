# World Map Layout and Facilities Specification

Status: approved design contract

## World layout ownership

Each World owner/admin controls the placement and appearance of facilities and Club buildings in that World.

The platform controls Global Map kingdom placement. A World owner cannot move a kingdom into another kingdom's reserved global coordinates.

Members may customise only those cosmetic objects or areas explicitly permitted by World settings. Members cannot move protected core facilities or another Club's building.

## Coordinate model

- Store integer logical grid coordinates.
- Store footprint dimensions in logical tiles.
- Store rotation as 0, 90, 180 or 270 degrees.
- Store map dimensions and layout version in WorldMapLayout.
- Never store screen pixel positions.
- Validate that each facility footprint remains within map bounds.
- Prevent overlapping protected facilities and Club building footprints.
- Use deterministic rendering order based on tile depth and footprint rules.

## Standard facility catalogue

- central_stadium
- club_district
- construction_grounds
- captains_arena
- training_grounds
- community_hall
- hall_of_fame
- administration

A World may have one instance of each standard facility key unless a later product decision explicitly permits multiple instances.

## Club buildings

A Club building references the canonical Club record in the Clubs database. Map placement is presentation metadata. It must not duplicate rosters, wallets, contracts or match data.

A Club's name, logo and public display metadata are read from the canonical Club record under World scope.

## Construction plots

A construction plot is linked to an existing Club formation application. Its visual state derives from the application:
- available
- reserved
- under_review
- approved
- rejected

Approval and Club creation remain controlled by existing Club formation services and rules. The map must not create a Club by itself.

When approved, the Club building may replace the reserved plot. The operation must be idempotent and auditable.

## Layout editing

Owner/admin actions:
- place or move a facility
- change a permitted theme/appearance
- rotate a building
- place or remove decorations
- arrange a Club building where the Club workflow permits

Every edit is validated server-side against map bounds, overlap rules and role capabilities.

Consider adding optimistic concurrency using layoutVersion so simultaneous editors cannot silently overwrite one another.

## Data separation

WorldMapLayout and WorldMapFacility live in the Core database.

Club map placement metadata should be stored with the canonical Club record in the Clubs database or in a dedicated Clubs map-placement record. The chosen approach must preserve the separate database boundary and avoid a second conflicting Club record in Core MongoDB.
