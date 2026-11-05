import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const trainingSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    counts: {
      pushups: { type: Number, min: 0, default: 0 },
      pullups: { type: Number, min: 0, default: 0 },
      squats: { type: Number, min: 0, default: 0 },
      planks: { type: Number, min: 0, default: 0 },
    },
    totalCounts: { type: Number, min: 1, max: 1500, required: true },
    durationSeconds: { type: Number, min: 1, max: 28800, required: true },
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: "trainingSessions" },
);

trainingSessionSchema.index({ playerId: 1, recordedAt: -1 });

export default getClubsConnection().model("TrainingSession", trainingSessionSchema);
