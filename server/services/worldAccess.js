import { isVerifiedConfiguredAdminEmail } from "./adminIdentityPolicy.js";

export const WORLD_ROLE_CAPABILITIES = Object.freeze({
  owner: Object.freeze([
    "world:read",
    "profile:manage-own",
    "chat:send",
    "football:dispute",
    "football:vote",
    "world:manage",
    "membership:review",
    "map:edit",
    "football:record",
    "football:edit",
    "clubs:manage",
    "clubs:participate",
    "training:organise",
    "training:write-own",
    "training:read-shared",
    "world:moderate",
  ]),
  admin: Object.freeze([
    "world:read",
    "profile:manage-own",
    "chat:send",
    "football:dispute",
    "football:vote",
    "world:manage",
    "membership:review",
    "map:edit",
    "football:record",
    "football:edit",
    "clubs:manage",
    "clubs:participate",
    "training:organise",
    "training:write-own",
    "training:read-shared",
    "world:moderate",
  ]),
  editor: Object.freeze([
    "world:read",
    "profile:manage-own",
    "chat:send",
    "football:dispute",
    "football:vote",
    "football:record",
    "football:edit",
    "clubs:participate",
    "training:write-own",
    "training:read-shared",
  ]),
  member: Object.freeze([
    "world:read",
    "profile:manage-own",
    "chat:send",
    "football:dispute",
    "football:vote",
    "clubs:participate",
    "training:write-own",
    "training:read-shared",
  ]),
  viewer: Object.freeze([
    "world:read",
  ]),
});

const WORLD_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeWorldSlug(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidWorldSlug(value) {
  const slug = normalizeWorldSlug(value);
  return slug.length >= 3 && slug.length <= 48 && WORLD_SLUG_PATTERN.test(slug);
}

export function hasWorldCapability(role, capability) {
  const capabilities = WORLD_ROLE_CAPABILITIES[role];
  return Boolean(capabilities?.includes(capability));
}

export function isActiveWorldMembership(membership) {
  return Boolean(membership && membership.status === "active");
}

export function isPlatformAdministrator(user, firebaseUser, configuredAdminEmail = process.env.ADMIN_EMAIL) {
  const currentEmail = String(firebaseUser?.email || "").trim().toLowerCase();
  const persistedEmail = String(user?.email || "").trim().toLowerCase();
  return Boolean(
    user?.platformRole === "platform_admin" &&
    user?.firebaseUid &&
    firebaseUser?.uid &&
    firebaseUser?.testOnly !== true &&
    String(user.firebaseUid) === String(firebaseUser.uid) &&
    currentEmail === persistedEmail &&
    isVerifiedConfiguredAdminEmail(currentEmail, firebaseUser?.email_verified, configuredAdminEmail)
  );
}
