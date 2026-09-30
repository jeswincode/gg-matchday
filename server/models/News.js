import mongoose from "mongoose";

const newsSchema = new mongoose.Schema(
  {
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

newsSchema.index({
  createdAt: -1,
});

newsSchema.index({
  match: 1,
});

export default mongoose.model(
  "News",
  newsSchema
);