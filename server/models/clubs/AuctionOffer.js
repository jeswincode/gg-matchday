import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";
import { worldDataScopePlugin } from "../../services/worldDataScope.js";

const auctionOfferSchema = new mongoose.Schema(
  {
    worldId: { type: mongoose.Schema.Types.ObjectId, ref: "World", default: null, index: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
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

auctionOfferSchema.index({ worldId: 1, playerId: 1, createdAt: -1 });
auctionOfferSchema.index({ worldId: 1, playerId: 1, clubId: 1, createdAt: -1 });
auctionOfferSchema.index(
  { worldId: 1, playerId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["chosenByPlayer", "approved"] } }, name: "auction_world_player_active_contract_unique" },
);

auctionOfferSchema.plugin(worldDataScopePlugin);

export default getClubsConnection().model("AuctionOffer", auctionOfferSchema);