import World from "../models/World.js";
import { isValidWorldSlug, normalizeWorldSlug } from "./worldAccess.js";

export function getPrimaryWorldSlug() {
  const configured = normalizeWorldSlug(process.env.GG_PRIMARY_WORLD_SLUG);
  if (!configured && process.env.NODE_ENV === "production") {
    const error = new Error("GG_PRIMARY_WORLD_SLUG must be configured before private World access is enabled.");
    error.status = 503;
    error.code = "PRIMARY_WORLD_CONFIGURATION_REQUIRED";
    error.publicMessage = error.message;
    throw error;
  }
  const slug = configured || "original-gg";
  if (!isValidWorldSlug(slug)) {
    const error = new Error("GG_PRIMARY_WORLD_SLUG is invalid.");
    error.status = 503;
    error.code = "PRIMARY_WORLD_CONFIGURATION_INVALID";
    error.publicMessage = error.message;
    throw error;
  }
  return slug;
}

export function isPrimaryWorldSlug(value) {
  try {
    return normalizeWorldSlug(value) === getPrimaryWorldSlug();
  } catch {
    return false;
  }
}

/** Resolve the configured active World. This function never creates records. */
export async function getPrimaryWorld({ session = null } = {}) {
  const slug = getPrimaryWorldSlug();
  let query = World.findOne({ slug, status: "active" });
  if (session && typeof query?.session === "function") query = query.session(session);
  const world = await query;
  if (!world) {
    const error = new Error("The configured GG football World was not found. Verify GG_PRIMARY_WORLD_SLUG against existing World records.");
    error.status = 503;
    error.code = "PRIMARY_WORLD_NOT_FOUND";
    error.publicMessage = error.message;
    throw error;
  }
  return world;
}
