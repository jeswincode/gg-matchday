import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const contractSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: ["active", "expired", "released", "transferred"], default: "active", index: true },
    signingAmount: { type: Number, min: 0, default: 0 },
    source: { type: String, enum: ["formation", "auction", "joinRequest", "renewal"], required: true },
    renewalNumber: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, collection: "clubContracts" },
);

contractSchema.index(
  { playerId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);
contractSchema.index(
  { clubId: 1, playerId: 1, status: 1 },
);

export default getClubsConnection().model("ClubContract", contractSchema);