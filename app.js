const path = require("path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const flash = require("connect-flash");
const csurf = require("csurf");

const initializePassport = require("./config/passport");
const indexRoutes = require("./routes/index");
const authRoutes = require("./routes/auth");
const sportsRoutes = require("./routes/sports");
const adminSessionsRoutes = require("./routes/adminSessions");
const playerSessionsRoutes = require("./routes/playerSessions");
const adminReportsRoutes = require("./routes/adminReports");
const notificationsRoutes = require("./routes/notifications");

const app = express();

// Initialize Passport Local Strategy
initializePassport(passport);

// Middleware for parsing URL-encoded bodies and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// View engine setup (EJS)
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Configure express-session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_sports_scheduler_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages middleware
app.use(flash());

// CSRF Protection (enabled for non-test environments)
if (process.env.NODE_ENV !== "test") {
  app.use(csurf());
}

// Make user, flash messages, CSRF token, and unread notifications count accessible in all views
app.use(async (req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.messages = {
    error: req.flash("error"),
    success: req.flash("success")
  };
  res.locals.csrfToken = typeof req.csrfToken === "function" ? req.csrfToken() : "";

  let unreadNotificationsCount = 0;
  if (req.user) {
    try {
      const { Notification } = require("./models");
      unreadNotificationsCount = await Notification.count({
        where: { userId: req.user.id, read: false }
      });
    } catch (err) {
      unreadNotificationsCount = 0;
    }
  }
  res.locals.unreadNotificationsCount = unreadNotificationsCount;
  next();
});

// Mount application routes
app.use("/", indexRoutes);
app.use("/", authRoutes);
app.use("/admin/sports", sportsRoutes);
app.use("/admin/sessions", adminSessionsRoutes);
app.use("/admin/reports", adminReportsRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/", playerSessionsRoutes);

module.exports = app;
