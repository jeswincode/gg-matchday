import mongoose from "mongoose";

const playerSchema = new mongoose.Schema(
  {
    preferredPositions: { type: [String], default: [] },
    clasicoSide: { type: String, enum: ["", "Messi", "Ronaldo"], default: "" },
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    profileImage: {
      type: String,
      trim: true,
      default: "",
    },

    backgroundVideoUrl: {
      type: String,
      trim: true,
      default: "",
    },

    height: {
      type: Number,
      min: 0,
      max: 250,
      default: null,
    },

    weight: {
      type: Number,
      min: 0,
      max: 300,
      default: null,
    },

    // Admin-recorded football attributes used by the OVR engine.
    // They intentionally remain nullable until an administrator has
    // properly evaluated the player.
    pace: {
      type: Number,
      min: 1,
      max: 99,
      default: null,
    },

    physical: {
      type: Number,
      min: 1,
      max: 99,
      default: null,
    },

    // Derived OVR snapshot. Match history remains the source of truth;
    // this snapshot is a cache so Club pages do not repeatedly rebuild
    // a player's complete history when nothing has changed.
    ovrSnapshot: {
      currentOvr: { type: Number, min: 1, max: 99, default: null },
      careerOvr: { type: Number, min: 1, max: 99, default: null },
      confidence: { type: Number, min: 0, max: 100, default: 0 },
      matchesPlayed: { type: Number, min: 0, default: 0 },
      ratedMatches: { type: Number, min: 0, default: 0 },
      currentWindowMatches: { type: Number, min: 0, default: 0 },
      currentAttributes: {
        pace: { type: Number, min: 1, max: 99, default: null },
        shooting: { type: Number, min: 1, max: 99, default: null },
        passing: { type: Number, min: 1, max: 99, default: null },
        dribbling: { type: Number, min: 1, max: 99, default: null },
        defending: { type: Number, min: 1, max: 99, default: null },
        physical: { type: Number, min: 1, max: 99, default: null },
      },
      careerAttributes: {
        pace: { type: Number, min: 1, max: 99, default: null },
        shooting: { type: Number, min: 1, max: 99, default: null },
        passing: { type: Number, min: 1, max: 99, default: null },
        dribbling: { type: Number, min: 1, max: 99, default: null },
        defending: { type: Number, min: 1, max: 99, default: null },
        physical: { type: Number, min: 1, max: 99, default: null },
      },
      positionRatings: { type: mongoose.Schema.Types.Mixed, default: {} },
      calculatedAt: { type: Date, default: null },
      sourceUpdatedAt: { type: Date, default: null },
    },

    position: {
      type: String,
      trim: true,
      default: "",
    },

    preferredFoot: {
      type: String,
      enum: ["Left", "Right", "Both", ""],
      default: "",
    },

    jerseyNumber: {
      type: Number,
      min: 0,
      max: 99,
      default: null,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Player", playerSchema);