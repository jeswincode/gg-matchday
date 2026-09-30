import mongoose from "mongoose";
import { CLUB_MAX_MEMBERS, CLUB_STARTING_BALANCE, CLUB_FORMATIONS, normalizeClubName } from "../../config/clubsRules.js";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const memberId = { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true };

const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameNormalized: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    logoUrl: { type: String, trim: true, default: "" },
    formation: { type: String, enum: CLUB_FORMATIONS, default: "1-2-1" },
    memberIds: {
      type: [memberId],
      validate: {
        validator: value => Array.isArray(value) && value.length <= CLUB_MAX_MEMBERS && new Set(value.map(String)).size === value.length,
        message: `A club can contain at most ${CLUB_MAX_MEMBERS} players and cannot repeat a player.`,
      },
      default: [],
    },
    captainIds: {
      type: [memberId],
      validate: {
        validator: value => Array.isArray(value) && value.length <= 2 && new Set(value.map(String)).size === value.length,
        message: "A club can have at most two captains.",
      },
      default: [],
    },
    balance: { type: Number, min: 0, required: true, default: CLUB_STARTING_BALANCE },
    status: {
      type: String,
      enum: ["draft", "pendingApproval", "approved", "rejected", "archived"],
      default: "draft",
      index: true,
    },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "clubs" },
);

clubSchema.pre("validate", function normalizeName() {
  this.nameNormalized = normalizeClubName(this.name);
});

clubSchema.index({ nameNormalized: 1 }, { unique: true });
clubSchema.index({ status: 1, createdAt: -1 });

export default getClubsConnection().model("Club", clubSchema);