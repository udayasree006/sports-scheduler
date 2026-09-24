const express = require("express");
const { Session, Sport, User, Participant, Notification } = require("../models");
const { requireLogin, requireRole } = require("../middleware/auth");

const router = express.Router();

// Enforce admin login and role authorization on all /admin/sessions routes
router.use(requireLogin);
router.use(requireRole("admin"));

// Helper function to check if a date+time is in the past
function isPastDateTime(dateStr, timeStr) {
  const sessionDateTime = new Date(`${dateStr}T${timeStr}`);
  const now = new Date();
  return sessionDateTime < now;
}

// GET /admin/sessions - List all sessions
router.get("/", async (req, res, next) => {
  try {
    const sessions = await Session.findAll({
      include: [
        { model: Sport, as: "sport" },
        { model: User, as: "creator", attributes: ["id", "first_name", "email"] }
      ],
      order: [["id", "DESC"]]
    });

    res.render("admin/sessions/index", {
      title: "Manage Sessions - Admin",
      sessions
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/sessions/new - Render Create Session Form
router.get("/new", async (req, res, next) => {
  try {
    const activeSports = await Sport.findAll({
      where: { active: true },
      order: [["name", "ASC"]]
    });

    res.render("admin/sessions/new", {
      title: "Create New Session - Admin",
      sports: activeSports
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/sessions - Handle Session Creation
router.post("/", async (req, res, next) => {
  try {
    const {
      sportId,
      date,
      time,
      venue,
      additionalPlayersNeeded,
      team1Name,
      team1Players,
      team2Name,
      team2Players
    } = req.body;
    const trimmedVenue = venue ? venue.trim() : "";
    const playersCount = parseInt(additionalPlayersNeeded, 10);

    // 1. Validate required fields
    if (!sportId || !date || !time || !trimmedVenue || isNaN(playersCount)) {
      req.flash("error", "All fields are required.");
      return res.redirect("/admin/sessions/new");
    }

    // 2. Validate non-negative players needed
    if (playersCount < 0) {
      req.flash("error", "Additional players needed must be a non-negative integer.");
      return res.redirect("/admin/sessions/new");
    }

    // 3. Validate sport exists and is active
    const sport = await Sport.findByPk(sportId);
    if (!sport || !sport.active) {
      req.flash("error", "Selected sport does not exist or is inactive.");
      return res.redirect("/admin/sessions/new");
    }

    // 4. Validate session date/time is not in the past
    if (isPastDateTime(date, time)) {
      req.flash("error", "Session date and time cannot be in the past.");
      return res.redirect("/admin/sessions/new");
    }

    // 5. Create session
    await Session.create({
      sportId: sport.id,
      creatorId: req.user.id,
      date,
      time,
      venue: trimmedVenue,
      additionalPlayersNeeded: playersCount,
      status: "scheduled",
      team1Name: team1Name ? team1Name.trim() : "",
      team1Players: team1Players || [],
      team2Name: team2Name ? team2Name.trim() : "",
      team2Players: team2Players || []
    });

    req.flash("success", "Session created successfully.");
    return res.redirect("/admin/sessions");
  } catch (err) {
    next(err);
  }
});

// GET /admin/sessions/:id - View Session Details
router.get("/:id", async (req, res, next) => {
  try {
    const sessionItem = await Session.findByPk(req.params.id, {
      include: [
        { model: Sport, as: "sport" },
        { model: User, as: "creator", attributes: ["id", "first_name", "email"] },
        {
          model: Participant,
          as: "participants",
          include: [{ model: User, as: "user", attributes: ["id", "first_name", "email"] }]
        }
      ]
    });

    if (!sessionItem) {
      req.flash("error", "Session not found.");
      return res.redirect("/admin/sessions");
    }

    res.render("admin/sessions/show", {
      title: `Session Details #${sessionItem.id} - Admin`,
      sessionItem
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/sessions/:id/edit - Render Edit Session Form
router.get("/:id/edit", async (req, res, next) => {
  try {
    const sessionItem = await Session.findByPk(req.params.id, {
      include: [{ model: Sport, as: "sport" }]
    });

    if (!sessionItem) {
      req.flash("error", "Session not found.");
      return res.redirect("/admin/sessions");
    }

    if (sessionItem.status !== "scheduled") {
      req.flash("error", "Cannot edit a cancelled or completed session.");
      return res.redirect("/admin/sessions");
    }

    const activeSports = await Sport.findAll({
      where: { active: true },
      order: [["name", "ASC"]]
    });

    res.render("admin/sessions/edit", {
      title: `Edit Session #${sessionItem.id} - Admin`,
      sessionItem,
      sports: activeSports
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/sessions/:id - Handle Session Update
router.post("/:id", async (req, res, next) => {
  try {
    const sessionItem = await Session.findByPk(req.params.id);

    if (!sessionItem) {
      req.flash("error", "Session not found.");
      return res.redirect("/admin/sessions");
    }

    if (sessionItem.status !== "scheduled") {
      req.flash("error", "Cannot edit a cancelled or completed session.");
      return res.redirect("/admin/sessions");
    }

    const {
      sportId,
      date,
      time,
      venue,
      additionalPlayersNeeded,
      team1Name,
      team1Players,
      team2Name,
      team2Players
    } = req.body;
    const trimmedVenue = venue ? venue.trim() : "";
    const playersCount = parseInt(additionalPlayersNeeded, 10);

    // 1. Validate required fields
    if (!sportId || !date || !time || !trimmedVenue || isNaN(playersCount)) {
      req.flash("error", "All fields are required.");
      return res.redirect(`/admin/sessions/${sessionItem.id}/edit`);
    }

    // 2. Validate non-negative players needed
    if (playersCount < 0) {
      req.flash("error", "Additional players needed must be a non-negative integer.");
      return res.redirect(`/admin/sessions/${sessionItem.id}/edit`);
    }

    // 3. Validate sport exists and is active
    const sport = await Sport.findByPk(sportId);
    if (!sport || !sport.active) {
      req.flash("error", "Selected sport does not exist or is inactive.");
      return res.redirect(`/admin/sessions/${sessionItem.id}/edit`);
    }

    // 4. Validate session date/time is not in the past
    if (isPastDateTime(date, time)) {
      req.flash("error", "Session date and time cannot be in the past.");
      return res.redirect(`/admin/sessions/${sessionItem.id}/edit`);
    }

    sessionItem.sportId = sport.id;
    sessionItem.date = date;
    sessionItem.time = time;
    sessionItem.venue = trimmedVenue;
    sessionItem.additionalPlayersNeeded = playersCount;
    sessionItem.team1Name = team1Name ? team1Name.trim() : "";
    sessionItem.team1Players = team1Players || [];
    sessionItem.team2Name = team2Name ? team2Name.trim() : "";
    sessionItem.team2Players = team2Players || [];

    await sessionItem.save();

    req.flash("success", "Session updated successfully.");
    return res.redirect("/admin/sessions");
  } catch (err) {
    next(err);
  }
});

// POST /admin/sessions/:id/cancel - Handle Session Cancellation
router.post("/:id/cancel", async (req, res, next) => {
  try {
    const sessionItem = await Session.findByPk(req.params.id);

    if (!sessionItem) {
      req.flash("error", "Session not found.");
      return res.redirect("/admin/sessions");
    }

    if (sessionItem.status !== "scheduled") {
      req.flash("error", "Only scheduled sessions can be cancelled.");
      return res.redirect(`/admin/sessions/${sessionItem.id}`);
    }

    sessionItem.status = "cancelled";
    await sessionItem.save();

    // Create notifications for all participants
    try {
      const sport = await Sport.findByPk(sessionItem.sportId);
      const sportName = sport ? sport.name.toLowerCase() : "sports";
      const participants = await Participant.findAll({
        where: { sessionId: sessionItem.id }
      });

      const cancelMessage = `The ${sportName} session on ${sessionItem.date} at ${sessionItem.time} has been cancelled.`;

      for (const p of participants) {
        await Notification.create({
          userId: p.userId,
          message: cancelMessage,
          type: "session_cancelled",
          read: false
        });
      }
    } catch (notifyErr) {
      console.error("Notification creation error:", notifyErr);
    }

    req.flash("success", "Session cancelled successfully.");
    return res.redirect("/admin/sessions");
  } catch (err) {
    next(err);
  }
});

// POST /admin/sessions/:id/complete - Admin marks session as completed
router.post("/:id/complete", async (req, res, next) => {
  try {
    const sessionItem = await Session.findByPk(req.params.id);

    if (!sessionItem) {
      req.flash("error", "Session not found.");
      return res.redirect("/admin/sessions");
    }

    if (sessionItem.status === "completed") {
      req.flash("error", "Session is already completed.");
      return res.redirect(`/admin/sessions/${sessionItem.id}`);
    }

    if (sessionItem.status === "cancelled") {
      req.flash("error", "Cannot complete a cancelled session.");
      return res.redirect(`/admin/sessions/${sessionItem.id}`);
    }

    sessionItem.status = "completed";
    await sessionItem.save();

    // Create notifications for all participants
    try {
      const sport = await Sport.findByPk(sessionItem.sportId);
      const sportName = sport ? sport.name.toLowerCase() : "sports";
      const participants = await Participant.findAll({
        where: { sessionId: sessionItem.id }
      });

      const completeMessage = `The ${sportName} session on ${sessionItem.date} at ${sessionItem.time} has been completed.`;

      for (const p of participants) {
        await Notification.create({
          userId: p.userId,
          message: completeMessage,
          type: "session_completed",
          read: false
        });
      }
    } catch (notifyErr) {
      console.error("Notification creation error:", notifyErr);
    }

    req.flash("success", "Session marked as completed.");
    return res.redirect(`/admin/sessions/${sessionItem.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
