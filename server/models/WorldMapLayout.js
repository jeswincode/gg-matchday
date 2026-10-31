import mongoose from "mongoose";

const { Schema } = mongoose;
const integer = value => Number.isInteger(value);

const worldMapLayoutSchema = new Schema({
  worldId: {
    type: Schema.Types.ObjectId,
    ref: "World",
    required: true,
  },
  projection: {
    type: String,
    enum: ["isometric"],
    default: "isometric",
    required: true,
  },
  theme: {
    type: String,
    enum: ["woodland", "coastal", "mountain", "desert", "winter", "urban", "custom"],
    default: "woodland",
    required: true,
  },
  seed: { type: Number, min: 0, max: 2147483647, default: 1, validate: integer },
  gridWidth: { type: Number, min: 12, max: 256, default: 60, validate: integer },
  gridHeight: { type: Number, min: 12, max: 256, default: 60, validate: integer },
  layoutVersion: { type: Number, min: 1, default: 1, validate: integer },
  backgroundAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, {
  timestamps: true,
  collection: "worldMapLayouts",
});

worldMapLayoutSchema.index({ worldId: 1 }, { unique: true, name: "world_map_layout_world_unique" });

export default mongoose.models.WorldMapLayout || mongoose.model("WorldMapLayout", worldMapLayoutSchema);
