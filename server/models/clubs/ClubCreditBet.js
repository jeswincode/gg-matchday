import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const { ObjectId } = mongoose.Schema.Types;
const connection = getClubsConnection();

const bankSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  balanceCents: { type: Number, required: true, min: 0 },
  reservedCents: { type: Number, required: true, min: 0 },
}, { timestamps: true, collection: "clubCreditBank" });

const betSchema = new mongoose.Schema({
  clubMatchId: { type: ObjectId, ref: "ClubMatch", required: true },
  playerId: { type: ObjectId, required: true },
  selectionKey: { type: String, required: true },
  market: { type: String, enum: ["result", "cleanSheet", "goal", "assist", "hatTrick"], required: true },
  subjectId: { type: ObjectId },
  subjectName: { type: String, required: true },
  odds: { type: Number, min: 1, required: true },
  probability: { type: Number, min: 0, max: 1, required: true },
  stake: { type: Number, required: true, min: 0 },
  grossReturn: { type: Number, required: true, min: 0 },
  payout: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["open", "won", "lost", "refunded"], default: "open" },
  settledAt: Date,
}, { timestamps: true, collection: "clubCreditBets" });

betSchema.index({ playerId: 1, clubMatchId: 1, selectionKey: 1 }, { unique: true });
betSchema.index({ clubMatchId: 1, status: 1 });
betSchema.index({ playerId: 1, status: 1, createdAt: -1, _id: -1 });

export const ClubCreditBank = connection.model("ClubCreditBank", bankSchema);
export const ClubCreditBet = connection.model("ClubCreditBet", betSchema);
