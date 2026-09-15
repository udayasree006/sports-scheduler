"use strict";

const bcrypt = require("bcrypt");
require("dotenv").config();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const adminPassword = process.env.ADMIN_PASSWORD || "AdminPass123!";
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const existingAdmin = await queryInterface.rawSelect(
      "Users",
      {
        where: { email: "admin@sportsscheduler.local" }
      },
      ["id"]
    );

    if (!existingAdmin) {
      await queryInterface.bulkInsert("Users", [
        {
          first_name: "Admin",
          email: "admin@sportsscheduler.local",
          password: hashedPassword,
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Users", {
      email: "admin@sportsscheduler.local"
    });
  }
};
