import mongoose from "mongoose";
import { worldDataScopePlugin } from "../services/worldDataScope.js";

const profileChangeRequestSchema =
  new mongoose.Schema(
    {
      worldId: { type: mongoose.Schema.Types.ObjectId, ref: "World", default: null, index: true },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player",
        required: true,
        index: true,
      },

      changes: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },

      before: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "approved",
          "rejected",
        ],
        default: "pending",
        index: true,
      },

      rejectionReason: {
        type: String,
        trim: true,
        maxlength: 300,
        default: "",
      },

      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      reviewedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

profileChangeRequestSchema.index({ worldId: 1, requestedBy: 1 }, { name: "profile_request_world_pending_unique", unique: true, partialFilterExpression: { status: "pending" } });
profileChangeRequestSchema.plugin(worldDataScopePlugin);

export default mongoose.model(
  "ProfileChangeRequest",
  profileChangeRequestSchema
);
