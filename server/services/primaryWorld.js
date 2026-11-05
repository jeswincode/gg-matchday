import World from "../models/World.js";
import User from "../models/User.js";
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

/**
 * Idempotently bootstrap the one canonical World after the Core database is
 * connected. It never adopts another active World or creates a guessed owner:
 * the configured, existing platform-admin account must already be present.
 */
export async function ensurePrimaryWorldExists() {
  const slug = getPrimaryWorldSlug();
  await World.init();
  const existing = await World.findOne({ slug });
  if (existing) {
    if (existing.status !== "active") {
      throw new Error("The configured Original GG World exists but is not active; resolve its status explicitly.");
    }
    return existing;
  }

  const otherActiveWorld = await World.findOne({ status: "active" }).select("_id name slug").lean();
  if (otherActiveWorld) {
    throw new Error("An active World already exists with a different slug; refusing to create a second World.");
  }

  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL must identify the existing GG platform administrator before the primary World can be initialized.");
  }
  const owner = await User.findOne({ email: adminEmail }).select("_id email role").lean();
  if (!owner || String(owner.email || "").trim().toLowerCase() !== adminEmail || owner.role !== "admin") {
    throw new Error("The configured platform administrator account was not found; refusing to create an ownerless World.");
  }

  try {
    return await World.create({
      name: "Original GG",
      slug,
      ownerUserId: owner._id,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const winner = await World.findOne({ slug });
    if (winner?.status === "active") return winner;
    throw error;
  }
}

/** Resolve the configured active World. */
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
