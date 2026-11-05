import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const clubGroundSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    x: { type: Number, min: 0, max: 1800, required: true },
    y: { type: Number, min: 0, max: 1200, required: true },
    level: { type: Number, min: 1, max: 20, default: 1 },
    accessPolicy: { type: String, enum: ["public-exterior-private-interior"], default: "public-exterior-private-interior" },
    interiorAccess: { type: String, enum: ["members", "public"], default: "members" },
    layout: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "clubGrounds" },
);

export default getClubsConnection().model("ClubGround", clubGroundSchema);
