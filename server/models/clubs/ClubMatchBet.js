import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const clubMatchBetSchema = new mongoose.Schema(
  {
    clubMatchId: { type: mongoose.Schema.Types.ObjectId, ref: "ClubMatch", required: true, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    stake: { type: Number, min: 0, required: true },
    payout: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ["placed", "won", "lost", "refunded"], default: "placed", index: true },
    placedAt: { type: Date, default: Date.now },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "clubMatchBets" },
);

clubMatchBetSchema.index({ clubMatchId: 1, clubId: 1 }, { unique: true });

export default getClubsConnection().model("ClubMatchBet", clubMatchBetSchema);