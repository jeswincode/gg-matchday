# GG Football World Access Contract

Status: current single-World product contract

## Product rule

GG Matchday has exactly one shared football World: the existing Original GG World.

- The Global Map exposes one public kingdom projection.
- Selecting the kingdom previews it; entering its private interior requires an administrator-linked Gmail account.
- There is no World creation, World switching, self-service join request, or multiple-World selection.
- Only the configured platform administrator can create/reissue Gmail invitations and revoke access.
- A visitor without an invitation may view the public kingdom projection but cannot access the local map, facilities, player records, Matchday, or Clubs data.

## Authentication and access

A normal account receives private World access only when the current request satisfies all of these conditions:

1. Firebase verifies the current ID token.
2. Firebase reports `email_verified === true`.
3. The verified email is a valid normalized `@gmail.com` address.
4. The Firebase UID exactly matches the persisted GG User UID.
5. The Firebase email exactly matches the persisted GG User email.
6. An active `WorldAccessGrant` exists for the canonical World, exact email and exact GG User ID.
7. An active `WorldMembership` exists for the same World and user.

An extant Firebase token does not preserve access after a grant is revoked. Protected requests check the active grant from MongoDB.

The platform administrator is the only bypass. The current Firebase identity must be verified, match `ADMIN_EMAIL`, match the persisted email and UID, and have `platformRole=platform_admin`. A legacy `User.role=admin` value alone never grants platform administration.

## Invitations and revocation

- Invitations are created by the platform administrator for a Gmail address and a selected `member` or `editor` role.
- Invitations remain in `invited` state until the exact verified Firebase Gmail identity signs in.
- Activation updates the grant and membership in one MongoDB transaction.
- Revocation marks the grant `revoked` and suspends the corresponding active membership in one transaction.
- Re-inviting a revoked Gmail address creates a new invitation state; access activates only after verified sign-in again.

## Roles

- `owner`: full control of the existing World, including membership and map administration.
- `admin`: World administration and membership/map controls.
- `editor`: permitted Matchday recording and editing; no map or Clubs administration capability.
- `member`: normal participant access to permitted Matchday and Clubs features.
- `viewer`: read-only access.

Backend capability checks are authoritative. Frontend visibility is not an authorization boundary.

## Player identity

The global `User` record represents the authenticated account. `Player` remains the football identity and retains all historic match references.

`WorldMembership.playerProfileId` is the authoritative link between the account and its existing Player record in the Original GG World. On World entry, the server may recover the legacy `User.playerProfile` link only when:

- the referenced Player belongs to the canonical World;
- the membership has no existing player link; and
- no other membership has claimed that Player profile.

If no safe existing link is available, the member may create or explicitly link a Player profile. Existing Player records and their match history must never be deleted or silently replaced.

## Public and private map boundary

The public Global Map returns one bounded, safe World projection. It does not expose the local layout, facility details, members, emails, private player records, training data, wallet data or moderation details.

The private local map contains the existing standard facilities:

- Central Stadium
- Club District
- Construction Grounds
- Captains' Arena
- Training Grounds
- Community Hall
- Hall of Fame
- Administration Building

Only the World owner/platform administrator can edit facility placement. Members receive read-only map access. Facility movement and rotation use logical grid coordinates, bounds/overlap validation, optimistic layout versions and transactional persistence.

## Canonical World context

The client sends the selected World slug as request context. It is a selector only, never proof of access. The server resolves the configured primary World, verifies the current identity, grant, membership and capability, then establishes trusted request context:

- `req.world`
- `req.worldId`
- `req.membership`

Private Matchday and Clubs APIs must never fall back to unscoped legacy records when a normal production request lacks World context.

## Core APIs

- `GET /api/worlds/map`: one safe public kingdom projection.
- `GET /api/worlds/me`: the authenticated account's own access status.
- `GET /api/worlds/:slug/map`: active members' private local map.
- `GET /api/worlds/:slug/player-profile`: the current account's existing World Player link.
- `POST /api/worlds/:slug/player-profiles`: create and link a Player profile when no existing profile is available.
- `POST /api/worlds/admin/access`: create/reissue a Gmail invitation.
- `GET /api/worlds/admin/access`: list invitation and access status.
- `DELETE /api/worlds/admin/access/:grantId`: revoke access.

World creation and self-service join routes are disabled.

## Data migration and rollout

All existing Original GG Matchday and Clubs records must be assigned to the canonical World only after ownership and references are verified. This includes Player and Match records, rating/stat snapshots, awards, achievements, news, votes, memberships, Club entities, contracts, fixtures, auctions, wallets, transactions, settlements and synchronization jobs.

The current inventory command is read-only. It does not migrate data. Before production rollout:

1. Confirm the existing Original GG World ID, slug, name, owner and status.
2. Run the read-only Core and Clubs inventory.
3. Take and verify backups of both databases.
4. Reconcile all null/missing-World records and cross-database references.
5. Build and review an idempotent, resumable migration with dry-run output, pre/post counts, orphan checks and financial reconciliation.
6. Validate the migration in staging.
7. Only then apply it to production under an approved change window.

Never guess ownership for unscoped records, delete historic records, or improvise a reverse migration. No production migration is authorized by this branch work.
