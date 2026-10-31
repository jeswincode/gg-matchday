import World from "../models/World.js";
import WorldMembership from "../models/WorldMembership.js";
import { isValidWorldSlug, normalizeWorldSlug } from "../services/worldAccess.js";

function worldSlugFromRequest(req) {
  // Path-based World routes use their :slug parameter. Existing World-scoped
  // domain routes use X-World-Slug. A client cannot select a membership role
  // or World ID through either mechanism.
  return normalizeWorldSlug(
    req.params?.slug || req.get?.("x-world-slug") || req.headers?.["x-world-slug"] || "",
  );
}

/**
 * Resolve the requested World and optional membership.
 *
 * Run after requireAuth for protected requests. Public World preview routes may
 * use it without authentication; those requests receive req.membership = null.
 * A resolved World is not proof of access: internal routes must additionally
 * use requireActiveWorldMembership or requireWorldCapability.
 */
export async function resolveWorldContext(req, res, next) {
  try {
    const slug = worldSlugFromRequest(req);
    if (!isValidWorldSlug(slug)) {
      return res.status(400).json({
        message: "A valid World context is required.",
        code: "WORLD_CONTEXT_REQUIRED",
        requestId: req.requestId || null,
      });
    }

    const world = await World.findOne({
      slug,
      status: "active",
    });

    if (!world) {
      return res.status(404).json({
        message: "World not found.",
        code: "WORLD_NOT_FOUND",
        requestId: req.requestId || null,
      });
    }

    const membership = req.user
      ? await WorldMembership.findOne({
        worldId: world._id,
        userId: req.user._id,
      })
      : null;

    req.world = world;
    req.worldId = world._id;
    req.membership = membership || null;
    return next();
  } catch (error) {
    console.error(JSON.stringify({
      event: "world_context_resolution_failed",
      requestId: req.requestId || null,
      errorName: error?.name || "Error",
    }));

    return res.status(500).json({
      message: "Could not resolve World context.",
      code: "WORLD_CONTEXT_ERROR",
      requestId: req.requestId || null,
    });
  }
}
