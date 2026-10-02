import mongoose from "mongoose";
import { getClubsConnection } from "../config/clubsDatabase.js";

const clubSyncJobSchema = new mongoose.Schema(
  {
    mainMatchId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
    status: { type: String, enum: ["pending", "processing", "completed"], default: "pending", index: true },
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lockedUntil: { type: Date, default: null },
    lastError: { type: String, trim: true, maxlength: 1000, default: "" },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "clubSyncJobs" },
);

clubSyncJobSchema.index({ status: 1, nextAttemptAt: 1 });
clubSyncJobSchema.index({ status: 1, lockedUntil: 1 });

export default getClubsConnection().model("ClubSyncJob", clubSyncJobSchema);
