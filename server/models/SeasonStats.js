import mongoose from "mongoose";

const seasonStatsSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  year: { type: Number, required: true, min: 2000, max: 2100, index: true },
  stats: { type: mongoose.Schema.Types.Mixed, required: true },
  matchCount: { type: Number, min: 0, required: true, default: 0 },
  sourceLatestMatchAt: { type: Date, default: null },
}, { timestamps: true, collection: "seasonStats" });

seasonStatsSchema.index({ playerId: 1, year: 1 }, { unique: true });
seasonStatsSchema.index({ year: 1, "stats.ggRating": -1 });

export default mongoose.model("SeasonStats", seasonStatsSchema);
