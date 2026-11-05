import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";
import { worldDataScopePlugin } from "../../services/worldDataScope.js";

const joinRequestSchema = new mongoose.Schema(
  {
    worldId: { type: mongoose.Schema.Types.ObjectId, ref: "World", default: null, index: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending", index: true },
    captainApprovalIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], default: [] },
    effectiveStartAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true, collection: "joinRequests" },
);

joinRequestSchema.index({ worldId: 1, playerId: 1, clubId: 1, status: 1 });
joinRequestSchema.index(
  { worldId: 1, playerId: 1, clubId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "pending_join_world_player_club_unique" },
);

joinRequestSchema.plugin(worldDataScopePlugin);

export default getClubsConnection().model("JoinRequest", joinRequestSchema);