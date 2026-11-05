import mongoose from "mongoose";

const historyEntrySchema = new mongoose.Schema({
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  actorName: { type: String, trim: true, maxlength: 120, default: "User" },
  action: {
    type: String,
    enum: ["submitted", "review-started", "marked-correction-required", "resolved-no-change", "rejected"],
    required: true,
  },
  fromStatus: { type: String, trim: true, maxlength: 40, default: "" },
  toStatus: { type: String, trim: true, maxlength: 40, required: true },
  note: { type: String, trim: true, maxlength: 500, default: "" },
  createdAt: { type: Date, default: Date.now, required: true },
}, { _id: true });

const ratingDisputeSchema = new mongoose.Schema({
  match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true, index: true },
  player: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  category: {
    type: String,
    enum: ["match-rating", "defensive-rating", "performance-codes", "match-statistics", "other"],
    required: true,
  },
  message: { type: String, trim: true, required: true, maxlength: 1000 },
  status: {
    type: String,
    enum: ["pending", "reviewing", "correction_required", "resolved_no_change", "rejected"],
    default: "pending",
    index: true,
  },
  open: { type: Boolean, default: true, index: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  history: { type: [historyEntrySchema], default: [] },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, trim: true, maxlength: 500, default: "" },
}, { timestamps: true, collection: "ratingDisputes", versionKey: false });

ratingDisputeSchema.index(
  { submittedBy: 1, match: 1, player: 1 },
  { unique: true, partialFilterExpression: { open: true }, name: "one_open_rating_dispute_per_user_match_player" },
);
ratingDisputeSchema.index({ status: 1, createdAt: -1 });
ratingDisputeSchema.index({ match: 1, player: 1, createdAt: -1 });

export default mongoose.models.RatingDispute || mongoose.model("RatingDispute", ratingDisputeSchema);
