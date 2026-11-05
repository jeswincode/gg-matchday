import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldInteractionSchema = new mongoose.Schema({
  fromPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  toPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  fromName: { type: String, trim: true, maxlength: 24, default: "GG Player" },
  type: { type: String, enum: ["wave", "high-five", "cheer", "dance"], required: true },
  locationId: { type: String, trim: true, maxlength: 64, default: "city-plaza" },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true, collection: "worldInteractions" });

worldInteractionSchema.index({ toPlayerId: 1, createdAt: -1 });
export default getClubsConnection().model("WorldInteraction", worldInteractionSchema);
