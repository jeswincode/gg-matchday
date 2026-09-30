import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const playerWalletTransactionSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    type: {
      type: String,
      enum: [
        "signing_payment",
        "motm_reward",
        "individual_match_reward",
        "competition_reward",
        "adjustment",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, min: 0, required: true },
    description: { type: String, trim: true, maxlength: 240, default: "" },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", default: null },
    mainMatchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    clubMatchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    auctionOfferId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: "playerWalletTransactions" },
);

playerWalletTransactionSchema.index({ playerId: 1, createdAt: -1 });

export default getClubsConnection().model("PlayerWalletTransaction", playerWalletTransactionSchema);