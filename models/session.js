const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Session extends Model {
    static associate(models) {
      // Session belongsTo Sport
      Session.belongsTo(models.Sport, {
        foreignKey: "sportId",
        as: "sport"
      });

      // Session belongsTo User as creator
      Session.belongsTo(models.User, {
        foreignKey: "creatorId",
        as: "creator"
      });

      // Session hasMany Participant
      Session.hasMany(models.Participant, {
        foreignKey: "sessionId",
        as: "participants"
      });
    }
  }

  Session.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      sportId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      creatorId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Session date cannot be empty"
          }
        }
      },
      time: {
        type: DataTypes.TIME,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Session time cannot be empty"
          }
        }
      },
      venue: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Session venue cannot be empty"
          }
        }
      },
      additionalPlayersNeeded: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          isInt: {
            msg: "Additional players needed must be an integer"
          },
          min: {
            args: [0],
            msg: "Additional players needed must be a non-negative integer"
          }
        }
      },
      status: {
        type: DataTypes.ENUM("scheduled", "cancelled", "completed"),
        defaultValue: "scheduled",
        allowNull: false
      },
      cancellationReason: {
        type: DataTypes.STRING(500),
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: "Session",
      tableName: "Sessions"
    }
  );

  return Session;
};
