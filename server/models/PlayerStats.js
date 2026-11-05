import mongoose from "mongoose";
import { worldDataScopePlugin } from "../services/worldDataScope.js";

const playerStatsSchema = new mongoose.Schema({
  worldId: { type: mongoose.Schema.Types.ObjectId, ref: "World", default: null, index: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  stats: { type: mongoose.Schema.Types.Mixed, required: true },
  matchCount: { type: Number, min: 0, required: true, default: 0 },
  sourceLatestMatchAt: { type: Date, default: null },
}, { timestamps: true, collection: "playerStats" });

playerStatsSchema.index({ worldId: 1, playerId: 1 }, { unique: true, name: "player_stats_world_player_unique" });
playerStatsSchema.index({ worldId: 1, "stats.ggRating": -1, playerId: 1 });

playerStatsSchema.plugin(worldDataScopePlugin);

export default mongoose.model("PlayerStats", playerStatsSchema);
