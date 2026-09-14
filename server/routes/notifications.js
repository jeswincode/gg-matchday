import express from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import Notification from "../models/Notification.js";

const router = express.Router();
const lifetime = 5 * 24 * 60 * 60 * 1000;

router.use(requireAuth);

function serialize(notification, userId) {
  const id = String(userId);
  return {
    id: String(notification._id),
    title: notification.title,
    message: notification.message,
    authorName: notification.authorName,
    createdAt: new Date(notification.createdAt).getTime(),
    expiresAt: new Date(notification.expiresAt).getTime(),
    read: (notification.readBy || []).some(value => String(value) === id),
  };
}

async function removeExpired() {
  await Notification.deleteMany({ expiresAt: { $lte: new Date() } });
}

router.get("/", async (req, res) => {
  try {
    await removeExpired();
    const notifications = await Notification.find({ expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({
      notifications: notifications.map(item => serialize(item, req.user._id)),
      unread: notifications.some(item => !(item.readBy || []).some(value => String(value) === String(req.user._id))),
      expiresSeconds: lifetime / 1000,
    });
  } catch (error) {
    console.error("Notification history error:", error);
    res.status(500).json({ message: "Could not load notifications." });
  }
});

router.post("/:id/read", async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, expiresAt: { $gt: new Date() } },
      { $addToSet: { readBy: req.user._id } },
      { new: true }
    ).lean();
    if (!notification) return res.status(404).json({ message: "Notification not found." });
    res.json({ notification: serialize(notification, req.user._id) });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(400).json({ message: "Could not mark notification as read." });
  }
});

router.post("/read-all", async (req, res) => {
  try {
    await removeExpired();
    await Notification.updateMany(
      { expiresAt: { $gt: new Date() } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ message: "Could not mark notifications as read." });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const message = String(req.body.message || "").trim();
    if (!title || title.length > 120) return res.status(400).json({ message: "Title must be between 1 and 120 characters." });
    if (!message || message.length > 1000) return res.status(400).json({ message: "Message must be between 1 and 1000 characters." });
    const now = new Date();
    const notification = await Notification.create({
      title,
      message,
      authorName: req.user.name,
      createdAt: now,
      expiresAt: new Date(now.getTime() + lifetime),
      readBy: [],
    });
    res.status(201).json({ notification: serialize(notification, req.user._id) });
  } catch (error) {
    console.error("Create notification error:", error);
    res.status(400).json({ message: "Could not create notification." });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await Notification.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Notification not found." });
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(400).json({ message: "Could not delete notification." });
  }
});

export default router;
