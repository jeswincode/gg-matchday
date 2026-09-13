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

      playerProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player",
        default: null,
      },

      role: {
        type: String,
        enum: [
          "viewer",
          "editor",
          "admin",
        ],
        default: "viewer",
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