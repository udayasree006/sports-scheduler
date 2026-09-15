const express = require("express");
const { Sport } = require("../models");
const { requireLogin, requireRole } = require("../middleware/auth");

const router = express.Router();

// Enforce admin login and role authorization on all /admin/sports routes
router.use(requireLogin);
router.use(requireRole("admin"));

// GET /admin/sports - List all sports
router.get("/", async (req, res, next) => {
  try {
    const sports = await Sport.findAll({ order: [["id", "ASC"]] });
    res.render("admin/sports/index", {
      title: "Manage Sports - Admin",
      sports
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/sports/new - Render Create Sport Form
router.get("/new", (req, res) => {
  res.render("admin/sports/new", {
    title: "Create New Sport - Admin"
  });
});

// POST /admin/sports - Handle Sport Creation
router.post("/", async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const trimmedName = name ? name.trim() : "";

    if (!trimmedName) {
      req.flash("error", "Sport name cannot be empty.");
      return res.redirect("/admin/sports/new");
    }

    const existingSport = await Sport.findOne({
      where: { name: trimmedName }
    });

    if (existingSport) {
      req.flash("error", "A sport with this name already exists.");
      return res.redirect("/admin/sports/new");
    }

    await Sport.create({
      name: trimmedName,
      description: description ? description.trim() : null,
      active: true
    });

    req.flash("success", "Sport created successfully.");
    return res.redirect("/admin/sports");
  } catch (err) {
    next(err);
  }
});

// GET /admin/sports/:id/edit - Render Edit Form
router.get("/:id/edit", async (req, res, next) => {
  try {
    const sport = await Sport.findByPk(req.params.id);
    if (!sport) {
      req.flash("error", "Sport not found.");
      return res.redirect("/admin/sports");
    }

    res.render("admin/sports/edit", {
      title: `Edit ${sport.name} - Admin`,
      sport
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/sports/:id - Update Sport
router.post("/:id", async (req, res, next) => {
  try {
    const sport = await Sport.findByPk(req.params.id);
    if (!sport) {
      req.flash("error", "Sport not found.");
      return res.redirect("/admin/sports");
    }

    const { name, description } = req.body;
    const trimmedName = name ? name.trim() : "";

    if (!trimmedName) {
      req.flash("error", "Sport name cannot be empty.");
      return res.redirect(`/admin/sports/${sport.id}/edit`);
    }

    const existingSport = await Sport.findOne({
      where: { name: trimmedName }
    });

    if (existingSport && existingSport.id !== sport.id) {
      req.flash("error", "A sport with this name already exists.");
      return res.redirect(`/admin/sports/${sport.id}/edit`);
    }

    sport.name = trimmedName;
    sport.description = description ? description.trim() : null;
    await sport.save();

    req.flash("success", "Sport updated successfully.");
    return res.redirect("/admin/sports");
  } catch (err) {
    next(err);
  }
});

// POST /admin/sports/:id/toggle - Toggle Active Status
router.post("/:id/toggle", async (req, res, next) => {
  try {
    const sport = await Sport.findByPk(req.params.id);
    if (!sport) {
      req.flash("error", "Sport not found.");
      return res.redirect("/admin/sports");
    }

    sport.active = !sport.active;
    await sport.save();

    req.flash("success", `Sport status updated to ${sport.active ? "Active" : "Inactive"}.`);
    return res.redirect("/admin/sports");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
