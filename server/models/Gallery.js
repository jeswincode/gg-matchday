import mongoose from "mongoose";

const gallerySchema =
  new mongoose.Schema(
    {
      playerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
      imageUrl: {
        type: String,
        required: true,
        trim: true,
      },

      caption: {
        type: String,
        default: "",
        trim: true,
        maxlength: 160,
      },

      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      // Kept for display/audit compatibility with existing gallery records.
      uploadedByName: {
        type: String,
        default: "",
        maxlength: 120,
      },

      uploadedByEmail: {
        type: String,
        default: "",
        maxlength: 180,
      },

      matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match",
        default: null,
      },

      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player",
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

gallerySchema.index({ createdAt: -1 });
gallerySchema.index({ playerId: 1, createdAt: -1 });
gallerySchema.index({ matchId: 1, createdAt: -1 });

export default mongoose.model(
  "Gallery",
  gallerySchema
);
