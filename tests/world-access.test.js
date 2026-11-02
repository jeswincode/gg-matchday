import test from "node:test";
import assert from "node:assert/strict";

import World from "../server/models/World.js";
import WorldMembership from "../server/models/WorldMembership.js";
import WorldAccessGrant from "../server/models/WorldAccessGrant.js";
import {
  hasWorldCapability,
  isActiveWorldMembership,
  isPlatformAdministrator,
  isValidWorldSlug,
  normalizeWorldSlug,
} from "../server/services/worldAccess.js";
import { resolveWorldContext } from "../server/middleware/worldContext.js";
import {
  requireActiveWorldMembership,
  requirePlatformAdmin,
  requireWorldCapability,
  requireWorldRole,
} from "../server/middleware/worldPermissions.js";

process.env.GG_PRIMARY_WORLD_SLUG = "original-gg";
process.env.ADMIN_EMAIL = "admin@gmail.com";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("World slug normalization is deterministic and rejects unsafe values", () => {
  assert.equal(normalizeWorldSlug("  Original-GG "), "original-gg");
  assert.equal(isValidWorldSlug("original-gg"), true);
  assert.equal(isValidWorldSlug(" Original-GG "), true);
  assert.equal(isValidWorldSlug("a"), false);
  assert.equal(isValidWorldSlug("bad slug"), false);
  assert.equal(isValidWorldSlug("world/../../admin"), false);
});

test("World capabilities distinguish owner, editor, member and viewer", () => {
  assert.equal(hasWorldCapability("owner", "world:manage"), true);
  assert.equal(hasWorldCapability("admin", "membership:review"), true);
  assert.equal(hasWorldCapability("editor", "football:record"), true);
  assert.equal(hasWorldCapability("editor", "map:edit"), false);
  assert.equal(hasWorldCapability("member", "training:write-own"), true);
  assert.equal(hasWorldCapability("member", "training:organise"), false);
  assert.equal(hasWorldCapability("viewer", "world:read"), true);
  assert.equal(hasWorldCapability("viewer", "football:record"), false);
  assert.equal(hasWorldCapability("platform_admin", "world:manage"), false);
});

test("only active memberships grant access", () => {
  assert.equal(isActiveWorldMembership({ status: "active" }), true);
  for (const status of ["pending", "rejected", "suspended", "left", undefined]) {
    assert.equal(isActiveWorldMembership(status ? { status } : null), false);
  }
});

test("platform administrator requires the configured verified Firebase identity and platform role", () => {
  const user = { firebaseUid: "firebase-admin", email: "admin@gmail.com", platformRole: "platform_admin" };
  assert.equal(isPlatformAdministrator({ role: "admin" }), false);
  assert.equal(isPlatformAdministrator({ ...user, platformRole: "user" }, { uid: "firebase-admin", email: "admin@gmail.com", email_verified: true }), false);
  assert.equal(isPlatformAdministrator(user, { uid: "firebase-admin", email: "admin@gmail.com", email_verified: false }), false);
  assert.equal(isPlatformAdministrator(user, { uid: "other-uid", email: "admin@gmail.com", email_verified: true }), false);
  assert.equal(isPlatformAdministrator(user, { uid: "firebase-admin", email: "wrong@gmail.com", email_verified: true }), false);
  assert.equal(isPlatformAdministrator(user, { uid: "firebase-admin", email: "admin@gmail.com", email_verified: true }), true);
});

test("resolveWorldContext normalizes slug and attaches World plus membership", async () => {
  const originalFindWorld = World.findOne;
  const originalFindMembership = WorldMembership.findOne;
  const world = { _id: "world-1", slug: "original-gg" };
  const membership = { worldId: "world-1", userId: "user-1", status: "active" };
  let worldFilter;
  let membershipFilter;

  World.findOne = async filter => {
    worldFilter = filter;
    return world;
  };
  WorldMembership.findOne = async filter => {
    membershipFilter = filter;
    return membership;
  };

  try {
    const req = {
      headers: { "x-world-slug": " Original-GG " },
      user: { _id: "user-1" },
      requestId: "request-1",
    };
    const res = responseRecorder();
    let nextCalled = false;

    await resolveWorldContext(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.world, world);
    assert.equal(req.worldId, world._id);
    assert.equal(req.membership, membership);
    assert.deepEqual(worldFilter, { slug: "original-gg", status: "active" });
    assert.deepEqual(membershipFilter, { worldId: world._id, userId: "user-1" });
    assert.equal(res.statusCode, 200);
  } finally {
    World.findOne = originalFindWorld;
    WorldMembership.findOne = originalFindMembership;
  }
});

test("resolveWorldContext rejects a missing or malformed selector before database lookup", async () => {
  const req = { headers: { "x-world-slug": "../private" }, requestId: "request-2" };
  const res = responseRecorder();
  let nextCalled = false;

  await resolveWorldContext(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "WORLD_CONTEXT_REQUIRED");
});

test("resolveWorldContext permits public preview without assigning membership", async () => {
  const originalFindWorld = World.findOne;
  const originalFindMembership = WorldMembership.findOne;
  const world = { _id: "world-public", slug: "original-gg" };
  World.findOne = async () => world;
  WorldMembership.findOne = async () => {
    throw new Error("Unauthenticated public preview must not query memberships.");
  };

  try {
    const req = { headers: { "x-world-slug": "original-gg" } };
    const res = responseRecorder();
    let nextCalled = false;

    await resolveWorldContext(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.world, world);
    assert.equal(req.membership, null);
  } finally {
    World.findOne = originalFindWorld;
    WorldMembership.findOne = originalFindMembership;
  }
});

test("active membership also requires an exact active Gmail grant", async () => {
  const originalExists = WorldAccessGrant.exists;
  WorldAccessGrant.exists = async () => ({ _id: "grant-1" });
  try {
    const req = {
      user: { _id: "user-1", firebaseUid: "uid-1", email: "member@gmail.com" },
      firebaseUser: { uid: "uid-1", email: "member@gmail.com", email_verified: true },
      world: { _id: "world-1" },
      membership: { status: "pending" },
    };
    const pendingRes = responseRecorder();
    let nextCalled = false;
    await requireActiveWorldMembership(req, pendingRes, () => { nextCalled = true; });
    assert.equal(pendingRes.statusCode, 403);
    assert.equal(pendingRes.body.code, "WORLD_MEMBERSHIP_PENDING");
    assert.equal(nextCalled, false);

    req.membership = { status: "active" };
    const activeRes = responseRecorder();
    await requireActiveWorldMembership(req, activeRes, () => { nextCalled = true; });
    assert.equal(activeRes.statusCode, 200);
    assert.equal(nextCalled, true);

    WorldAccessGrant.exists = async () => null;
    const missingGrantRes = responseRecorder();
    nextCalled = false;
    await requireActiveWorldMembership(req, missingGrantRes, () => { nextCalled = true; });
    assert.equal(missingGrantRes.statusCode, 403);
    assert.equal(missingGrantRes.body.code, "WORLD_ACCESS_GRANT_REQUIRED");
    assert.equal(nextCalled, false);
  } finally {
    WorldAccessGrant.exists = originalExists;
  }
});

test("capability middleware enforces grant-backed membership and role capabilities", async () => {
  const originalExists = WorldAccessGrant.exists;
  WorldAccessGrant.exists = async () => ({ _id: "grant-1" });
  try {
    const req = {
      user: { _id: "user-1", firebaseUid: "uid-1", email: "member@gmail.com" },
      firebaseUser: { uid: "uid-1", email: "member@gmail.com", email_verified: true },
      world: { _id: "world-1" },
      membership: { status: "active", role: "member" },
    };
    const res = responseRecorder();
    let nextCalled = false;

    await requireWorldCapability("map:edit")(req, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, "WORLD_CAPABILITY_REQUIRED");
    assert.equal(nextCalled, false);

    const memberRes = responseRecorder();
    await requireWorldCapability("training:write-own")(req, memberRes, () => { nextCalled = true; });
    assert.equal(memberRes.statusCode, 200);
    assert.equal(nextCalled, true);
  } finally {
    WorldAccessGrant.exists = originalExists;
  }
});

test("legacy admin role does not bypass World roles; platform admin requires verified identity", async () => {
  const originalExists = WorldAccessGrant.exists;
  WorldAccessGrant.exists = async () => ({ _id: "grant-1" });
  try {
    const req = {
      user: { _id: "user-1", firebaseUid: "uid-1", email: "member@gmail.com", role: "admin", platformRole: "user" },
      firebaseUser: { uid: "uid-1", email: "member@gmail.com", email_verified: true },
      world: { _id: "world-1" },
      membership: { status: "active", role: "member" },
    };
    const roleRes = responseRecorder();
    let nextCalled = false;
    await requireWorldRole("owner", "admin")(req, roleRes, () => { nextCalled = true; });
    assert.equal(roleRes.statusCode, 403);
    assert.equal(roleRes.body.code, "WORLD_ROLE_REQUIRED");
    assert.equal(nextCalled, false);

    const platformRes = responseRecorder();
    requirePlatformAdmin(req, platformRes, () => { nextCalled = true; });
    assert.equal(platformRes.statusCode, 403);
    assert.equal(platformRes.body.code, "PLATFORM_ADMIN_REQUIRED");

    req.user = { firebaseUid: "uid-admin", email: "admin@gmail.com", platformRole: "platform_admin" };
    req.firebaseUser = { uid: "uid-admin", email: "admin@gmail.com", email_verified: true };
    const allowed = responseRecorder();
    requirePlatformAdmin(req, allowed, () => { nextCalled = true; });
    assert.equal(allowed.statusCode, 200);
    assert.equal(nextCalled, true);
  } finally {
    WorldAccessGrant.exists = originalExists;
  }
});
