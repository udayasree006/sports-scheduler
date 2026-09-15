const express = require("express");
const { Notification } = require("../models");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();

// Enforce login for all notification routes
router.use(requireLogin);

// GET /notifications - Display logged-in user's notifications (newest first)
router.get("/", async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [["createdAt", "DESC"]]
    });

    res.render("notifications/index", {
      title: "Notifications - Sports Scheduler",
      notifications
    });
  } catch (err) {
    next(err);
  }
});

// POST /notifications/:id/read - Mark individual notification as read (owner only)
router.post("/:id/read", async (req, res, next) => {
  try {
    const notification = await Notification.findByPk(req.params.id);

    if (!notification || notification.userId !== req.user.id) {
      req.flash("error", "Notification not found or access denied.");
      return res.redirect("/notifications");
    }

    notification.read = true;
    await notification.save();

    return res.redirect("/notifications");
  } catch (err) {
    next(err);
  }
});

// POST /notifications/read-all - Mark all notifications for current user as read
router.post("/read-all", async (req, res, next) => {
  try {
    await Notification.update(
      { read: true },
      { where: { userId: req.user.id, read: false } }
    );

    req.flash("success", "All notifications marked as read.");
    return res.redirect("/notifications");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
