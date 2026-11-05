import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldSocialRateLimitSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, unique: true },
  messageWindowStart: { type: Date, default: null },
  messageCount: { type: Number, min: 0, default: 0 },
  lastInteractionAt: { type: Date, default: null },
}, { timestamps: true, collection: "worldSocialRateLimits" });

worldSocialRateLimitSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });
export default getClubsConnection().model("WorldSocialRateLimit", worldSocialRateLimitSchema);
