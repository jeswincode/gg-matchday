import mongoose from "mongoose";
import { getClubsConnection } from "../config/clubsDatabase.js";
import { worldDataScopePlugin } from "../services/worldDataScope.js";

const clubSyncJobSchema = new mongoose.Schema(
  {
    worldId: { type: mongoose.Schema.Types.ObjectId, ref: "World", default: null, index: true },
    mainMatchId: { type: mongoose.Schema.Types.ObjectId, required: true },
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
clubSyncJobSchema.index({ worldId: 1, mainMatchId: 1 }, { unique: true, name: "club_sync_world_main_match_unique" });
clubSyncJobSchema.plugin(worldDataScopePlugin);

export default getClubsConnection().model("ClubSyncJob", clubSyncJobSchema);
