import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldInventoryItemSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
  itemId: { type: String, required: true, trim: true, maxlength: 80 },
  quantity: { type: Number, min: 1, max: 9999, default: 1, required: true },
  equipped: { type: Boolean, default: false },
  acquiredAt: { type: Date, default: Date.now },
}, { timestamps: true, collection: "worldInventoryItems" });

worldInventoryItemSchema.index({ playerId: 1, itemId: 1 }, { unique: true });

export default getClubsConnection().model("WorldInventoryItem", worldInventoryItemSchema);
