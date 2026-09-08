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