import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const clubHistorySchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    eventType: {
      type: String,
      enum: [
        "formed",
        "memberJoined",
        "memberReleased",
        "memberTransferred",
        "captainAssigned",
        "captainLeft",
        "formationChanged",
        "matchPlayed",
        "achievement",
        "competitionResult",
        "walletTransaction",
        "adminApproved",
        "adminRejected",
        "archived",
      ],
      required: true,
    },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null, index: true },
    relatedClubMatchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    relatedMainMatchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: "clubHistory" },
);

clubHistorySchema.index({ clubId: 1, occurredAt: -1 });
clubHistorySchema.index({ playerId: 1, occurredAt: -1 });

export default getClubsConnection().model("ClubHistory", clubHistorySchema);