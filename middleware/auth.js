// Middleware to require user login
function requireLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  req.flash("error", "Please log in to view this page.");
  return res.redirect("/login");
}

// Middleware to require a specific role (e.g. 'admin')
function requireRole(role) {
  return (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      req.flash("error", "Please log in to view this page.");
      return res.redirect("/login");
    }

    if (req.user && req.user.role === role) {
      return next();
    }

    req.flash("error", "Access denied. Administrator privileges required.");
    return res.redirect("/");
  };
}

module.exports = {
  requireLogin,
  requireRole
};
