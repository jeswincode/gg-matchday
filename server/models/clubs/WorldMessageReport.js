import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const worldMessageReportSchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: "WorldMessage", required: true, index: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true, index: true },
  reason: { type: String, enum: ["spam", "harassment", "inappropriate", "other"], default: "other" },
  reviewStatus: { type: String, enum: ["open", "resolved"], default: "open", index: true },
  resolution: { type: String, enum: ["hidden", "restored", "dismissed"], default: undefined },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  reviewedAt: { type: Date, default: null },
  adminNote: { type: String, trim: true, maxlength: 300, default: "" },
}, { timestamps: true, collection: "worldMessageReports" });

worldMessageReportSchema.index({ messageId: 1, playerId: 1 }, { unique: true });
worldMessageReportSchema.index({ reviewStatus: 1, createdAt: -1 });
export default getClubsConnection().model("WorldMessageReport", worldMessageReportSchema);
