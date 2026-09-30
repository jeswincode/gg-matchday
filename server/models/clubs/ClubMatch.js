import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const clubMatchSchema = new mongoose.Schema(
  {
    clubAId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    clubBId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    requestedByClubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    scheduledAt: { type: Date, required: true },
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
    prediction: {
      clubAPercent: { type: Number, min: 0, max: 100, default: null },
      clubBPercent: { type: Number, min: 0, max: 100, default: null },
      generatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true, collection: "clubMatches" },
);

clubMatchSchema.index({ clubAId: 1, clubBId: 1, scheduledAt: 1 });
clubMatchSchema.index({ mainMatchId: 1 }, { sparse: true });

export default getClubsConnection().model("ClubMatch", clubMatchSchema);