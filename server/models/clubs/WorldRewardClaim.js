import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldRewardClaimSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  sourceKey: { type: String, required: true, trim: true, maxlength: 120 },
  sourceType: { type: String, enum: ["tutorial", "training-session", "achievement"], required: true },
  xpGranted: { type: Number, min: 0, required: true },
  coinsGranted: { type: Number, min: 0, required: true },
  dayKey: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: "worldRewardClaims" });

worldRewardClaimSchema.index({ playerId: 1, sourceKey: 1 }, { unique: true });
worldRewardClaimSchema.index({ playerId: 1, dayKey: 1, sourceType: 1 });
export default getClubsConnection().model("WorldRewardClaim", worldRewardClaimSchema);
