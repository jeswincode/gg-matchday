import mongoose from "mongoose";
import { companionOptions } from "../../shared/companion.js";

const userSchema =
  new mongoose.Schema(
    {
      companion: {
        type: new mongoose.Schema(Object.fromEntries(Object.entries(companionOptions).map(
          ([key, values]) => [key, { type: String, enum: values }],
        )), { _id: false }),
      },
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

userSchema.index({ playerProfile: 1 });

export default mongoose.model(
  "User",
  userSchema
);
