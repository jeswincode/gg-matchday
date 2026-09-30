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
        "betting_stake",
        "betting_win",
        "betting_refund",
        "adjustment",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, min: 0, required: true },
    description: { type: String, trim: true, maxlength: 240, default: "" },
    idempotencyKey: { type: String, trim: true, maxlength: 180, default: null },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", default: null },
    mainMatchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    clubMatchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    auctionOfferId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: "playerWalletTransactions" },
);

playerWalletTransactionSchema.index({ playerId: 1, createdAt: -1 });
playerWalletTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export default getClubsConnection().model("PlayerWalletTransaction", playerWalletTransactionSchema);