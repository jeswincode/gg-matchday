import mongoose from "mongoose";

const userSchema =
  new mongoose.Schema(
    {
      chatMonth: { type: String, default: "" },
      chatMessagesUsed: { type: Number, default: 0 },
      firebaseUid: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },

      profileImage: {
        type: String,
        default: "",
      },

      // Legacy single-World link. WorldMembership.playerProfileId becomes
      // authoritative after the account/profile migration is completed.
      playerProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player",
        default: null,
      },

      // Legacy group-wide role, retained for old routes during migration.
      // New World-scoped permissions use WorldMembership.role instead.
      role: {
        type: String,
        enum: [
          "viewer",
          "editor",
          "admin",
        ],
        default: "viewer",
      },

      // GG platform-level authority is distinct from legacy User.role and
      // WorldMembership.role. Grants must use an audited platform-admin
      // process, never World creation or membership approval.
      platformRole: {
        type: String,
        enum: ["user", "platform_admin"],
        default: "user",
      },

      accessRequest: {
        type: String,
        enum: [
          "none",
          "pending",
          "approved",
          "rejected",
        ],
        default: "none",
      },
    },
    {
      timestamps: true,
    }
  );

userSchema.index({ playerProfile: 1 }, { name: "user_playerProfile_unique", unique: true, partialFilterExpression: { playerProfile: { $type: "objectId" } } });

export default mongoose.model(
  "User",
  userSchema
);
