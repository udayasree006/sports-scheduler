const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Notification extends Model {
    static associate(models) {
      // Notification belongsTo User
      Notification.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
        onDelete: "CASCADE"
      });
    }
  }

  Notification.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      message: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Notification message cannot be empty"
          },
          len: {
            args: [1, 500],
            msg: "Notification message cannot exceed 500 characters"
          }
        }
      },
      type: {
        type: DataTypes.ENUM("session_joined", "session_cancelled", "session_completed", "general"),
        allowNull: false,
        validate: {
          isIn: {
            args: [["session_joined", "session_cancelled", "session_completed", "general"]],
            msg: "Invalid notification type"
          }
        }
      },
      read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "Notification",
      tableName: "Notifications"
    }
  );

  return Notification;
};
