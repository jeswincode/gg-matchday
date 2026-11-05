import express from "express";
import User from "../models/User.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL || user.profileImage || "",
        role: user.role,
        platformRole: user.platformRole || "user",
        emailVerified: user.emailVerified === true,
        accessRequest: user.accessRequest || "none",
        playerProfile: user.playerProfile || null,
      },
    });
  } catch (error) {
    console.error("GET /auth/me error:", error);
    res.status(500).json({ message: "Failed to load account." });
  }
});

router.post("/request-editor", requireAuth, (_req, res) => {
  return res.status(410).json({
    message: "GG World access is administrator-managed. Ask a platform administrator to link your verified Gmail address.",
    code: "WORLD_ACCESS_ADMIN_MANAGED",
  });
});

router.get("/admin/requests", requireAuth, requireAdmin, async (req, res) => {
  try {
    const requests = await User.find({ accessRequest: "pending" })
      .select("_id name email photoURL profileImage playerProfile role accessRequest createdAt")
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error("Load editor requests error:", error);
    res.status(500).json({ message: "Failed to load editor requests." });
  }
});

router.get("/admin/editors", requireAuth, requireAdmin, async (req, res) => {
  try {
    const editors = await User.find({ role: "editor" })
      .select("_id name email photoURL profileImage playerProfile role accessRequest createdAt updatedAt")
      .sort({ name: 1 });
    res.json(editors);
  } catch (error) {
    console.error("Load editors error:", error);
    res.status(500).json({ message: "Failed to load editors." });
  }
});

router.post("/admin/requests/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.role === "admin") return res.status(400).json({ message: "Admin accounts cannot be changed here." });
    user.role = "editor";
    user.accessRequest = "none";
    await user.save();
    res.json({ message: `${user.name || user.email} is now an editor.`, user });
  } catch (error) {
    console.error("Approve editor error:", error);
    res.status(500).json({ message: "Failed to approve editor request." });
  }
});

router.post("/admin/requests/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.role === "admin") return res.status(400).json({ message: "Admin accounts cannot be changed here." });
    user.accessRequest = "rejected";
    await user.save();
    res.json({ message: `Editor request from ${user.name || user.email} rejected.`, user });
  } catch (error) {
    console.error("Reject editor error:", error);
    res.status(500).json({ message: "Failed to reject editor request." });
  }
});

router.post("/admin/editors/:id/revoke", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.role === "admin") return res.status(400).json({ message: "Admin accounts cannot be demoted." });
    if (user.role !== "editor") return res.status(400).json({ message: "This user is not an active editor." });
    user.role = "viewer";
    user.accessRequest = "none";
    await user.save();
    res.json({ message: `${user.name || user.email} has been moved back to viewer.`, user });
  } catch (error) {
    console.error("Revoke editor error:", error);
    res.status(500).json({ message: "Failed to revoke editor access." });
  }
});

export default router;
