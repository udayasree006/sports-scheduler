const express = require("express");
const { requireLogin, requireRole } = require("../middleware/auth");
const router = express.Router();

// Basic Homepage Route
router.get("/", (req, res) => {
  res.render("index", {
    title: "Sports Scheduler - Home",
    user: req.user || null,
    csrfToken: typeof req.csrfToken === "function" ? req.csrfToken() : ""
  });
});

// Protected Route Example (Requires Login)
router.get("/protected", requireLogin, (req, res) => {
  res.send("Protected Page Content");
});

// Admin-only Route Example (Requires Admin Role)
router.get("/admin-dashboard", requireRole("admin"), (req, res) => {
  res.send("Admin Dashboard Content");
});

module.exports = router;
