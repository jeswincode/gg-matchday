import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldEconomySchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, unique: true, index: true },
  coins: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, default: 0, required: true },
  xp: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER, default: 0, required: true },
  level: { type: Number, min: 1, max: 100, default: 1, required: true },
  lifetimeXpEarned: { type: Number, min: 0, default: 0 },
  lifetimeCoinsEarned: { type: Number, min: 0, default: 0 },
  xpIntoLevel: { type: Number, min: 0, default: 0 },
  xpForNextLevel: { type: Number, min: 0, default: 100 },
}, { timestamps: true, collection: "worldEconomies" });

export default getClubsConnection().model("WorldEconomy", worldEconomySchema);
