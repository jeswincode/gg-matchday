import test from "node:test";
import assert from "node:assert/strict";

import {
  getActiveWorldSlug,
  isValidWorldSlug,
  normalizeWorldSlug,
  setActiveWorldSlug,
  worldContextHeaders,
} from "../src/lib/worldContext.js";
import User from "../server/models/User.js";

test("frontend World context normalizes and validates selected slugs", () => {
  assert.equal(normalizeWorldSlug(" Original-GG "), "original-gg");
  assert.equal(isValidWorldSlug("original-gg"), true);
  assert.equal(isValidWorldSlug("bad slug"), false);
  assert.equal(isValidWorldSlug("../admin"), false);
});

test("frontend World context can be set and cleared", () => {
  assert.equal(setActiveWorldSlug(" Original-GG "), "original-gg");
  assert.equal(getActiveWorldSlug(), "original-gg");
  assert.deepEqual(worldContextHeaders(), { "X-World-Slug": "original-gg" });
  assert.equal(setActiveWorldSlug(null), null);
  assert.equal(getActiveWorldSlug(), null);
  assert.deepEqual(worldContextHeaders(), {});
});

test("frontend World context rejects malformed non-empty slugs", () => {
  assert.throws(() => setActiveWorldSlug("not a slug"), /valid World slug/);
  assert.equal(getActiveWorldSlug(), null);
});

test("User schema separates platform role from the legacy group-wide role", () => {
  const user = new User({
    firebaseUid: "firebase-user",
    name: "Test User",
    email: "test@example.invalid",
    role: "admin",
  });

  assert.equal(user.role, "admin");
  assert.equal(user.platformRole, "user");
  assert.deepEqual(User.schema.path("platformRole").enumValues, ["user", "platform_admin"]);
});
