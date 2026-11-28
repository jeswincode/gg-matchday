import { workspaceModel } from "../config/workspaceModels.js";
import mongoose from "mongoose";

const playerStatsSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, unique: true, index: true },
  stats: { type: mongoose.Schema.Types.Mixed, required: true },
  matchCount: { type: Number, min: 0, required: true, default: 0 },
  sourceLatestMatchAt: { type: Date, default: null },
}, { timestamps: true, collection: "playerStats" });

playerStatsSchema.index({ "stats.ggRating": -1, playerId: 1 });

export default workspaceModel(mongoose.model("PlayerStats", playerStatsSchema));
