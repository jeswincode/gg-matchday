import mongoose from "mongoose";
import { worldDataScopePlugin } from "../services/worldDataScope.js";

const newsSchema = new mongoose.Schema(
  {
    worldId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "World",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "match",
        "milestone",
        "player",
        "ranking",
      ],
      default: "match",
    },

    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      default: null,
    },

    featuredPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },

    headline: {
      type: String,
      required: true,
      trim: true,
    },

    summary: {
      type: String,
      required: true,
      trim: true,
    },

    body: {
      type: String,
      default: "",
      trim: true,
    },

    icon: {
      type: String,
      default: "⚽",
    },

    tags: {
      type: [String],
      default: [],
    },

    generatedBy: {
      type: String,
      enum: ["gemini", "fallback"],
      default: "fallback",
    },
  },
  {
    timestamps: true,
  }
);

newsSchema.index({ worldId: 1, createdAt: -1 });

newsSchema.index({ worldId: 1, match: 1 });

newsSchema.plugin(worldDataScopePlugin);

export default mongoose.model(
  "News",
  newsSchema
);