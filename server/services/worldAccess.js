export const WORLD_ROLE_CAPABILITIES = Object.freeze({
  owner: Object.freeze([
    "world:read",
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
    "football:record",
    "football:edit",
    "training:write-own",
    "training:read-shared",
  ]),
  member: Object.freeze([
    "world:read",
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

export function isPlatformAdministrator(user) {
  // Platform authority is deliberately distinct from legacy User.role and
  // WorldMembership.role. The platformRole field is introduced separately.
  return Boolean(user && user.platformRole === "platform_admin");
}
