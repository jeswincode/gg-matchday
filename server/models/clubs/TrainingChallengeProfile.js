import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const trainingChallengeProfileSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    challengeId: { type: String, required: true, trim: true, maxlength: 80 },
    bestSeconds: { type: Number, min: 0, required: true },
    attempts: { type: Number, min: 0, default: 0 },
    lastPlayedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "trainingChallengeProfiles" },
);
trainingChallengeProfileSchema.index({ playerId: 1, challengeId: 1 }, { unique: true });
trainingChallengeProfileSchema.index({ challengeId: 1, bestSeconds: 1, lastPlayedAt: 1 });

export default getClubsConnection().model("TrainingChallengeProfile", trainingChallengeProfileSchema);
