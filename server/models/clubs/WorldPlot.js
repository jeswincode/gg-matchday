import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldPlotSchema = new mongoose.Schema(
  {
    plotId: { type: String, required: true, unique: true, index: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    districtId: { type: String, required: true, trim: true, maxlength: 80 },
    x: { type: Number, min: 0, max: 1800, required: true },
    y: { type: Number, min: 0, max: 1200, required: true },
    category: { type: String, enum: ["residential", "commercial", "club", "community"], required: true },
    status: { type: String, enum: ["planned", "available", "owned", "under-construction"], default: "planned" },
    ownerPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    ownerClubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", default: null },
    description: { type: String, trim: true, maxlength: 240, default: "" },
    layout: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "worldPlots" },
);

export default getClubsConnection().model("WorldPlot", worldPlotSchema);
