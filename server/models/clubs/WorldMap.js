import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldMapSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, default: "Original GG" },
    version: { type: Number, min: 1, required: true, default: 1 },
    layout: { type: mongoose.Schema.Types.Mixed, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "worldMaps" },
);

export default getClubsConnection().model("WorldMap", worldMapSchema);
