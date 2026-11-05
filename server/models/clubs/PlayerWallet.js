import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const playerWalletSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
      unique: true,
      index: true,
    },
    balance: { type: Number, min: 0, required: true, default: 0 },
  },
  { timestamps: true, collection: "playerWallets" },
);

export default getClubsConnection().model("PlayerWallet", playerWalletSchema);