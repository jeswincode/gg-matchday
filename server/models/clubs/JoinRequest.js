import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const joinRequestSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending", index: true },
    captainApprovalIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], default: [] },
    effectiveStartAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true, collection: "joinRequests" },
);

joinRequestSchema.index({ playerId: 1, clubId: 1, status: 1 });
joinRequestSchema.index(
  { playerId: 1, clubId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

export default getClubsConnection().model("JoinRequest", joinRequestSchema);