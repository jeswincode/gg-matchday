import {
  hasWorldCapability,
  isActiveWorldMembership,
  isPlatformAdministrator,
} from "../services/worldAccess.js";
import { hasActiveWorldAccessGrant } from "../services/worldAccessGrants.js";

function unauthorized(res, req) {
  return res.status(401).json({
    message: "Authentication required.",
    code: "AUTHENTICATION_REQUIRED",
    requestId: req.requestId || null,
  });
}

function membershipDenied(res, req) {
  const status = req.membership?.status || "none";
  const code = status === "pending" ? "WORLD_MEMBERSHIP_PENDING"
    : status === "suspended" ? "WORLD_MEMBERSHIP_SUSPENDED"
      : "WORLD_MEMBERSHIP_REQUIRED";
  return res.status(403).json({
    message: "Active membership in the GG football World is required.",
    code,
    requestId: req.requestId || null,
  });
}

function grantDenied(res, req) {
  return res.status(403).json({
    message: "This Gmail account has not been linked by the GG platform administrator.",
    code: "WORLD_ACCESS_GRANT_REQUIRED",
    requestId: req.requestId || null,
  });
}

export async function requireActiveWorldMembership(req, res, next) {
  if (!req.user) return unauthorized(res, req);
  if (!req.world) return membershipDenied(res, req);

  // E2E auth is secret-gated and unavailable in production.
  if (req.firebaseUser?.testOnly === true && process.env.NODE_ENV === "test") return next();
  if (isPlatformAdministrator(req.user, req.firebaseUser)) return next();

  if (!isActiveWorldMembership(req.membership)) return membershipDenied(res, req);
  try {
    const allowed = await hasActiveWorldAccessGrant({
      worldId: req.world._id,
      userId: req.user._id,
      email: req.firebaseUser?.email,
      emailVerified: req.firebaseUser?.email_verified,
    });
    if (!allowed) return grantDenied(res, req);
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireWorldCapability(capability) {
  if (typeof capability !== "string" || !capability.trim()) {
    throw new TypeError("A World capability name is required.");
  }
  return (req, res, next) => requireActiveWorldMembership(req, res, () => {
    if (!hasWorldCapability(req.membership?.role || "owner", capability)) {
      return res.status(403).json({
        message: "Your GG World role does not permit this operation.",
        code: "WORLD_CAPABILITY_REQUIRED",
        capability,
        requestId: req.requestId || null,
      });
    }
    return next();
  });
}

export function requireWorldRole(...roles) {
  const allowedRoles = new Set(roles.flat().filter(role => typeof role === "string"));
  if (allowedRoles.size === 0) throw new TypeError("At least one allowed World role is required.");
  return (req, res, next) => requireActiveWorldMembership(req, res, () => {
    if (!allowedRoles.has(req.membership?.role || "owner")) {
      return res.status(403).json({
        message: "Your GG World role does not permit this operation.",
        code: "WORLD_ROLE_REQUIRED",
        requestId: req.requestId || null,
      });
    }
    return next();
  });
}

export function requirePlatformAdmin(req, res, next) {
  if (!req.user) return unauthorized(res, req);
  const isolatedTestAdmin = req.firebaseUser?.testOnly === true &&
    process.env.NODE_ENV === "test" &&
    req.user.role === "admin";
  if (!isolatedTestAdmin && !isPlatformAdministrator(req.user, req.firebaseUser)) {
    return res.status(403).json({
      message: "GG platform administrator access required.",
      code: "PLATFORM_ADMIN_REQUIRED",
      requestId: req.requestId || null,
    });
  }
  return next();
}
