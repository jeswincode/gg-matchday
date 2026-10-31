# World and Membership Contract

Status: approved design contract

## World rules

- A World is publicly discoverable.
- Joining requires an explicit request and owner/admin approval.
- An account may join multiple Worlds.
- A World has one owner and may have admins, editors, members and viewers.
- A World owner is not automatically a GG platform administrator.
- The platform does not grant global administration from the existing World-level ADMIN_EMAIL identity. The configured identity must be mapped to the first World during migration, with any platform-level authority represented separately.

## World fields

Required:
- name
- slug
- ownerUserId
- visibility
- joinPolicy
- status

The slug is lowercase, URL-safe, globally unique and immutable after publication unless an audited slug-change operation is introduced.

Locked values for the current product:
- visibility: public
- joinPolicy: approval

World status:
- active
- suspended
- archived

World global-map coordinates are assigned and validated by platform map-placement logic. X and Y must be assigned together or both remain unset until placement is reserved.

## Membership fields

Required:
- worldId
- userId
- role
- status

Optional:
- playerProfileId
- requestedAt
- approvedAt
- approvedBy
- rejectedAt
- rejectedBy
- decisionNote
- lastActiveAt

A unique compound index on worldId + userId prevents duplicate memberships.

A partial unique index on worldId + playerProfileId prevents two accounts from claiming the same Player profile in one World while permitting one account to link to different Player documents in different Worlds.

## Membership states

- pending: a join request is awaiting review.
- active: the account is an approved member.
- rejected: the request was rejected; a later request may follow an explicit re-request policy.
- suspended: access was suspended by World administration.
- left: the account voluntarily left the World.

Only active memberships grant internal World access. Pending, rejected, suspended and left memberships do not.

Every active membership, including the initial owner membership created with a World, must have an activation/approval timestamp. The approver may be null for the initial owner if the World creation transaction itself establishes ownership.

## Roles

- owner: full control of one World, including ownership transfer and membership administration.
- admin: World administration, membership review and configuration, excluding ownership transfer unless explicitly delegated.
- editor: permitted football content operations.
- member: normal approved participant access.
- viewer: read-only World access.

Permission checks must be capability-based in the backend where practical. Avoid scattered string checks across route handlers.

Platform administration is separate from the World role system.

## Player identity

User is the global account record. Player remains the football identity inside one World.

WorldMembership.playerProfileId links the account to its Player profile in that World. It may be null where the person is a member but has not claimed/linked a Player profile.

Existing Player records that have no linked account remain valid World players and must retain their references in match history.

## Join flow

1. Visitor browses public World information.
2. Authenticated user submits a join request.
3. Backend creates or reuses a pending membership record.
4. Owner/admin reviews the request.
5. Approval changes status to active and records approvedBy/approvedAt.
6. Rejection records decision metadata and denies World access.

A join request is not an active membership.

## World context

A World-scoped request sends the selected World slug in the agreed request context header. Backend resolves the World and then looks up the authenticated user's membership.

The server populates trusted request context:
- req.world
- req.worldId
- req.membership

Never trust a user-supplied role, membership status, playerProfileId or worldId.

Public discovery and join-request creation are explicit global/public routes. Internal World APIs require active membership.

## Implemented API flow

The initial route contract is:
- `GET /api/worlds/map`
- `GET /api/worlds/:slug`
- `GET /api/worlds/me`
- `GET /api/worlds/:slug/membership`
- `POST /api/worlds`
- `POST /api/worlds/:slug/join-requests`
- `GET /api/worlds/:slug/join-requests`
- `POST /api/worlds/:slug/join-requests/:membershipId/approve`
- `POST /api/worlds/:slug/join-requests/:membershipId/reject`

The Global Map projection intentionally excludes viewer-specific membership fields. The signed-in user's membership state is obtained through their own membership endpoints.

Membership decisions use a compare-and-set style filter containing the request ID, resolved World ID and pending status. A request from another World cannot be approved/rejected by changing its ID in the URL.

## Account lifecycle

Leaving or suspending a World must not delete the global account, Player history or World records. Deletion/anonymisation policies will be designed separately and must respect match and financial audit history.
