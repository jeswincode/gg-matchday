import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";
import { CHARACTER_DIRECTIONS } from "../../../shared/characterAnimation.js";

const worldPresenceSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, unique: true, index: true },
    displayName: { type: String, trim: true, maxlength: 24, default: "GG Player" },
    locationId: { type: String, trim: true, maxlength: 64, default: "city-plaza" },
    x: { type: Number, min: 0, max: 1800, default: 900 },
    y: { type: Number, min: 0, max: 1200, default: 600 },
    direction: { type: String, enum: CHARACTER_DIRECTIONS, default: "down" },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: "worldPresence" },
);

worldPresenceSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 180 });
worldPresenceSchema.index({ locationId: 1, lastSeenAt: -1 });

export default getClubsConnection().model("WorldPresence", worldPresenceSchema);
