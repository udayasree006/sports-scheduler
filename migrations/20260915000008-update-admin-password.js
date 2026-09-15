"use strict";

const bcrypt = require("bcrypt");
require("dotenv").config();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword || !adminPassword.trim()) {
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPassword.trim(), 10);

    const existingAdmin = await queryInterface.rawSelect(
      "Users",
      {
        where: { email: "admin@sportsscheduler.local" }
      },
      ["id"]
    );

    if (existingAdmin) {
      await queryInterface.bulkUpdate(
        "Users",
        {
          password: hashedPassword,
          updatedAt: new Date()
        },
        { email: "admin@sportsscheduler.local" }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    // Safe no-op for password updates
  }
};
