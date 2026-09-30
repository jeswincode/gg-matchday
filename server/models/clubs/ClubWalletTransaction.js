import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const clubWalletTransactionSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    type: {
      type: String,
      enum: [
        "starting_balance",
        "match_reward",
        "club_achievement",
        "competition_reward",
        "betting_win",
        "auction_purchase",
        "expense",
        "adjustment",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, min: 0, required: true },
    description: { type: String, trim: true, maxlength: 240, default: "" },
    idempotencyKey: { type: String, trim: true, maxlength: 180, default: null },
    mainMatchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    clubMatchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    auctionOfferId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: "clubWalletTransactions" },
);

clubWalletTransactionSchema.index({ clubId: 1, createdAt: -1 });
clubWalletTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export default getClubsConnection().model("ClubWalletTransaction", clubWalletTransactionSchema);