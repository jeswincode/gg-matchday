import { requireAuth } from "./auth.js";
import { runWithWorldDataScope } from "../services/worldDataScope.js";
import { resolveWorldContext } from "./worldContext.js";
import { getPrimaryWorldSlug } from "../services/primaryWorld.js";
import { requireActiveWorldMembership, requireWorldCapability } from "./worldPermissions.js";

/**
 * Matchday and Clubs APIs always operate in the one canonical World. An absent
 * header defaults to that World; it never opts into unscoped legacy records.
 */
export function requireOptionalWorldMembership(req, res, next) {
  if ((req.worldId || req.firebaseUser?.testOnly === true) && req.world && req.membership) return next();

  const selected = String(
    req.get?.("x-world-slug") ||
    req.headers?.["x-world-slug"] ||
    getPrimaryWorldSlug()
  ).trim().toLowerCase();

  req.headers = req.headers || {};
  req.headers["x-world-slug"] = selected;
  return requireAuth(req, res, () =>
    resolveWorldContext(req, res, () =>
      requireActiveWorldMembership(req, res, next),
    ),
  );
}

export function domainWorldFilter(req) {
  return { worldId: req.worldId || null };
}

export function requireDomainCapability(capability) {
  return requireWorldCapability(capability);
}

export function withWorldDataScope(req, res, next) {
  if ((!req.worldId && req.firebaseUser?.testOnly !== true) || !req.world) {
    return res.status(403).json({
      message: "A canonical GG World context is required.",
      code: "WORLD_CONTEXT_REQUIRED",
      requestId: req.requestId || null,
    });
  }
  return runWithWorldDataScope(req.worldId || null, next);
}
