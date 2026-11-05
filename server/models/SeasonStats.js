import mongoose from "mongoose";
import { worldDataScopePlugin } from "../services/worldDataScope.js";

const seasonStatsSchema = new mongoose.Schema({
  worldId: { type: mongoose.Schema.Types.ObjectId, ref: "World", default: null, index: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  year: { type: Number, required: true, min: 2000, max: 2100, index: true },
  stats: { type: mongoose.Schema.Types.Mixed, required: true },
  matchCount: { type: Number, min: 0, required: true, default: 0 },
  sourceLatestMatchAt: { type: Date, default: null },
}, { timestamps: true, collection: "seasonStats" });

seasonStatsSchema.index({ worldId: 1, playerId: 1, year: 1 }, { unique: true, name: "season_stats_world_player_year_unique" });
seasonStatsSchema.index({ worldId: 1, year: 1, "stats.ggRating": -1 });

seasonStatsSchema.plugin(worldDataScopePlugin);

export default mongoose.model("SeasonStats", seasonStatsSchema);
