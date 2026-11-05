import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldDailyProgressSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
  dayKey: { type: String, required: true, match: /^\\d{4}-\\d{2}-\\d{2}$/ },
  xpEarned: { type: Number, min: 0, default: 0 },
  coinsEarned: { type: Number, min: 0, default: 0 },
  trainingXpEarned: { type: Number, min: 0, default: 0 },
  trainingCoinsEarned: { type: Number, min: 0, default: 0 },
  trainingSessions: { type: Number, min: 0, default: 0 },
  tutorialClaims: { type: Number, min: 0, default: 0 },
}, { timestamps: true, collection: "worldDailyProgress" });

worldDailyProgressSchema.index({ playerId: 1, dayKey: 1 }, { unique: true });
export default getClubsConnection().model("WorldDailyProgress", worldDailyProgressSchema);
