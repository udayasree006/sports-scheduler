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
      },
      team1Name: {
        type: DataTypes.STRING,
        allowNull: true
      },
      team1Players: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const rawVal = this.getDataValue("team1Players");
          if (!rawVal) return [];
          try {
            const parsed = JSON.parse(rawVal);
            return Array.isArray(parsed) ? parsed : [rawVal];
          } catch (e) {
            return rawVal.split(",").map((s) => s.trim()).filter(Boolean);
          }
        },
        set(val) {
          if (Array.isArray(val)) {
            const cleanArr = val.map((s) => String(s).trim()).filter(Boolean);
            this.setDataValue("team1Players", JSON.stringify(cleanArr));
          } else if (typeof val === "string") {
            if (!val.trim()) {
              this.setDataValue("team1Players", JSON.stringify([]));
            } else {
              try {
                const parsed = JSON.parse(val);
                this.setDataValue("team1Players", JSON.stringify(Array.isArray(parsed) ? parsed : [val.trim()]));
              } catch (e) {
                const arr = val.split(",").map((s) => s.trim()).filter(Boolean);
                this.setDataValue("team1Players", JSON.stringify(arr));
              }
            }
          } else {
            this.setDataValue("team1Players", JSON.stringify([]));
          }
        }
      },
      team2Name: {
        type: DataTypes.STRING,
        allowNull: true
      },
      team2Players: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const rawVal = this.getDataValue("team2Players");
          if (!rawVal) return [];
          try {
            const parsed = JSON.parse(rawVal);
            return Array.isArray(parsed) ? parsed : [rawVal];
          } catch (e) {
            return rawVal.split(",").map((s) => s.trim()).filter(Boolean);
          }
        },
        set(val) {
          if (Array.isArray(val)) {
            const cleanArr = val.map((s) => String(s).trim()).filter(Boolean);
            this.setDataValue("team2Players", JSON.stringify(cleanArr));
          } else if (typeof val === "string") {
            if (!val.trim()) {
              this.setDataValue("team2Players", JSON.stringify([]));
            } else {
              try {
                const parsed = JSON.parse(val);
                this.setDataValue("team2Players", JSON.stringify(Array.isArray(parsed) ? parsed : [val.trim()]));
              } catch (e) {
                const arr = val.split(",").map((s) => s.trim()).filter(Boolean);
                this.setDataValue("team2Players", JSON.stringify(arr));
              }
            }
          } else {
            this.setDataValue("team2Players", JSON.stringify([]));
          }
        }
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
