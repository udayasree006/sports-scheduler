const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class User extends Model {
    static associate(models) {
      // User hasMany Session as createdSessions
      User.hasMany(models.Session, {
        foreignKey: "creatorId",
        as: "createdSessions"
      });

      // User hasMany Participant
      User.hasMany(models.Participant, {
        foreignKey: "userId",
        as: "participations"
      });

      // User hasMany Notification
      User.hasMany(models.Notification, {
        foreignKey: "userId",
        as: "notifications",
        onDelete: "CASCADE",
        hooks: true
      });
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      first_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "First name cannot be empty"
          }
        }
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: {
            msg: "Must be a valid email address"
          },
          notEmpty: {
            msg: "Email cannot be empty"
          }
        }
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Password cannot be empty"
          }
        }
      },
      role: {
        type: DataTypes.ENUM("admin", "player"),
        defaultValue: "player",
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "User",
      tableName: "Users"
    }
  );

  return User;
};
