# GG Global Map Specification

Status: single-World Original GG implementation.

## Product rule

GG Matchday has exactly one shared football World: Original GG. Visitors may
view its safe public Global Map projection. There is no user-created World,
kingdom, plot claiming, World switching, or self-service join flow. Access to
the private football experience is granted only when the platform
administrator explicitly links a verified Gmail account.

## Public map projection

The public map endpoint returns one safe Original GG projection only. It must
not expose private Player profiles, emails, membership lists, training
records, chat, wallet balances, moderation details or Club financial data.
The public map is not evidence of private football-data access.

## Access and entry

A private World request requires the current verified Firebase identity, the
exact linked Gmail identity, an active administrator-issued access grant and
an active Original GG membership. Revocation must block subsequent protected
requests even when a Firebase session remains valid. Platform-administrator
privileges are separately verified and audited.

Unauthenticated and unlinked accounts may see only the public Global Map
projection. There are no join requests or membership self-service actions.
The only supported World context is the configured canonical Original GG
World.

## Fixed local map

The Original GG local map uses a 60 × 60 isometric grid and a fixed set of
standard facilities. Facility configuration is stored separately from World
creation/allocation logic. First authorized entry initializes only missing
layout/facility records; existing layout customizations are preserved.

Owners/admins with the map-edit capability can move or rotate facilities.
Updates validate integer grid coordinates, footprint bounds, rotation,
overlap and expected layout version, then commit the facility change and
layout-version increment transactionally. Members have read-only map access.

Facility selection currently exposes facility details; it does not imply that
a dedicated gameplay workflow (for example, training or stadium operations)
has been implemented. Matchday and Clubs remain separate application
workflows.

## Rendering and accessibility

The map is an isometric presentation, not a geographic street map. Logical
tile positions are stored as integer (column, row) values; screen coordinates
are derived at render time. Camera pan/zoom remains client-side. Keep the
existing conventional Matchday navigation available so map interaction is
never the only route to football records. Support keyboard, touch, pinch zoom,
reduced motion and accessible interface panels.

## Data and rollout boundary

Matchday and Clubs records are scoped to the canonical World. Existing
production records with missing or null World identifiers must be inventoried,
reconciled and backfilled only through the reviewed migration process in
`docs/single-world-access.md`. Do not infer ownership of unscoped records.
Take and verify Core and Clubs backups, rehearse in staging, reconcile
historical records and financial totals, and obtain explicit approval before
production migration.

No production database migration is performed by the feature branch.
