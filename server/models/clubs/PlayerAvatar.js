import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const appearanceSchema = new mongoose.Schema({
  skinTone: { type: String, enum: ["deep", "dark", "medium", "tan", "light", "fair"], default: "medium" },
  hairStyle: { type: String, enum: ["short", "fade", "curly", "long", "afro", "mohawk", "bald"], default: "short" },
  hairColor: { type: String, enum: ["black", "brown", "blonde", "red", "silver", "blue"], default: "black" },
  kitPrimary: { type: String, enum: ["black", "white", "gold", "red", "blue", "green", "purple", "orange"], default: "black" },
  kitSecondary: { type: String, enum: ["black", "white", "gold", "red", "blue", "green", "purple", "orange"], default: "gold" },
  bootColor: { type: String, enum: ["black", "white", "gold", "red", "blue", "green", "orange"], default: "white" },
}, { _id: false });

const playerAvatarSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, unique: true, index: true },
    displayName: { type: String, trim: true, maxlength: 24, default: "" },
    appearance: { type: appearanceSchema, default: () => ({}) },
    tutorialComplete: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "playerAvatars" },
);

export default getClubsConnection().model("PlayerAvatar", playerAvatarSchema);
