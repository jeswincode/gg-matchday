import mongoose from "mongoose";
import World from "../models/World.js";
import WorldMembership from "../models/WorldMembership.js";
import WorldMapLayout from "../models/WorldMapLayout.js";
import WorldMapFacility from "../models/WorldMapFacility.js";

export const GLOBAL_MAP_ID = "gg-main-v1";
export const WORLD_MAP_GRID_WIDTH = 60;
export const WORLD_MAP_GRID_HEIGHT = 60;
export const GLOBAL_KINGDOM_COLUMNS = 25;
export const GLOBAL_KINGDOM_SPACING = 8;
export const GLOBAL_KINGDOM_SPACING = 8;

export const DEFAULT_WORLD_FACILITIES = Object.freeze([
  { facilityKey: "central-stadium", type: "central_stadium", column: 25, row: 25, width: 8, height: 6 },
  { facilityKey: "club-district", type: "club_district", column: 37, row: 24, width: 9, height: 9 },
  { facilityKey: "construction-grounds", type: "construction_grounds", column: 10, row: 25, width: 8, height: 7 },
  { facilityKey: "captains-arena", type: "captains_arena", column: 25, row: 10, width: 8, height: 6 },
  { facilityKey: "training-grounds", type: "training_grounds", column: 37, row: 10, width: 9, height: 8 },
  { facilityKey: "community-hall", type: "community_hall", column: 10, row: 10, width: 8, height: 6 },
  { facilityKey: "hall-of-fame", type: "hall_of_fame", column: 25, row: 40, width: 8, height: 6 },
  { facilityKey: "administration", type: "administration", column: 39, row: 41, width: 7, height: 6 },
]);

export function globalPositionAt(index, spacing = GLOBAL_KINGDOM_SPACING) {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new TypeError("Global position index must be a non-negative integer.");
  }
  if (!Number.isSafeInteger(spacing) || spacing < 1) {
    throw new TypeError("Global position spacing must be a positive integer.");
  }

  let x = 0;
  let y = 0;
  let dx = 0;
  let dy = -1;

  for (let step = 0; step <= index; step += 1) {
    if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
      [dx, dy] = [-dy, dx];
    }
    if (step === index) {
      return { x: x * spacing, y: y * spacing };
    }
    x += dx;
    y += dy;
  }

  throw new RangeError("Could not calculate Global Map position.");
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

export function slugFromWorldName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

async function nextGlobalPosition(session) {
  const existing = await World.find({
    status: "active",
    "globalMap.mapId": GLOBAL_MAP_ID,
    "globalMap.x": { $type: "number" },
    "globalMap.y": { $type: "number" },
  })
    .select("globalMap.x globalMap.y")
    .session(session)
    .lean();

  const occupied = new Set(
    existing.map(world => String(world.globalMap.x) + ":" + String(world.globalMap.y)),
  );

  // Logical coordinates grow as a deterministic square spiral. This keeps
  // successive kingdoms close together and the map footprint roughly balanced.
  for (let index = 0; index < 250000; index += 1) {
    const position = globalPositionAt(index);
    if (!occupied.has(String(position.x) + ":" + String(position.y))) {
      return { mapId: GLOBAL_MAP_ID, ...position };
    }
  }

  throw httpError(503, "GLOBAL_MAP_FULL", "GG could not allocate a Global Map position.");
}

function isGlobalMapPositionConflict(error) {
  if (error?.code !== 11000) return false;
  const keyPattern = error.keyPattern || {};
  const keyValue = error.keyValue || {};
  return Boolean(
    keyPattern["globalMap.x"] ||
    keyValue["globalMap.x"] !== undefined ||
    String(error.message || "").includes("world_global_map_position_unique"),
  );
}

function isSlugConflict(error) {
  if (error?.code !== 11000) return false;
  const keyPattern = error.keyPattern || {};
  const keyValue = error.keyValue || {};
  return Boolean(
    keyPattern.slug ||
    keyValue.slug !== undefined ||
    String(error.message || "").includes("world_slug_unique"),
  );
}

export async function createWorldForUser({
  user,
  name,
  slug,
  description = "",
}) {
  if (!user?._id) throw httpError(401, "AUTHENTICATION_REQUIRED", "Authentication required.");

  const normalizedName = String(name || "").trim();
  if (normalizedName.length < 2 || normalizedName.length > 80) {
    throw httpError(400, "WORLD_NAME_INVALID", "World name must contain between 2 and 80 characters.");
  }

  const normalizedSlug = slugFromWorldName(slug || normalizedName);
  if (normalizedSlug.length < 3 || normalizedSlug.length > 48) {
    throw httpError(400, "WORLD_SLUG_INVALID", "World slug must contain between 3 and 48 valid characters.");
  }

  const normalizedDescription = String(description || "").trim();
  if (normalizedDescription.length > 1000) {
    throw httpError(400, "WORLD_DESCRIPTION_INVALID", "World description cannot exceed 1000 characters.");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await mongoose.startSession();
    let createdWorld = null;
    try {
      await session.withTransaction(async () => {
        const globalMap = await nextGlobalPosition(session);
        const [world] = await World.create([{
          name: normalizedName,
          slug: normalizedSlug,
          description: normalizedDescription,
          ownerUserId: user._id,
          visibility: "public",
          joinPolicy: "approval",
          status: "active",
          globalMap,
          settings: {
            timezone: "Asia/Kolkata",
            clubsEnabled: true,
            trainingEnabled: true,
          },
        }], { session, ordered: true });

        const now = new Date();
        await WorldMembership.create([{
          worldId: world._id,
          userId: user._id,
          role: "owner",
          status: "active",
          requestedAt: now,
          approvedAt: now,
          approvedBy: null,
        }], { session, ordered: true });

        await WorldMapLayout.create([{
          worldId: world._id,
          projection: "isometric",
          theme: "woodland",
          seed: Math.floor(Math.random() * 2147483647),
          gridWidth: WORLD_MAP_GRID_WIDTH,
          gridHeight: WORLD_MAP_GRID_HEIGHT,
          layoutVersion: 1,
          updatedBy: user._id,
        }], { session, ordered: true });

        await WorldMapFacility.create(
          DEFAULT_WORLD_FACILITIES.map(facility => ({
            worldId: world._id,
            facilityKey: facility.facilityKey,
            type: facility.type,
            position: { column: facility.column, row: facility.row },
            footprint: { width: facility.width, height: facility.height },
            rotation: 0,
            level: 1,
            appearanceKey: "default",
            status: "active",
            placementManagedBy: "system",
            updatedBy: user._id,
          })),
          { session, ordered: true },
        );

        createdWorld = world;
      });

      return createdWorld;
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        const diagnostic = String(error?.message || "Unknown World creation failure")
          .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[redacted-connection]")
          .replace(/[\r\n]+/g, " ")
          .slice(0, 240);
        console.error(JSON.stringify({
          event: "world_creation_diagnostic",
          errorName: error?.name || "Error",
          errorCode: error?.code ?? null,
          message: diagnostic,
        }));
      }
      if (isSlugConflict(error)) {
        throw httpError(409, "WORLD_SLUG_TAKEN", "That World slug is already in use.");
      }
      if (isGlobalMapPositionConflict(error) && attempt < 2) continue;
      if (
        error?.code === 20 ||
        String(error?.message || "").toLowerCase().includes("transaction numbers are only allowed")
      ) {
        throw httpError(
          503,
          "WORLD_CREATION_REQUIRES_TRANSACTIONS",
          "World creation requires a transaction-capable MongoDB deployment.",
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  throw httpError(503, "GLOBAL_MAP_ALLOCATION_CONFLICT", "GG could not reserve a Global Map position. Please retry.");
}
