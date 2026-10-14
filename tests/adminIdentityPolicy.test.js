import test from "node:test";
import assert from "node:assert/strict";
import {
  hasAdminRoleAuthority,
  isVerifiedConfiguredAdminEmail,
} from "../server/services/adminIdentityPolicy.js";

test("configured admin promotion requires a verified matching email", () => {
  assert.equal(
    isVerifiedConfiguredAdminEmail("Admin@Example.com", true, "admin@example.com"),
    true,
  );
  assert.equal(
    isVerifiedConfiguredAdminEmail("admin@example.com", false, "admin@example.com"),
    false,
  );
  assert.equal(
    isVerifiedConfiguredAdminEmail("admin@example.com", undefined, "admin@example.com"),
    false,
  );
});

test("configured admin identity policy fails closed for empty or mismatched email", () => {
  assert.equal(isVerifiedConfiguredAdminEmail("", true, "admin@example.com"), false);
  assert.equal(isVerifiedConfiguredAdminEmail("admin@example.com", true, ""), false);
  assert.equal(isVerifiedConfiguredAdminEmail("other@example.com", true, "admin@example.com"), false);
  assert.equal(isVerifiedConfiguredAdminEmail(" admin@example.com ", true, "ADMIN@example.com"), true);
});

test("admin authorization requires the Firebase email_verified claim", () => {
  assert.equal(hasAdminRoleAuthority({ role: "admin", emailVerified: true }), true);
  assert.equal(hasAdminRoleAuthority({ role: "admin", emailVerified: false }), false);
  assert.equal(hasAdminRoleAuthority({ role: "admin" }), false);
  assert.equal(hasAdminRoleAuthority({ role: "editor", emailVerified: true }), false);
  assert.equal(hasAdminRoleAuthority({ role: "viewer", emailVerified: true }), false);
});

test("the non-production E2E admin identity exception cannot work in production", () => {
  assert.equal(hasAdminRoleAuthority({
    role: "admin",
    testOnly: true,
    environment: "test",
  }), true);
  assert.equal(hasAdminRoleAuthority({
    role: "admin",
    testOnly: true,
    environment: "development",
  }), true);
  assert.equal(hasAdminRoleAuthority({
    role: "admin",
    testOnly: true,
    environment: "production",
  }), false);
  assert.equal(hasAdminRoleAuthority({
    role: "admin",
    testOnly: false,
    emailVerified: true,
    environment: "production",
  }), true);
});
