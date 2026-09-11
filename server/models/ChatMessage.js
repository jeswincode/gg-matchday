import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    photo: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

// MongoDB automatically removes expired messages. The API also filters on
// expiresAt so expiration is enforced immediately even before the TTL monitor runs.
chatMessageSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);
chatMessageSchema.index({ createdAt: -1 });

export default mongoose.model("ChatMessage", chatMessageSchema);
