import mongoose from "mongoose";
import { getClubsConnection } from "../../config/clubsDatabase.js";

const attendeeSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
  response: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
  attendance: { type: String, enum: ["unmarked", "present", "absent"], default: "unmarked" },
  respondedAt: { type: Date, default: null },
  markedAt: { type: Date, default: null },
}, { _id: false });

const clubTrainingSessionSchema = new mongoose.Schema({
  clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
  focus: {
    type: String,
    enum: ["passing", "possession", "pressing", "finishing", "set-pieces", "tactical"],
    required: true,
  },
  notes: { type: String, trim: true, maxlength: 280, default: "" },
  scheduledAt: { type: Date, required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
  attendees: {
    type: [attendeeSchema],
    validate: {
      validator: value => Array.isArray(value) && value.length >= 1 && value.length <= 5
        && new Set(value.map(item => String(item.playerId))).size === value.length,
      message: "A team session must invite one to five unique active Club members.",
    },
  },
  status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled", index: true },
  completedAt: { type: Date, default: null },
}, { timestamps: true, collection: "clubTrainingSessions", optimisticConcurrency: true });

clubTrainingSessionSchema.index({ clubId: 1, scheduledAt: -1 });
clubTrainingSessionSchema.index({ "attendees.playerId": 1, status: 1 });

export default getClubsConnection().model("ClubTrainingSession", clubTrainingSessionSchema);
