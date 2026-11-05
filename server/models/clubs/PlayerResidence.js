import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const playerResidenceSchema = new mongoose.Schema(
  {
    ownerPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    x: { type: Number, min: 0, max: 1800, required: true },
    y: { type: Number, min: 0, max: 1200, required: true },
    level: { type: Number, min: 1, max: 20, default: 1 },
    privacy: { type: String, enum: ["private", "public"], default: "private" },
    interior: { type: mongoose.Schema.Types.Mixed, default: () => ({ rooms: [] }) },
  },
  { timestamps: true, collection: "playerResidences" },
);

export default getClubsConnection().model("PlayerResidence", playerResidenceSchema);
