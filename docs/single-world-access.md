# GG Matchday single-World access foundation

## Product rule

GG Matchday has exactly one shared football World. Production must configure
`GG_PRIMARY_WORLD_SLUG` to the slug of the **existing** intended Original GG
World after a read-only database audit. The server fails closed if this value
is absent in production or the selected active World cannot be found. The
development fallback `original-gg` never creates a World.

World creation, switching and self-service join requests are disabled. The
public Global Map endpoint exposes one safe World projection only. Its local
map, facilities and World-owned football data remain private.

## Authorization invariant

Every private World request requires:

1. A currently valid Firebase ID token.
2. Firebase `email_verified === true`.
3. A valid normalized `@gmail.com` address.
4. Exact equality between the Firebase UID and the stored GG User UID.
5. Exact equality between the verified Firebase email and the stored GG User email.
6. An active `WorldAccessGrant` for the canonical World, exact email and exact GG User ID.
7. An active `WorldMembership` for that same World and user.

The only bypass is the configured platform administrator. That identity must
match `ADMIN_EMAIL`, be verified by Firebase on the current request, match the
persisted UID and email, and have `platformRole=platform_admin`. The platform
role is synchronized from the verified configured identity during
authentication; the database role alone never grants platform administration.

Invitations are saved as `invited`; they activate on a subsequent verified
Firebase-authenticated request for the exact invited Gmail identity. Activation
updates the grant and active membership in one MongoDB transaction. Revocation
sets the grant to `revoked` and suspends membership in one transaction.
Protected requests read the grant from MongoDB each time, so an extant Firebase
token cannot preserve revoked access.

## Sign-in and navigation lifecycle

1. **Open the app:** the public shell and safe one-World Global Map projection can load without exposing private map or football records.
2. **Sign in with Google:** Firebase verifies the identity. Firebase authentication by itself does not grant access.
3. **Resolve the GG account:** the backend matches the verified Firebase UID and exact verified Gmail address to the persisted GG User. Non-Gmail and unverified identities cannot activate an invitation.
4. **Resolve the invitation:** the backend checks the exact Gmail/World grant. An invited identity activates only on a verified sign-in, with grant and membership updated atomically. Uninvited, revoked or suspended identities remain outside the private World.
5. **Enter Original GG:** the user selects the single public Global Map projection. The private local map request re-checks the current grant and active membership before returning facilities or football data.
6. **Use Matchday:** Home returns to the Global Map/local map; the existing Matchday navigation exposes Record, Leaderboard, Calendar, Players and Journal, with Admin tools reserved for the configured platform administrator.
7. **Open Clubs:** the Clubs link appears only for roles with `clubs:participate`. Every private Clubs API route checks that capability again; Club administration additionally requires `clubs:manage`.
8. **Logout or lose access:** logout clears the active World selector and private UI state. A denied protected request or focus/visibility revalidation returns the user to the public map/entry experience; loss of Clubs-only capability returns the user to Matchday without discarding an otherwise active World membership.

## World role capabilities

- **Owner/Admin:** full World administration, map/facility administration, Matchday editing, own-profile management, community chat, rating disputes and Club administration.
- **Editor:** Matchday recording/editing, own-profile management, community chat, rating disputes and normal Clubs participation; cannot administer World membership or the private map.
- **Member:** own-profile management, community chat, rating disputes, normal Clubs participation and own training workflows; cannot record/edit Matchday results or administer Clubs.
- **Viewer:** read-only World access; cannot create or change a player profile, submit profile-change requests, send chat messages or submit rating disputes, and has no Clubs navigation or Clubs API access.

The Clubs API checks `clubs:participate` for every private Clubs route and
checks `clubs:manage` for administrative Club operations. The client hides
navigation that the current role cannot use, but the API remains authoritative.
When a role or grant is changed while the app is open, protected API failures
or focus/visibility revalidation move the user out of an unauthorized private
surface and clear revoked World state.

## Admin API

- `POST /api/worlds/admin/primary/ensure`: idempotently ensure owner membership
  for the configured administrator in the existing canonical World. Does not
  create a World.
- `GET /api/worlds/admin/access`: list invitations, linked accounts and status.
- `POST /api/worlds/admin/access`: create/reissue a Gmail invitation with
  `{ "email": "person@gmail.com", "role": "member" }`; choose `viewer` for
  read-only access or `editor` for Matchday editing and participation.
- `DELETE /api/worlds/admin/access/:grantId`: revoke access and suspend the
  corresponding active membership.
- `GET /api/worlds/map`: safe public projection of exactly one World.
- `GET /api/worlds/me` and `GET /api/worlds/:slug/membership`: current
  account's own access status only.

Disabled routes return an explicit single-World/invitation-required response:

- `POST /api/worlds`
- all `/api/worlds/:slug/join-requests` request and review actions.

## Private route coverage

`server/app.js` installs a default-deny guard for private API namespaces
before route handlers. Auth self-service, safe World entry/preview, health and
weather routes retain separate policies. Matchday and Clubs routers also
resolve canonical World context and no longer opt into null/unscoped legacy
records when the World header is absent.

The service worker must remain application-shell-only. It must never cache
authenticated API responses, memberships, private World data or private media.

## Database inventory and migration plan

Run the read-only inventory after setting verified database credentials and
the intended existing slug:

```bash
GG_PRIMARY_WORLD_SLUG=original-gg npm run audit:single-world
```

The script lists all existing Worlds and reports counts for selected-World,
legacy null/missing-`worldId`, and other-World records in the relevant Core
and separate Clubs collections. If either URI omits its database path, set
`MONGODB_DATABASE` or `CLUBS_DB_NAME` explicitly. The audit refuses to guess
or silently use MongoDB's `test` default. It does not write, delete, archive
or reassign records.

Before an apply migration:

1. Confirm the canonical World ID, name, slug, owner and status against the
   product owner and existing production records.
2. Take and verify backups of both Core and Clubs databases.
3. Inspect memberships, World-specific Player profiles, layouts, facilities,
   matches, events, stats and all cross-collection references.
4. Inventory Clubs, contracts, fixtures, auctions, wallets, transactions,
   settlement records, sync jobs and their links to Core Matchday.
5. Plan the reassignment of legacy null/missing-`worldId` data only where
   ownership is proven. Preserve every historical record and financial total.
6. Archive/disable additional Worlds only after all references are reconciled;
   never delete them as part of this change.
7. Build a resumable migration with pre/post counts, orphan detection,
   financial reconciliation, idempotency and an operator-reviewed dry run.
8. Validate in staging before production.

Rollback must restore the pre-migration Core and Clubs backups and the previous
server configuration. Do not guess which World owns an unscoped record to
perform an improvised reverse migration.

No production database migration has been run by this branch change because
production credentials and verified backups were not available.

## Existing-World map initialization

The first authorized request to `GET /api/worlds/:slug/map` now performs an
idempotent insert-only initialization for an existing canonical World. It
creates the isometric 60 × 60 layout and any missing standard facility records
(stadium, Club district, construction grounds, captain arena, training
grounds, community hall, Hall of Fame and administration). Existing layout
customizations and facility records are preserved. Concurrent first visits
are safe against duplicate-key races.

The route integration test and Playwright browser fixture now start with an
existing World and no map layout/facility records, then verify first-entry
initialization. This is separate from the read-only Core/Clubs inventory and
reviewed data migration described above.
