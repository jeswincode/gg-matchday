import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const clubMatchSchema = new mongoose.Schema(
  {
    clubAId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    clubBId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    requestedByClubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    scheduledAt: { type: Date, required: true },
    captainResponses: [{
      captainId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
      decision: { type: String, enum: ["accept", "decline"], required: true },
      _id: false,
    }],
    responseDecision: { type: String, enum: ["accept", "decline"], default: null },
    status: {
      type: String,
      enum: ["requested", "accepted", "declined", "cancelled", "completed"],
      default: "requested",
      index: true,
    },
    mainMatchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    winnerClubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", default: null },
    clubAScore: { type: Number, min: 0, default: null },
    clubBScore: { type: Number, min: 0, default: null },
    settlementStatus: { type: String, enum: ["pending", "settled"], default: "pending", index: true },
    settlementAt: { type: Date, default: null },
    prediction: {
      clubAPercent: { type: Number, min: 0, max: 100, default: null },
      clubBPercent: { type: Number, min: 0, max: 100, default: null },
      generatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true, collection: "clubMatches", optimisticConcurrency: true },
);

clubMatchSchema.index({ clubAId: 1, clubBId: 1, scheduledAt: 1 });
clubMatchSchema.index({ mainMatchId: 1 }, { sparse: true });

export default getClubsConnection().model("ClubMatch", clubMatchSchema);