const express = require("express");
const passport = require("passport");
const bcrypt = require("bcrypt");
const { User } = require("../models");

const router = express.Router();

// GET /signup - Render Signup Page
router.get("/signup", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect("/");
  }
  res.render("signup", { title: "Sign Up - Sports Scheduler" });
});

// POST /signup - Handle User Registration
router.post("/signup", async (req, res, next) => {
  try {
    const { first_name, email, password, confirmPassword } = req.body;

    // 1. Validate required fields
    if (!first_name || !email || !password || !confirmPassword) {
      req.flash("error", "All fields are required.");
      return res.redirect("/signup");
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.flash("error", "Please enter a valid email address.");
      return res.redirect("/signup");
    }

    // 3. Validate password match
    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match.");
      return res.redirect("/signup");
    }

    // 4. Check for duplicate email
    const existingUser = await User.findOne({
      where: { email: email.toLowerCase().trim() }
    });
    if (existingUser) {
      req.flash("error", "Email is already registered.");
      return res.redirect("/signup");
    }

    // 5. Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. Create user with default role 'player'
    await User.create({
      first_name: first_name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: "player"
    });

    req.flash("success", "Account created successfully! Please log in.");
    return res.redirect("/login");
  } catch (err) {
    console.error("Signup error details:", {
      name: err.name,
      message: err.message,
      originalMessage: err.original?.message,
      parentMessage: err.parent?.message,
      originalCode: err.original?.code,
      parentCode: err.parent?.code
    });
    return next(err);
  }
});

// GET /login - Render Login Page
router.get("/login", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect("/");
  }
  res.render("login", { title: "Log In - Sports Scheduler" });
});

// POST /login - Handle User Authentication
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true
  })
);

// POST /logout - Destroy Session and Logout
router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/login");
    });
  });
});

const { requireLogin } = require("../middleware/auth");

// GET /change-password - Render Change Password Page
router.get("/change-password", requireLogin, (req, res) => {
  res.render("change-password", {
    title: "Change Password - Sports Scheduler"
  });
});

// POST /change-password - Handle Password Change
router.post("/change-password", requireLogin, async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // 1. Validation: Current password is required
    if (!currentPassword) {
      req.flash("error", "Current password is required.");
      return res.redirect("/change-password");
    }

    // 2. Validation: New password is required
    if (!newPassword) {
      req.flash("error", "New password is required.");
      return res.redirect("/change-password");
    }

    // 3. Validation: Confirm password is required
    if (!confirmPassword) {
      req.flash("error", "Confirm password is required.");
      return res.redirect("/change-password");
    }

    // 4. Validation: New password and confirmation must match
    if (newPassword !== confirmPassword) {
      req.flash("error", "New password and confirmation do not match.");
      return res.redirect("/change-password");
    }

    // 5. Validation: Minimum length of 8 characters
    if (newPassword.length < 8) {
      req.flash("error", "New password must be at least 8 characters long.");
      return res.redirect("/change-password");
    }

    // 6. Validation: New password must be different from current password
    if (newPassword === currentPassword) {
      req.flash("error", "New password must be different from current password.");
      return res.redirect("/change-password");
    }

    // 7. Verify current password using bcrypt
    const isMatch = await bcrypt.compare(currentPassword, req.user.password);
    if (!isMatch) {
      req.flash("error", "Current password is incorrect.");
      return res.redirect("/change-password");
    }

    // 8. Hash new password and save
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    req.user.password = hashedPassword;
    await req.user.save();

    req.flash("success", "Password changed successfully.");
    return res.redirect("/change-password");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
