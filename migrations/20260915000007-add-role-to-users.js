"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable("Users");
    if (!tableDefinition.role) {
      await queryInterface.addColumn("Users", "role", {
        type: Sequelize.ENUM("admin", "player"),
        defaultValue: "player",
        allowNull: false
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable("Users");
    if (tableDefinition.role) {
      await queryInterface.removeColumn("Users", "role");
    }
  }
};
