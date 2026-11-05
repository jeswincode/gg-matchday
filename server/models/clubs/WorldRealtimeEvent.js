import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldRealtimeEventSchema = new mongoose.Schema({
  event: { type: String, required: true, trim: true, maxlength: 64 },
  locationId: { type: String, required: true, trim: true, maxlength: 64, default: "world" },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: "worldRealtimeEvents" });

export default getClubsConnection().model("WorldRealtimeEvent", worldRealtimeEventSchema);
