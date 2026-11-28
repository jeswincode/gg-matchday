import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const clubPlayerStatsSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    matches: { type: Number, min: 0, default: 0 },
    wins: { type: Number, min: 0, default: 0 },
    draws: { type: Number, min: 0, default: 0 },
    losses: { type: Number, min: 0, default: 0 },
    goals: { type: Number, min: 0, default: 0 },
    assists: { type: Number, min: 0, default: 0 },
    motm: { type: Number, min: 0, default: 0 },
    ratingTotal: { type: Number, min: 0, default: 0 },
    ratedMatches: { type: Number, min: 0, default: 0 },
    lastMainMatchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    lastPlayedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "clubPlayerStats" },
);

clubPlayerStatsSchema.index({ clubId: 1, playerId: 1 }, { unique: true });

export default getClubsConnection().model("ClubPlayerStats", clubPlayerStatsSchema);