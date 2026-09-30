import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const auctionOfferSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    amount: { type: Number, min: 0, required: true },
    status: { type: String, enum: ["active", "withdrawn", "chosenByPlayer", "rejectedByPlayer", "approved", "cancelled"], default: "active", index: true },
    expiresAt: { type: Date, default: null },
    playerChosenAt: { type: Date, default: null },
    captainApprovedAt: { type: Date, default: null },
    captainApprovalIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }], default: [] },
  },
  { timestamps: true, collection: "auctionOffers" },
);

auctionOfferSchema.index({ playerId: 1, createdAt: -1 });
auctionOfferSchema.index({ playerId: 1, clubId: 1, createdAt: -1 });

export default getClubsConnection().model("AuctionOffer", auctionOfferSchema);