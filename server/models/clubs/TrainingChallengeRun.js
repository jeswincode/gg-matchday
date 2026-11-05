import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const trainingChallengeRunSchema = new mongoose.Schema(
  {
    runId: { type: String, required: true, unique: true, index: true, trim: true, maxlength: 80 },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    challengeId: { type: String, required: true, trim: true, maxlength: 80 },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    completedAt: { type: Date, default: null },
    scoreSeconds: { type: Number, min: 0, default: null },
  },
  { timestamps: true, collection: "trainingChallengeRuns" },
);

export default getClubsConnection().model("TrainingChallengeRun", trainingChallengeRunSchema);
