import WorldMembership from "../models/WorldMembership.js";
import { getPrimaryWorld, getPrimaryWorldSlug } from "../services/primaryWorld.js";
import { isPlatformAdministrator } from "../services/worldAccess.js";

function worldSlugFromRequest(req) {
  return String(
    req.params?.slug ||
    req.get?.("x-world-slug") ||
    req.headers?.["x-world-slug"] ||
    getPrimaryWorldSlug()
  ).trim().toLowerCase();
}

/** Resolve the one canonical World; a slug/header is a selector, never proof. */
export async function resolveWorldContext(req, res, next) {
  try {
    const slug = worldSlugFromRequest(req);
    const primarySlug = getPrimaryWorldSlug();
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return res.status(400).json({
        message: "A valid World context is required.",
        code: "WORLD_CONTEXT_REQUIRED",
        requestId: req.requestId || null,
      });
    }
    if (slug !== primarySlug) {
      return res.status(404).json({
        message: "World not found.",
        code: "WORLD_NOT_FOUND",
        requestId: req.requestId || null,
      });
    }

    const world = await getPrimaryWorld();
    let membership = null;
    if (req.user?._id && req.firebaseUser?.testOnly === true && process.env.NODE_ENV !== "production") {
      // The synthetic test identity exists only behind the non-production,
      // secret-gated E2E authentication middleware.
      const requestedWorldRole = String(req.headers?.["x-e2e-test-world-role"] || "");
      const fallbackWorldRole = req.user.role === "admin"
        ? "owner"
        : req.user.role === "editor"
          ? "editor"
          : "viewer";
      const role = ["owner", "admin", "editor", "member", "viewer"].includes(requestedWorldRole)
        ? requestedWorldRole
        : fallbackWorldRole;
      membership = { worldId: world._id, userId: req.user._id, role, status: "active" };
    } else if (req.user?._id && isPlatformAdministrator(req.user, req.firebaseUser)) {
      membership = await WorldMembership.findOne({
        worldId: world._id,
        userId: req.user._id,
      });
      // Preserve the original activation timestamp and avoid a write on every
      // API request. Repair/ensure the admin owner membership only when needed.
      if (!membership || membership.status !== "active" || membership.role !== "owner") {
        membership = await WorldMembership.findOneAndUpdate(
          { worldId: world._id, userId: req.user._id },
          {
            $set: {
              role: "owner",
              status: "active",
              approvedAt: membership?.approvedAt || new Date(),
              approvedBy: null,
              rejectedAt: null,
              rejectedBy: null,
              decisionNote: "",
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
        );
      }
    } else if (req.user?._id) {
      membership = await WorldMembership.findOne({
        worldId: world._id,
        userId: req.user._id,
      });
    }

    req.world = world;
    // The non-production, secret-gated E2E identity runs against legacy
    // null-world fixtures. It cannot run in production and never selects a
    // real World tenant; production accounts always receive the canonical ID.
    req.worldId = req.firebaseUser?.testOnly === true && process.env.NODE_ENV !== "production"
      ? null
      : world._id;
    req.membership = membership || null;
    return next();
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    console.error(JSON.stringify({
      event: "primary_world_context_resolution_failed",
      requestId: req.requestId || null,
      errorName: error?.name || "Error",
      code: error?.code || null,
    }));
    return res.status(status).json({
      message: error?.publicMessage || "Could not resolve the GG football World.",
      code: error?.code || "WORLD_CONTEXT_ERROR",
      requestId: req.requestId || null,
    });
  }
}
