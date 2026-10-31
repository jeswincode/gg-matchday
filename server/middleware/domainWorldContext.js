import { requireAuth } from "./auth.js";
import { resolveWorldContext } from "./worldContext.js";
import { requireActiveWorldMembership, requireWorldCapability } from "./worldPermissions.js";

/**
 * Legacy records have no worldId until the Original GG migration is approved.
 * A request with an explicit World selector must prove active membership.
 * Without a selector, domain queries must filter to null/missing worldId only.
 */
export function requireOptionalWorldMembership(req, res, next) {
  const slug = String(req.get?.("x-world-slug") || req.headers?.["x-world-slug"] || "").trim();
  if (!slug) {
    req.world = null;
    req.worldId = null;
    req.membership = null;
    return next();
  }

  return requireAuth(req, res, () =>
    resolveWorldContext(req, res, () =>
      requireActiveWorldMembership(req, res, next),
    ),
  );
}

export function domainWorldFilter(req) {
  return { worldId: req.worldId || null };
}

/**
 * In a selected World, WorldMembership capabilities decide authority.
 * Unscoped legacy requests retain the existing global editor/admin policy
 * until the Original GG role migration is completed.
 */
export function requireDomainCapability(capability, legacyMiddleware) {
  const worldGuard = requireWorldCapability(capability);
  return (req, res, next) => {
    if (req.worldId) return worldGuard(req, res, next);
    return legacyMiddleware(req, res, next);
  };
}
