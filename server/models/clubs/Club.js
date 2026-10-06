import mongoose from "mongoose";
import { CLUB_MIN_MEMBERS, CLUB_MAX_MEMBERS, CLUB_STARTING_BALANCE, normalizeClubName } from "../../config/clubsRules.js";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const memberId = { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true };

const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameNormalized: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    logoUrl: { type: String, trim: true, default: "" },
    memberIds: {
      type: [memberId],
      validate: {
        validator: function(value) {
          if (!Array.isArray(value) || value.length > CLUB_MAX_MEMBERS) return false;
          if (new Set(value.map(String)).size !== value.length) return false;
          if (["approved", "pendingApproval"].includes(this.status)) {
            return value.length >= CLUB_MIN_MEMBERS && value.length <= CLUB_MAX_MEMBERS;
          }
          return true;
        },
        message: `An active club must contain between ${CLUB_MIN_MEMBERS} and ${CLUB_MAX_MEMBERS} players, with no duplicates.`,
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