import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { answerAssistant } from "../services/ggAssistant.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const result = await answerAssistant({
      message,
      viewerPlayerId: req.user?.playerProfile || null,
      rateLimitKey: String(req.user?._id || req.ip),
    });
    return res.json(result);
  } catch (error) {
    console.error("GG Assistant request failed:", error);
    const status = /between 1 and 1000|wait a minute/.test(String(error?.message || "")) ? 429 : 400;
    return res.status(status).json({ message: error?.message || "GG Assistant could not answer right now." });
  }
});

export default router;
