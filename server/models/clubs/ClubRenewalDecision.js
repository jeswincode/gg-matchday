import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";
import { worldDataScopePlugin } from "../../services/worldDataScope.js";

const clubRenewalDecisionSchema = new mongoose.Schema(
  {
    worldId: { type: mongoose.Schema.Types.ObjectId, ref: "World", default: null, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    boundaryAt: { type: Date, required: true, index: true },
    retainedPlayerIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true }], required: true },
    captainApprovalIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], default: [] },
    status: { type: String, enum: ["pendingCaptainApproval", "applied", "cancelled"], default: "pendingCaptainApproval", index: true },
    appliedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "clubRenewalDecisions" },
);

clubRenewalDecisionSchema.index({ worldId: 1, clubId: 1, boundaryAt: 1 }, { unique: true, name: "club_renewal_world_club_boundary_unique" });

clubRenewalDecisionSchema.plugin(worldDataScopePlugin);

export default getClubsConnection().model("ClubRenewalDecision", clubRenewalDecisionSchema);