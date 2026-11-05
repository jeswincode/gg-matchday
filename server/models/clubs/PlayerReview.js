import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";
import { worldDataScopePlugin } from "../../services/worldDataScope.js";

const playerReviewSchema = new mongoose.Schema(
  {
    worldId: { type: mongoose.Schema.Types.ObjectId, ref: "World", default: null, index: true },
    reviewerPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    reviewedPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    relationship: { type: String, enum: ["teammate", "opponent"], required: true },
    stars: { type: Number, min: 1, max: 5, required: true },
    observation: { type: String, trim: true, maxlength: 1000, required: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", default: null },
    eligibilityMatchCount: { type: Number, min: 1, required: true },
  },
  { timestamps: true, collection: "playerReviews" },
);

playerReviewSchema.index(
  { worldId: 1, reviewerPlayerId: 1, reviewedPlayerId: 1, relationship: 1 },
  { unique: true, name: "player_review_world_unique" },
);

playerReviewSchema.pre("validate", function preventSelfReview() {
  if (String(this.reviewerPlayerId) === String(this.reviewedPlayerId)) {
    this.invalidate("reviewedPlayerId", "A player cannot review themselves.");
  }
});

playerReviewSchema.plugin(worldDataScopePlugin);

export default getClubsConnection().model("PlayerReview", playerReviewSchema);