"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable("Sessions");

    if (!tableDefinition.team1Name) {
      await queryInterface.addColumn("Sessions", "team1Name", {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    if (!tableDefinition.team1Players) {
      await queryInterface.addColumn("Sessions", "team1Players", {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    if (!tableDefinition.team2Name) {
      await queryInterface.addColumn("Sessions", "team2Name", {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    if (!tableDefinition.team2Players) {
      await queryInterface.addColumn("Sessions", "team2Players", {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable("Sessions");

    if (tableDefinition.team1Name) {
      await queryInterface.removeColumn("Sessions", "team1Name");
    }
    if (tableDefinition.team1Players) {
      await queryInterface.removeColumn("Sessions", "team1Players");
    }
    if (tableDefinition.team2Name) {
      await queryInterface.removeColumn("Sessions", "team2Name");
    }
    if (tableDefinition.team2Players) {
      await queryInterface.removeColumn("Sessions", "team2Players");
    }
  }
};
