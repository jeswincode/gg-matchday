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

## Admin API

- `POST /api/worlds/admin/primary/ensure`: idempotently ensure owner membership
  for the configured administrator in the existing canonical World. Does not
  create a World.
- `GET /api/worlds/admin/access`: list invitations, linked accounts and status.
- `POST /api/worlds/admin/access`: create/reissue a Gmail invitation with
  `{ "email": "person@gmail.com", "role": "member" }`; `editor` must be
  explicitly selected.
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
and (when configured) separate Clubs collections. It does not write, delete,
archive or reassign records.

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

## Verification notes

The branch's previously existing `tests/world-routes.test.js` and
`src/features/globalMap/GlobalMapPage.jsx` are currently present as short
incomplete files in the remote branch. Repair/recovery of those files and the
frontend access manager are follow-on work; their current state must not be
represented as passing browser or UI verification.
