import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldAchievementSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  achievementId: { type: String, required: true, trim: true, maxlength: 80 },
  unlockedAt: { type: Date, default: Date.now },
  xpReward: { type: Number, min: 0, default: 0 },
  coinReward: { type: Number, min: 0, default: 0 },
}, { timestamps: true, collection: "worldAchievements" });

worldAchievementSchema.index({ playerId: 1, achievementId: 1 }, { unique: true });
export default getClubsConnection().model("WorldAchievement", worldAchievementSchema);
