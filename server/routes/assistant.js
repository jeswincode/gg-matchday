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
      conversationContext: Array.isArray(req.body?.context) ? req.body.context.slice(-8) : [],
      conversationHistory: Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [],
    });
    return res.json({ ...result, trace: { lane: result.generatedBy || "fallback", structured: Boolean(result.type), contextCount: Array.isArray(req.body?.context) ? Math.min(req.body.context.length, 8) : 0, historyCount: Array.isArray(req.body?.history) ? Math.min(req.body.history.length, 12) : 0 } });
  } catch (error) {
    console.error("GG Assistant request failed:", error);
    const status = /between 1 and 1000|wait a minute/.test(String(error?.message || "")) ? 429 : 400;
    return res.status(status).json({ message: error?.message || "GG Assistant could not answer right now." });
  }
});

export default router;
