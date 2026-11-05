import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldMessageSchema = new mongoose.Schema({
  locationId: { type: String, required: true, trim: true, maxlength: 64, index: true },
  senderPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  displayName: { type: String, required: true, trim: true, maxlength: 24 },
  text: { type: String, required: true, trim: true, maxlength: 240 },
  reportCount: { type: Number, min: 0, default: 0 },
  moderationStatus: { type: String, enum: ["visible", "pending_review", "hidden"], default: "visible", index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true, collection: "worldMessages" });

worldMessageSchema.index({ locationId: 1, moderationStatus: 1, createdAt: -1 });
export default getClubsConnection().model("WorldMessage", worldMessageSchema);
