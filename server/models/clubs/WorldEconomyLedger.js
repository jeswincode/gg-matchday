import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldEconomyLedgerSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  idempotencyKey: { type: String, required: true, trim: true, maxlength: 100 },
  type: { type: String, enum: ["purchase", "reward", "upgrade", "admin-adjustment"], required: true },
  itemId: { type: String, trim: true, maxlength: 80, default: null },
  coinsDelta: { type: Number, required: true, min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
  xpDelta: { type: Number, required: true, min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER, default: 0 },
  balanceAfter: { type: Number, required: true, min: 0 },
  xpAfter: { type: Number, required: true, min: 0 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: "worldEconomyLedger" });

worldEconomyLedgerSchema.index({ playerId: 1, idempotencyKey: 1 }, { unique: true });
worldEconomyLedgerSchema.index({ playerId: 1, createdAt: -1 });

export default getClubsConnection().model("WorldEconomyLedger", worldEconomyLedgerSchema);
