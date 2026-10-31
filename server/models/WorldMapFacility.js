import mongoose from "mongoose";

const { Schema } = mongoose;
const integer = value => Number.isInteger(value);

const positionSchema = new Schema({
  column: { type: Number, required: true, min: 0, max: 255, validate: integer },
  row: { type: Number, required: true, min: 0, max: 255, validate: integer },
}, { _id: false });

const footprintSchema = new Schema({
  width: { type: Number, required: true, min: 1, max: 32, default: 1, validate: integer },
  height: { type: Number, required: true, min: 1, max: 32, default: 1, validate: integer },
}, { _id: false });

const worldMapFacilitySchema = new Schema({
  worldId: {
    type: Schema.Types.ObjectId,
    ref: "World",
    required: true,
  },
  facilityKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 64,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  },
  type: {
    type: String,
    enum: [
      "central_stadium",
      "club_district",
      "construction_grounds",
      "captains_arena",
      "training_grounds",
      "community_hall",
      "hall_of_fame",
      "administration",
    ],
    required: true,
  },
  position: {
    type: positionSchema,
    required: true,
  },
  footprint: {
    type: footprintSchema,
    default: () => ({ width: 1, height: 1 }),
  },
  rotation: {
    type: Number,
    enum: [0, 90, 180, 270],
    default: 0,
  },
  level: { type: Number, min: 1, max: 10, default: 1, validate: integer },
  appearanceKey: { type: String, trim: true, maxlength: 64, default: "default" },
  status: {
    type: String,
    enum: ["active", "locked", "under_construction", "unavailable"],
    default: "active",
    index: true,
  },
  placementManagedBy: {
    type: String,
    enum: ["system", "world_owner"],
    default: "world_owner",
  },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, {
  timestamps: true,
  collection: "worldMapFacilities",
});

worldMapFacilitySchema.index(
  { worldId: 1, facilityKey: 1 },
  { unique: true, name: "world_facility_key_unique" },
);
worldMapFacilitySchema.index(
  { worldId: 1, status: 1, type: 1 },
  { name: "world_facility_scene_lookup" },
);

worldMapFacilitySchema.pre("validate", function validateFacilityFootprint() {
  const column = this.position?.column;
  const row = this.position?.row;
  const width = this.footprint?.width;
  const height = this.footprint?.height;
  if (Number.isInteger(column) && Number.isInteger(width) && column + width > 256) {
    this.invalidate("footprint.width", "Facility footprint exceeds the supported map grid.");
  }
  if (Number.isInteger(row) && Number.isInteger(height) && row + height > 256) {
    this.invalidate("footprint.height", "Facility footprint exceeds the supported map grid.");
  }
});

export default mongoose.models.WorldMapFacility || mongoose.model("WorldMapFacility", worldMapFacilitySchema);
