import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";
import { worldDataScopePlugin } from "../../services/worldDataScope.js";

const playerWalletSchema = new mongoose.Schema(
  {
    worldId: { type: mongoose.Schema.Types.ObjectId, ref: "World", default: null, index: true },
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

playerWalletSchema.plugin(worldDataScopePlugin);

export default getClubsConnection().model("PlayerWallet", playerWalletSchema);