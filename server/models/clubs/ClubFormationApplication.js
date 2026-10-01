import mongoose from "mongoose";
import { CLUB_MAX_MEMBERS } from "../../config/clubsRules.js";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const approvalSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    respondedAt: { type: Date, default: null },
  },
  { _id: false },
);

const voteSchema = new mongoose.Schema(
  {
    voterPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    candidatePlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
  },
  { _id: false },
);

const applicationSchema = new mongoose.Schema(
  {
    founderPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    memberIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
      validate: {
        validator: value => Array.isArray(value) && value.length === CLUB_MAX_MEMBERS && new Set(value.map(String)).size === value.length,
        message: "Club formation requires exactly " + CLUB_MAX_MEMBERS + " mutually agreed players.",
      },
    },
    memberApprovals: { type: [approvalSchema], default: [] },
    proposedName: { type: String, trim: true, maxlength: 80, default: "" },
    proposedNameNormalized: { type: String, trim: true, lowercase: true, default: "" },
    details: { type: String, trim: true, maxlength: 500, default: "" },
    captainCandidates: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
      validate: {
        validator: value => Array.isArray(value) && value.length <= 2 && new Set(value.map(String)).size === value.length,
        message: "There can be no more than two captain candidates.",
      },
      default: [],
    },
    captainVotes: { type: [voteSchema], default: [] },
    electedCaptainIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], default: [] },
    detailsApprovedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], default: [] },
    status: {
      type: String,
      enum: [
        "pendingMutualAgreement",
        "pendingName",
        "pendingCaptainVoteSetup",
        "captainVote",
        "pendingAdminApproval",
        "rejected",
        "approved",
      ],
      default: "pendingMutualAgreement",
      index: true,
    },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
    approvedClubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", default: null },
  },
  { timestamps: true, collection: "clubFormationApplications" },
);

applicationSchema.index({ founderPlayerId: 1, status: 1 });
applicationSchema.index({ proposedNameNormalized: 1 });

export default getClubsConnection().model("ClubFormationApplication", applicationSchema);