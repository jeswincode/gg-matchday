import mongoose from "mongoose";
import WorldMapLayout from "../models/WorldMapLayout.js";
import WorldMapFacility from "../models/WorldMapFacility.js";

function serviceError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function dimensionsFor(footprint, rotation) {
  const width = footprint?.width ?? 1;
  const height = footprint?.height ?? 1;
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

function overlaps(first, second) {
  const a = dimensionsFor(first.footprint, first.rotation || 0);
  const b = dimensionsFor(second.footprint, second.rotation || 0);
  return first.position.column < second.position.column + b.width &&
    first.position.column + a.width > second.position.column &&
    first.position.row < second.position.row + b.height &&
    first.position.row + a.height > second.position.row;
}

function assertPlacementWithinLayout({ position, footprint, rotation }, layout) {
  if (!Number.isSafeInteger(position?.column) || !Number.isSafeInteger(position?.row)) {
    throw serviceError(400, "FACILITY_POSITION_INVALID", "Facility position must use integer grid coordinates.");
  }

  const dimensions = dimensionsFor(footprint, rotation);
  if (
    position.column < 0 ||
    position.row < 0 ||
    position.column + dimensions.width > layout.gridWidth ||
    position.row + dimensions.height > layout.gridHeight
  ) {
    throw serviceError(400, "FACILITY_OUT_OF_BOUNDS", "Facility must remain inside the World map grid.");
  }
}

export async function getWorldMapSnapshot(worldId) {
  const [layout, facilities] = await Promise.all([
    WorldMapLayout.findOne({ worldId }).lean(),
    WorldMapFacility.find({ worldId })
      .select("facilityKey type position footprint rotation level appearanceKey status placementManagedBy")
      .sort({ type: 1, facilityKey: 1 })
      .lean(),
  ]);

  if (!layout) {
    throw serviceError(404, "WORLD_MAP_NOT_INITIALIZED", "This World map has not been initialized.");
  }

  return {
    layout: {
      projection: layout.projection,
      theme: layout.theme,
      seed: layout.seed,
      gridWidth: layout.gridWidth,
      gridHeight: layout.gridHeight,
      layoutVersion: layout.layoutVersion,
    },
    facilities: facilities.map(facility => ({
      id: String(facility._id),
      facilityKey: facility.facilityKey,
      type: facility.type,
      position: facility.position,
      footprint: facility.footprint,
      rotation: facility.rotation,
      level: facility.level,
      appearanceKey: facility.appearanceKey,
      status: facility.status,
      placementManagedBy: facility.placementManagedBy,
    })),
  };
}

export async function moveWorldMapFacility({
  worldId,
  userId,
  facilityKey,
  expectedLayoutVersion,
  position,
  rotation,
  appearanceKey,
}) {
  if (!Number.isSafeInteger(expectedLayoutVersion) || expectedLayoutVersion < 1) {
    throw serviceError(400, "LAYOUT_VERSION_REQUIRED", "A valid expectedLayoutVersion is required.");
  }

  if (
    !position ||
    Object.keys(position).some(key => !["column", "row"].includes(key)) ||
    Object.keys(position).length !== 2
  ) {
    throw serviceError(400, "FACILITY_POSITION_INVALID", "Facility position must contain only column and row.");
  }

  if (rotation !== undefined && ![0, 90, 180, 270].includes(rotation)) {
    throw serviceError(400, "FACILITY_ROTATION_INVALID", "Facility rotation must be 0, 90, 180 or 270 degrees.");
  }

  if (
    appearanceKey !== undefined &&
    (typeof appearanceKey !== "string" || !/^[a-z0-9_-]{1,64}$/i.test(appearanceKey))
  ) {
    throw serviceError(400, "FACILITY_APPEARANCE_INVALID", "Facility appearance key is invalid.");
  }

  const session = await mongoose.startSession();
  let updatedFacility = null;
  let updatedVersion = null;

  try {
    await session.withTransaction(async () => {
      const layout = await WorldMapLayout.findOne({ worldId }).session(session);
      if (!layout) {
        throw serviceError(404, "WORLD_MAP_NOT_INITIALIZED", "This World map has not been initialized.");
      }
      if (layout.layoutVersion !== expectedLayoutVersion) {
        throw serviceError(409, "WORLD_MAP_VERSION_CONFLICT", "The World map changed. Refresh before editing again.");
      }

      const facility = await WorldMapFacility.findOne({ worldId, facilityKey }).session(session);
      if (!facility) {
        throw serviceError(404, "WORLD_MAP_FACILITY_NOT_FOUND", "Map facility not found.");
      }

      const nextRotation = rotation ?? facility.rotation;
      const nextPlacement = {
        position,
        footprint: facility.footprint,
        rotation: nextRotation,
      };
      assertPlacementWithinLayout(nextPlacement, layout);

      const others = await WorldMapFacility.find({
        worldId,
        _id: { $ne: facility._id },
      })
        .select("position footprint rotation")
        .session(session)
        .lean();

      if (others.some(other => overlaps(nextPlacement, other))) {
        throw serviceError(409, "WORLD_MAP_FACILITY_OVERLAP", "That placement overlaps another World facility.");
      }

      const update = {
        position,
        rotation: nextRotation,
        updatedBy: userId,
      };
      if (appearanceKey !== undefined) update.appearanceKey = appearanceKey;

      updatedFacility = await WorldMapFacility.findOneAndUpdate(
        { _id: facility._id, worldId },
        { $set: update },
        { new: true, runValidators: true, session },
      );

      const layoutUpdate = await WorldMapLayout.updateOne(
        { _id: layout._id, worldId, layoutVersion: expectedLayoutVersion },
        {
          $inc: { layoutVersion: 1 },
          $set: { updatedBy: userId },
        },
        { session },
      );

      if (layoutUpdate.modifiedCount !== 1) {
        throw serviceError(409, "WORLD_MAP_VERSION_CONFLICT", "The World map changed. Refresh before editing again.");
      }
      updatedVersion = expectedLayoutVersion + 1;
    });

    return {
      facility: {
        id: String(updatedFacility._id),
        facilityKey: updatedFacility.facilityKey,
        type: updatedFacility.type,
        position: updatedFacility.position,
        footprint: updatedFacility.footprint,
        rotation: updatedFacility.rotation,
        level: updatedFacility.level,
        appearanceKey: updatedFacility.appearanceKey,
        status: updatedFacility.status,
        placementManagedBy: updatedFacility.placementManagedBy,
      },
      layoutVersion: updatedVersion,
    };
  } catch (error) {
    if (
      error?.code === 20 ||
      String(error?.message || "").toLowerCase().includes("transaction numbers are only allowed")
    ) {
      throw serviceError(
        503,
        "WORLD_MAP_EDIT_REQUIRES_TRANSACTIONS",
        "World map editing requires a transaction-capable MongoDB deployment.",
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
