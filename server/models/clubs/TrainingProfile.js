import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const exerciseFields = {
  pushups: { type: Number, min: 0, default: 0 },
  pullups: { type: Number, min: 0, default: 0 },
  squats: { type: Number, min: 0, default: 0 },
  planks: { type: Number, min: 0, default: 0 },
};

const trainingProfileSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, unique: true, index: true },
    totals: {
      ...exerciseFields,
      totalCounts: { type: Number, min: 0, default: 0 },
      sessions: { type: Number, min: 0, default: 0 },
    },
    personalBests: { ...exerciseFields },
    lastWorkoutAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "trainingProfiles" },
);

export default getClubsConnection().model("TrainingProfile", trainingProfileSchema);
