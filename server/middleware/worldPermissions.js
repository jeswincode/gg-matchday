import {
  hasWorldCapability,
  isActiveWorldMembership,
  isPlatformAdministrator,
} from "../services/worldAccess.js";

function unauthorized(res, req) {
  return res.status(401).json({
    message: "Authentication required.",
    code: "AUTHENTICATION_REQUIRED",
    requestId: req.requestId || null,
  });
}

function membershipDenied(res, req) {
  const status = req.membership?.status || "none";
  const code = status === "pending"
    ? "WORLD_MEMBERSHIP_PENDING"
    : status === "suspended"
      ? "WORLD_MEMBERSHIP_SUSPENDED"
      : "WORLD_MEMBERSHIP_REQUIRED";

  return res.status(403).json({
    message: status === "pending"
      ? "Your request to join this World is awaiting approval."
      : "Active membership in this World is required.",
    code,
    requestId: req.requestId || null,
  });
}

export function requireActiveWorldMembership(req, res, next) {
  if (!req.user) return unauthorized(res, req);
  if (!req.world || !isActiveWorldMembership(req.membership)) {
    return membershipDenied(res, req);
  }
  return next();
}

export function requireWorldCapability(capability) {
  if (typeof capability !== "string" || !capability.trim()) {
    throw new TypeError("A World capability name is required.");
  }

  return (req, res, next) => {
    if (!req.user) return unauthorized(res, req);
    if (!req.world || !isActiveWorldMembership(req.membership)) {
      return membershipDenied(res, req);
    }
    if (!hasWorldCapability(req.membership.role, capability)) {
      return res.status(403).json({
        message: "Your World role does not permit this operation.",
        code: "WORLD_CAPABILITY_REQUIRED",
        capability,
        requestId: req.requestId || null,
      });
    }
    return next();
  };
}

export function requireWorldRole(...roles) {
  const allowedRoles = new Set(roles.flat().filter(role => typeof role === "string"));
  if (allowedRoles.size === 0) {
    throw new TypeError("At least one allowed World role is required.");
  }

  return (req, res, next) => {
    if (!req.user) return unauthorized(res, req);
    if (!req.world || !isActiveWorldMembership(req.membership)) {
      return membershipDenied(res, req);
    }
    if (!allowedRoles.has(req.membership.role)) {
      return res.status(403).json({
        message: "Your World role does not permit this operation.",
        code: "WORLD_ROLE_REQUIRED",
        requestId: req.requestId || null,
      });
    }
    return next();
  };
}

/**
 * Platform administration is intentionally independent from legacy User.role
 * and all World roles. This middleware remains deny-by-default until the
 * platformRole account field and its audited grant process are added.
 */
export function requirePlatformAdmin(req, res, next) {
  if (!req.user) return unauthorized(res, req);
  if (!isPlatformAdministrator(req.user)) {
    return res.status(403).json({
      message: "GG platform administrator access required.",
      code: "PLATFORM_ADMIN_REQUIRED",
      requestId: req.requestId || null,
    });
  }
  return next();
}
