import mongoose from "mongoose";

const { Schema } = mongoose;

const globalMapSchema = new Schema({
  mapId: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 64,
    default: "gg-main-v1",
  },
  x: {
    type: Number,
    min: -100000,
    max: 100000,
    default: null,
    validate: {
      validator: value => value === null || Number.isInteger(value),
      message: "Global map X coordinate must be an integer.",
    },
  },
  y: {
    type: Number,
    min: -100000,
    max: 100000,
    default: null,
    validate: {
      validator: value => value === null || Number.isInteger(value),
      message: "Global map Y coordinate must be an integer.",
    },
  },
}, { _id: false });

const brandingSchema = new Schema({
  emblemAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
  accentColor: {
    type: String,
    trim: true,
    lowercase: true,
    default: "#c5a45b",
    match: /^#[0-9a-f]{6}$/,
  },
}, { _id: false });

const settingsSchema = new Schema({
  timezone: { type: String, trim: true, default: "Asia/Kolkata", maxlength: 80 },
  clubsEnabled: { type: Boolean, default: true },
  trainingEnabled: { type: Boolean, default: true },
}, { _id: false });

const worldSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80,
  },
  slug: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 48,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: "",
  },
  ownerUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  visibility: {
    type: String,
    enum: ["public"],
    default: "public",
    required: true,
  },
  joinPolicy: {
    type: String,
    enum: ["approval"],
    default: "approval",
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "suspended", "archived"],
    default: "active",
    index: true,
  },
  globalMap: {
    type: globalMapSchema,
    default: () => ({}),
  },
  branding: {
    type: brandingSchema,
    default: () => ({}),
  },
  settings: {
    type: settingsSchema,
    default: () => ({}),
  },
}, {
  timestamps: true,
  collection: "worlds",
});

worldSchema.index({ slug: 1 }, { unique: true, name: "world_slug_unique" });
worldSchema.index({ ownerUserId: 1, status: 1 }, { name: "world_owner_status" });
worldSchema.index(
  { "globalMap.mapId": 1, "globalMap.x": 1, "globalMap.y": 1 },
  {
    unique: true,
    name: "world_global_map_position_unique",
    partialFilterExpression: {
      status: "active",
      "globalMap.x": { $type: "number" },
      "globalMap.y": { $type: "number" },
    },
  },
);

worldSchema.pre("validate", function validateGlobalMapPosition() {
  const x = this.globalMap?.x;
  const y = this.globalMap?.y;
  if ((x === null) !== (y === null)) {
    this.invalidate("globalMap", "Global map X and Y coordinates must be assigned together.");
  }
});

export default mongoose.models.World || mongoose.model("World", worldSchema);
