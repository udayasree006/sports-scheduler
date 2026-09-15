const express = require("express");
const { Op } = require("sequelize");
const { Session, Sport, User, Participant } = require("../models");
const { requireLogin, requireRole } = require("../middleware/auth");

const router = express.Router();

// Enforce admin authorization for reports
router.use(requireLogin);
router.use(requireRole("admin"));

// GET /admin/reports - Admin Reports Dashboard
router.get("/", async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let dateWhere = {};
    let dateError = null;

    if (startDate && endDate && startDate > endDate) {
      dateError = "Start date cannot be after end date.";
    } else {
      if (startDate && endDate) {
        dateWhere.date = { [Op.between]: [startDate, endDate] };
      } else if (startDate) {
        dateWhere.date = { [Op.gte]: startDate };
      } else if (endDate) {
        dateWhere.date = { [Op.lte]: endDate };
      }
    }

    // Merge any route validation error with existing flash messages
    const errorMessages = res.locals.messages && res.locals.messages.error ? [...res.locals.messages.error] : [];
    if (dateError) {
      errorMessages.push(dateError);
      dateWhere = {};
    }

    const sessions = await Session.findAll({
      where: dateWhere,
      include: [
        { model: Sport, as: "sport" },
        { model: User, as: "creator", attributes: ["id", "first_name", "email"] },
        { model: Participant, as: "participants" }
      ],
      order: [
        ["date", "DESC"],
        ["time", "DESC"]
      ]
    });

    // Summary Card Stats
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.status === "completed");
    const cancelledSessions = sessions.filter((s) => s.status === "cancelled");
    const scheduledSessions = sessions.filter((s) => s.status === "scheduled");

    const totalParticipants = sessions.reduce(
      (sum, s) => sum + (s.participants ? s.participants.length : 0),
      0
    );

    // Completed Sessions by Sport Breakdown
    const completedBySportMap = {};
    completedSessions.forEach((s) => {
      const sportName = s.sport ? s.sport.name : "Unknown";
      completedBySportMap[sportName] = (completedBySportMap[sportName] || 0) + 1;
    });

    // Sport Popularity Aggregation
    const sportPopularityMap = {};
    sessions.forEach((s) => {
      const sportName = s.sport ? s.sport.name : "Unknown";
      if (!sportPopularityMap[sportName]) {
        sportPopularityMap[sportName] = {
          sportName,
          sessionCount: 0,
          totalParticipants: 0
        };
      }
      sportPopularityMap[sportName].sessionCount += 1;
      sportPopularityMap[sportName].totalParticipants += s.participants ? s.participants.length : 0;
    });

    const sportPopularityList = Object.values(sportPopularityMap)
      .sort((a, b) => {
        if (b.totalParticipants !== a.totalParticipants) {
          return b.totalParticipants - a.totalParticipants;
        }
        return b.sessionCount - a.sessionCount;
      })
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    res.render("admin/reports", {
      title: "Admin Reports - Sports Scheduler",
      startDate: startDate || "",
      endDate: endDate || "",
      messages: {
        error: errorMessages,
        success: res.locals.messages ? res.locals.messages.success : []
      },
      totalSessions,
      completedCount: completedSessions.length,
      cancelledCount: cancelledSessions.length,
      scheduledCount: scheduledSessions.length,
      totalParticipants,
      completedSessions,
      completedBySportMap,
      sportPopularityList,
      hasSessions: totalSessions > 0
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
