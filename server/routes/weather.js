import express from "express";
import { getWeather } from "../services/weather.js";
const router = express.Router();
router.get("/", async (req, res) => {
  try {
    const weather = await getWeather(req.query.city || undefined);
    if (!weather) return res.status(404).json({ message: "Weather location could not be resolved." });
    return res.json(weather);
  } catch (error) {
    console.error("Weather error:", error);
    return res.status(502).json({ message: "Weather is temporarily unavailable." });
  }
});
export default router;
