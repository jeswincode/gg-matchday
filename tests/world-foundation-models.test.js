import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import World from "../server/models/World.js";
import WorldMembership from "../server/models/WorldMembership.js";
import WorldMapLayout from "../server/models/WorldMapLayout.js";
import WorldMapFacility from "../server/models/WorldMapFacility.js";
import MediaAsset from "../server/models/MediaAsset.js";

const objectId = () => new mongoose.Types.ObjectId();

async function validationError(document) {
  try {
    await document.validate();
    return null;
  } catch (error) {
    return error;
  }
}

test("World defaults reflect public discovery and approval-only joining", async () => {
  const world = new World({
    name: "Original GG",
    slug: "Original-GG",
    ownerUserId: objectId(),
  });

  assert.equal(world.slug, "original-gg");
  assert.equal(world.visibility, "public");
  assert.equal(world.joinPolicy, "approval");
  assert.equal(world.status, "active");
  assert.equal(await validationError(world), null);
});

test("World rejects invalid slugs and non-approved visibility/join policies", async () => {
  const invalidSlug = new World({
    name: "Invalid",
    slug: "not a valid slug",
    ownerUserId: objectId(),
  });
  const slugError = await validationError(invalidSlug);
  assert.ok(slugError instanceof mongoose.Error.ValidationError);
  assert.ok(slugError.errors.slug);

  const invalidVisibility = new World({
    name: "Private World",
    slug: "private-world",
    ownerUserId: objectId(),
    visibility: "private",
  });
  const visibilityError = await validationError(invalidVisibility);
  assert.ok(visibilityError instanceof mongoose.Error.ValidationError);
  assert.ok(visibilityError.errors.visibility);
});

test("World global map coordinates must be integer tile positions", async () => {
  const world = new World({
    name: "Map Test",
    slug: "map-test",
    ownerUserId: objectId(),
    globalMap: { x: 1.5, y: 2 },
  });
  const error = await validationError(world);
  assert.ok(error instanceof mongoose.Error.ValidationError);
  assert.ok(error.errors["globalMap.x"]);
});

test("WorldMembership defaults to a pending member without a linked Player", async () => {
  const membership = new WorldMembership({
    worldId: objectId(),
    userId: objectId(),
  });

  assert.equal(membership.role, "member");
  assert.equal(membership.status, "pending");
  assert.equal(membership.playerProfileId, null);
  assert.equal(await validationError(membership), null);
});

test("active regular membership requires an approval timestamp", async () => {
  const membership = new WorldMembership({
    worldId: objectId(),
    userId: objectId(),
    status: "active",
  });
  const error = await validationError(membership);
  assert.ok(error instanceof mongoose.Error.ValidationError);
  assert.ok(error.errors.approvedAt);
});

test("pending membership cannot carry an elevated role", async () => {
  const membership = new WorldMembership({
    worldId: objectId(),
    userId: objectId(),
    role: "admin",
    status: "pending",
  });
  const error = await validationError(membership);
  assert.ok(error instanceof mongoose.Error.ValidationError);
  assert.ok(error.errors.role);
});

test("World membership indexes enforce one membership and one profile claim per World", () => {
  const indexes = WorldMembership.schema.indexes();
  assert.ok(indexes.some(([keys, options]) =>
    keys.worldId === 1 && keys.userId === 1 && options.unique === true
  ));
  assert.ok(indexes.some(([keys, options]) =>
    keys.worldId === 1 &&
    keys.playerProfileId === 1 &&
    options.unique === true &&
    options.partialFilterExpression?.playerProfileId?.$type === "objectId"
  ));
});

test("WorldMapLayout defaults to isometric projection and validates dimensions", async () => {
  const layout = new WorldMapLayout({ worldId: objectId() });
  assert.equal(layout.projection, "isometric");
  assert.equal(layout.theme, "woodland");
  assert.equal(layout.gridWidth, 60);
  assert.equal(layout.gridHeight, 60);
  assert.equal(await validationError(layout), null);

  const invalid = new WorldMapLayout({
    worldId: objectId(),
    projection: "globe",
    gridWidth: 500,
  });
  const error = await validationError(invalid);
  assert.ok(error instanceof mongoose.Error.ValidationError);
});

test("WorldMapFacility validates tile positions, rotations and map bounds", async () => {
  const facility = new WorldMapFacility({
    worldId: objectId(),
    facilityKey: "central-stadium",
    type: "central_stadium",
    position: { column: 10, row: 12 },
    footprint: { width: 4, height: 3 },
  });
  assert.equal(await validationError(facility), null);

  const invalid = new WorldMapFacility({
    worldId: objectId(),
    facilityKey: "training-ground",
    type: "training_grounds",
    position: { column: 254, row: 10 },
    footprint: { width: 4, height: 2 },
    rotation: 45,
  });
  const error = await validationError(invalid);
  assert.ok(error instanceof mongoose.Error.ValidationError);
  assert.ok(error.errors["footprint.width"]);
  assert.ok(error.errors.rotation);
});

test("MediaAsset defaults to private visibility and enforces World ownership", async () => {
  const accountAsset = new MediaAsset({
    scope: "account",
    ownerUserId: objectId(),
    type: "profile_image",
    provider: "s3_compatible",
    objectKey: "accounts/example/profile/avatar.webp",
    contentType: "image/webp",
    sizeBytes: 1024,
  });
  assert.equal(accountAsset.visibility, "private");
  assert.equal(await validationError(accountAsset), null);

  const invalidWorldAsset = new MediaAsset({
    scope: "world",
    ownerUserId: objectId(),
    type: "training_photo",
    provider: "s3_compatible",
    objectKey: "worlds/example/training/photo.webp",
    contentType: "image/webp",
    sizeBytes: 1024,
  });
  const error = await validationError(invalidWorldAsset);
  assert.ok(error instanceof mongoose.Error.ValidationError);
  assert.ok(error.errors.worldId);
});

test("MediaAsset validates safe integer file sizes and private object identity", async () => {
  const asset = new MediaAsset({
    scope: "account",
    ownerUserId: objectId(),
    type: "profile_image",
    provider: "s3_compatible",
    objectKey: "accounts/example/avatar.webp",
    contentType: "image/webp",
    sizeBytes: 1.5,
  });
  const error = await validationError(asset);
  assert.ok(error instanceof mongoose.Error.ValidationError);
  assert.ok(error.errors.sizeBytes);
});
