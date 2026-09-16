"use strict";

const bcrypt = require("bcrypt");
require("dotenv").config();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword || !adminPassword.trim()) {
      throw new Error("ADMIN_PASSWORD environment variable is missing or empty.");
    }

    const hashedPassword = await bcrypt.hash(adminPassword.trim(), 10);
    const adminEmail = "admin@sportsscheduler.local";

    const existingAdmin = await queryInterface.rawSelect(
      "Users",
      {
        where: { email: adminEmail }
      },
      ["id"]
    );

    if (existingAdmin) {
      await queryInterface.bulkUpdate(
        "Users",
        {
          role: "admin",
          password: hashedPassword,
          updatedAt: new Date()
        },
        { email: adminEmail }
      );
    } else {
      await queryInterface.bulkInsert("Users", [
        {
          first_name: "Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    }
  },

  async down(queryInterface, Sequelize) {
    // Safe no-op for ensure-admin-account migration
  }
};
