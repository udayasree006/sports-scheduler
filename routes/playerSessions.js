const express = require("express");
const { Op } = require("sequelize");
const { Session, Sport, User, Participant, Notification } = require("../models");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();

// Enforce login for all player session routes
router.use(requireLogin);

// Helper function to check if session date/time has passed
function isPastDateTime(dateStr, timeStr) {
  const sessionDateTime = new Date(`${dateStr}T${timeStr}`);
  const now = new Date();
  return sessionDateTime < now;
}

// GET /sessions - List upcoming scheduled sessions for players
router.get("/sessions", async (req, res, next) => {
  try {
    const allScheduledSessions = await Session.findAll({
      where: { status: "scheduled" },
      include: [
        { model: Sport, as: "sport" },
        { model: User, as: "creator", attributes: ["id", "first_name", "email"] },
        { model: Participant, as: "participants" }
      ],
      order: [
        ["date", "ASC"],
        ["time", "ASC"]
      ]
    });

    // Filter out past sessions
    const upcomingSessions = allScheduledSessions.filter(
      (s) => !isPastDateTime(s.date, s.time)
    );

    res.render("sessions/index", {
      title: "Upcoming Sports Sessions - Sports Scheduler",
      sessions: upcomingSessions
    });
  } catch (err) {
    next(err);
  }
});

// GET /sessions/new - Render Create Session Form for Players
router.get("/sessions/new", async (req, res, next) => {
  try {
    const activeSports = await Sport.findAll({
      where: { active: true },
      order: [["name", "ASC"]]
    });

    res.render("sessions/new", {
      title: "Create Sports Session - Sports Scheduler",
      sports: activeSports
    });
  } catch (err) {
    next(err);
  }
});

// POST /sessions - Create Session by Logged-in Player
router.post("/sessions", async (req, res, next) => {
  try {
    const { sportId, date, time, venue, additionalPlayersNeeded } = req.body;
    const trimmedVenue = venue ? venue.trim() : "";
    const playersCount = parseInt(additionalPlayersNeeded, 10);

    // 1. Validate required fields
    if (!sportId || !date || !time || !trimmedVenue || isNaN(playersCount)) {
      req.flash("error", "All fields are required.");
      return res.redirect("/sessions/new");
    }

    // 2. Validate non-negative players needed
    if (playersCount < 0) {
      req.flash("error", "Additional players needed must be a non-negative integer.");
      return res.redirect("/sessions/new");
    }

    // 3. Validate sport exists and is active
    const sport = await Sport.findByPk(sportId);
    if (!sport || !sport.active) {
      req.flash("error", "Selected sport does not exist or is inactive.");
      return res.redirect("/sessions/new");
    }

    // 4. Validate date/time in the future
    if (isPastDateTime(date, time)) {
      req.flash("error", "Session date and time cannot be in the past.");
      return res.redirect("/sessions/new");
    }

    // 5. Create session setting creatorId to req.user.id and status to scheduled
    const newSession = await Session.create({
      sportId: sport.id,
      creatorId: req.user.id,
      date,
      time,
      venue: trimmedVenue,
      additionalPlayersNeeded: playersCount,
      status: "scheduled"
    });

    req.flash("success", "Session created successfully.");
    return res.redirect(`/sessions/${newSession.id}`);
  } catch (err) {
    next(err);
  }
});

// GET /my-sessions - View sessions created by current user
router.get("/my-sessions", async (req, res, next) => {
  try {
    const mySessions = await Session.findAll({
      where: { creatorId: req.user.id },
      include: [
        { model: Sport, as: "sport" },
        { model: Participant, as: "participants" }
      ],
      order: [
        ["date", "ASC"],
        ["time", "ASC"]
      ]
    });

    res.render("sessions/my-sessions", {
      title: "My Created Sessions - Sports Scheduler",
      sessions: mySessions
    });
  } catch (err) {
    next(err);
  }
});

// GET /my-joined-sessions - View sessions joined by current user
router.get("/my-joined-sessions", async (req, res, next) => {
  try {
    const participations = await Participant.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Session,
          as: "session",
          include: [
            { model: Sport, as: "sport" },
            { model: User, as: "creator", attributes: ["id", "first_name", "email"] },
            { model: Participant, as: "participants" }
          ]
        }
      ]
    });

    const joinedSessions = participations
      .map((p) => p.session)
      .filter((s) => s !== null)
      .sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time}`);
        const dateTimeB = new Date(`${b.date}T${b.time}`);
        return dateTimeA - dateTimeB;
      });

    res.render("sessions/my-joined-sessions", {
      title: "My Joined Sessions - Sports Scheduler",
      sessions: joinedSessions
    });
  } catch (err) {
    next(err);
  }
});

// GET /sessions/:id - View session details
router.get("/sessions/:id", async (req, res, next) => {
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
      req.flash("error", "Invalid session.");
      return res.redirect("/sessions");
    }

    const isCreator = sessionItem.creatorId === req.user.id;
    const hasJoined = sessionItem.participants.some(
      (p) => p.userId === req.user.id
    );

    const isPast = isPastDateTime(sessionItem.date, sessionItem.time);

    res.render("sessions/show", {
      title: `Session #${sessionItem.id} Details - Sports Scheduler`,
      sessionItem,
      isCreator,
      hasJoined,
      isPast
    });
  } catch (err) {
    next(err);
  }
});

// POST /sessions/:id/join - Join a session
router.post("/sessions/:id/join", async (req, res, next) => {
  try {
    const sessionItem = await Session.findByPk(req.params.id, {
      include: [{ model: Participant, as: "participants" }]
    });

    // 1. Invalid session check
    if (!sessionItem) {
      req.flash("error", "Invalid session.");
      return res.redirect("/sessions");
    }

    // 2. Cancelled session check
    if (sessionItem.status === "cancelled") {
      req.flash("error", "Session is cancelled.");
      return res.redirect(`/sessions/${sessionItem.id}`);
    }

    // 3. Completed session check
    if (sessionItem.status === "completed") {
      req.flash("error", "Cannot join a completed session.");
      return res.redirect(`/sessions/${sessionItem.id}`);
    }

    // 4. Past session check
    if (isPastDateTime(sessionItem.date, sessionItem.time)) {
      req.flash("error", "Session has already started or passed.");
      return res.redirect(`/sessions/${sessionItem.id}`);
    }

    // 5. Duplicate participation check
    const alreadyJoined = sessionItem.participants.some(
      (p) => p.userId === req.user.id
    );
    if (alreadyJoined) {
      req.flash("error", "You have already joined this session.");
      return res.redirect(`/sessions/${sessionItem.id}`);
    }

    // 5b. Schedule conflict check: Player cannot join another session on the same date AND time
    const conflictingParticipation = await Participant.findOne({
      where: { userId: req.user.id },
      include: [
        {
          model: Session,
          as: "session",
          where: {
            date: sessionItem.date,
            time: sessionItem.time,
            status: "scheduled",
            id: { [Op.ne]: sessionItem.id }
          }
        }
      ]
    });

    if (conflictingParticipation) {
      req.flash(
        "error",
        "You cannot join this session because you already have another session scheduled at this date and time."
      );
      return res.redirect(`/sessions/${sessionItem.id}`);
    }

    // 6. Full session check
    if (sessionItem.additionalPlayersNeeded <= 0) {
      req.flash("error", "This session is full.");
      return res.redirect(`/sessions/${sessionItem.id}`);
    }

    // 7. Create participant record and decrease remaining slots
    await Participant.create({
      sessionId: sessionItem.id,
      userId: req.user.id
    });

    sessionItem.additionalPlayersNeeded -= 1;
    await sessionItem.save();

    // Notify session creator
    if (sessionItem.creatorId !== req.user.id) {
      try {
        const sport = await Sport.findByPk(sessionItem.sportId);
        const sportName = sport ? sport.name.toLowerCase() : "sports";
        await Notification.create({
          userId: sessionItem.creatorId,
          message: `${req.user.first_name} joined your ${sportName} session on ${sessionItem.date} at ${sessionItem.time}.`,
          type: "session_joined",
          read: false
        });
      } catch (notifyErr) {
        console.error("Notification creation error:", notifyErr);
      }
    }

    req.flash("success", "Successfully joined the session.");
    return res.redirect(`/sessions/${sessionItem.id}`);
  } catch (err) {
    next(err);
  }
});

// POST /sessions/:id/cancel - Player cancels their own created session
router.post("/sessions/:id/cancel", async (req, res, next) => {
  try {
    const sessionItem = await Session.findByPk(req.params.id);

    if (!sessionItem) {
      req.flash("error", "Invalid session.");
      return res.redirect("/sessions");
    }

    // Authorization check: Only session creator can cancel
    if (sessionItem.creatorId !== req.user.id) {
      req.flash("error", "You are not authorized to cancel this session.");
      return res.redirect(`/sessions/${sessionItem.id}`);
    }

    // Status check: Only scheduled sessions can be cancelled
    if (sessionItem.status !== "scheduled") {
      req.flash("error", "Only scheduled sessions can be cancelled.");
      return res.redirect(`/sessions/${sessionItem.id}`);
    }

    const { cancellationReason } = req.body;
    const trimmedReason = cancellationReason ? cancellationReason.trim() : null;

    if (trimmedReason && trimmedReason.length > 500) {
      req.flash("error", "Cancellation reason cannot exceed 500 characters.");
      return res.redirect(`/sessions/${sessionItem.id}`);
    }

    sessionItem.status = "cancelled";
    sessionItem.cancellationReason = trimmedReason || null;
    await sessionItem.save();

    // Create cancellation notifications for all participants
    try {
      const sport = await Sport.findByPk(sessionItem.sportId);
      const sportName = sport ? sport.name.toLowerCase() : "sports";
      const participants = await Participant.findAll({
        where: { sessionId: sessionItem.id }
      });

      const messageReason = trimmedReason ? ` Reason: ${trimmedReason}` : "";
      const cancelMessage = `The ${sportName} session on ${sessionItem.date} at ${sessionItem.time} was cancelled.${messageReason}`;

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
    return res.redirect(`/sessions/${sessionItem.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
