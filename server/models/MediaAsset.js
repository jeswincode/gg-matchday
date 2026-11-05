import mongoose from "mongoose";

const { Schema } = mongoose;

const mediaAssetSchema = new Schema({
  scope: {
    type: String,
    enum: ["account", "world"],
    required: true,
  },
  worldId: {
    type: Schema.Types.ObjectId,
    ref: "World",
    default: null,
    index: true,
  },
  ownerUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      "profile_image",
      "world_emblem",
      "club_badge",
      "club_kit",
      "training_photo",
      "training_video",
      "facility_art",
      "attachment",
      "export",
    ],
    required: true,
  },
  provider: {
    type: String,
    enum: ["s3_compatible", "vercel_blob", "local_development"],
    required: true,
  },
  objectKey: {
    type: String,
    required: true,
    trim: true,
    maxlength: 512,
  },
  originalFilename: { type: String, trim: true, maxlength: 180, default: "" },
  contentType: { type: String, required: true, trim: true, maxlength: 120 },
  sizeBytes: {
    type: Number,
    required: true,
    min: 0,
    validate: Number.isSafeInteger,
  },
  checksumSha256: {
    type: String,
    lowercase: true,
    trim: true,
    default: "",
    match: /^(?:[a-f0-9]{64})?$/,
  },
  visibility: {
    type: String,
    enum: ["private", "club", "world", "public"],
    default: "private",
    required: true,
  },
  linkedEntityType: {
    type: String,
    enum: ["none", "player", "club", "training_program", "training_session", "training_log", "world", "facility"],
    default: "none",
  },
  linkedEntityId: { type: Schema.Types.ObjectId, default: null },
  status: {
    type: String,
    enum: ["pending_upload", "active", "quarantined", "deleted"],
    default: "pending_upload",
    index: true,
  },
}, {
  timestamps: true,
  collection: "mediaAssets",
});

mediaAssetSchema.index(
  { provider: 1, objectKey: 1 },
  { unique: true, name: "media_asset_object_key_unique" },
);
mediaAssetSchema.index(
  { worldId: 1, ownerUserId: 1, createdAt: -1 },
  { name: "media_asset_world_owner" },
);
mediaAssetSchema.index(
  { linkedEntityType: 1, linkedEntityId: 1 },
  { name: "media_asset_entity_lookup" },
);

mediaAssetSchema.pre("validate", function validateMediaOwnership() {
  if (this.scope === "world" && !this.worldId) {
    this.invalidate("worldId", "World-scoped media requires a World identifier.");
  }
  if (this.scope === "account" && this.worldId) {
    this.invalidate("worldId", "Account-scoped media cannot be assigned to a World.");
  }
  if (this.visibility === "world" && !this.worldId) {
    this.invalidate("visibility", "World-visible media requires a World identifier.");
  }
  if (this.visibility === "club" && !this.worldId) {
    this.invalidate("visibility", "Club-visible media requires a World identifier.");
  }
});

export default mongoose.models.MediaAsset || mongoose.model("MediaAsset", mediaAssetSchema);
