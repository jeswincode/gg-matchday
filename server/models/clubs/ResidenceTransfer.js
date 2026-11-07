import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const residenceTransferSchema = new mongoose.Schema({
  residenceId: { type: mongoose.Schema.Types.ObjectId, ref: "PlayerResidence", required: true, index: true },
  fromPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  toPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  status: { type: String, enum: ["pending", "accepted", "declined", "cancelled", "expired"], default: "pending", index: true },
  expiresAt: { type: Date, required: true, index: true },
  respondedAt: { type: Date, default: null },
}, { timestamps: true, collection: "residenceTransfers" });

residenceTransferSchema.index(
  { residenceId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
residenceTransferSchema.index(
  { toPlayerId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
residenceTransferSchema.index({ toPlayerId: 1, status: 1, expiresAt: 1 });
residenceTransferSchema.index({ fromPlayerId: 1, status: 1, expiresAt: 1 });

export default getClubsConnection().model("ResidenceTransfer", residenceTransferSchema);
