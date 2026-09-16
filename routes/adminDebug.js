// TEMPORARY DIAGNOSTIC ROUTE - FOR ADMIN MIGRATION TROUBLESHOOTING ONLY
const express = require("express");
const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const { requireLogin, requireRole } = require("../middleware/auth");

const router = express.Router();

// Enforce authentication & admin role
router.use(requireLogin);
router.use(requireRole("admin"));

/**
 * GET /admin/debug/migrations
 * TEMPORARY DIAGNOSTIC ENDPOINT
 * Queries the SequelizeMeta table and displays recorded migration filenames.
 */
router.get("/migrations", async (req, res, next) => {
  try {
    let rawRows = [];
    try {
      rawRows = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name ASC', {
        type: QueryTypes.SELECT
      });
    } catch (err1) {
      try {
        rawRows = await sequelize.query("SELECT name FROM SequelizeMeta ORDER BY name ASC", {
          type: QueryTypes.SELECT
        });
      } catch (err2) {
        rawRows = [];
      }
    }

    const migrationNames = (rawRows || [])
      .map((row) => (row ? row.name : null))
      .filter(Boolean)
      .sort();

    const targetFiles = [
      "20260915000008-update-admin-password.js",
      "20260915000009-ensure-admin-account.js",
      "20260915000010-repair-admin-account.js"
    ];

    const checkResults = targetFiles.map((file) => ({
      file,
      present: migrationNames.includes(file)
    }));

    const targetListHtml = checkResults
      .map(
        (r) =>
          `<li><code>${r.file}</code>: <strong style="color: ${
            r.present ? "green" : "red"
          };">${r.present ? "PRESENT (Recorded)" : "MISSING (Not Recorded)"}</strong></li>`
      )
      .join("");

    const allListHtml =
      migrationNames.length > 0
        ? migrationNames.map((name) => `<li><code>${name}</code></li>`).join("")
        : "<li><em>No migrations recorded in SequelizeMeta.</em></li>";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>TEMPORARY DIAGNOSTIC: SequelizeMeta Migrations</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; background: #f9f9f9; color: #333; }
    .card { background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 800px; margin: 0 auto; }
    h1 { color: #d9534f; margin-top: 0; }
    h2 { border-bottom: 2px solid #eee; padding-bottom: 8px; margin-top: 24px; }
    ul { background: #f4f4f5; padding: 16px 32px; border-radius: 6px; }
    li { margin-bottom: 6px; }
    code { font-family: monospace; background: #e8e8e8; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>[TEMPORARY DIAGNOSTIC] Recorded SequelizeMeta Migrations</h1>
    <p><strong>Note:</strong> This endpoint reads recorded migration filenames from <code>SequelizeMeta</code>.</p>

    <h2>Target Migration Verification</h2>
    <ul>
      ${targetListHtml}
    </ul>

    <h2>All Executed Migrations in SequelizeMeta (${migrationNames.length})</h2>
    <ul>
      ${allListHtml}
    </ul>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    return res.send(html);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
