const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Participant extends Model {
    static associate(models) {
      // Participant belongsTo Session
      Participant.belongsTo(models.Session, {
        foreignKey: "sessionId",
        as: "session"
      });

      // Participant belongsTo User
      Participant.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user"
      });
    }
  }

  Participant.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      sessionId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "Participant",
      tableName: "Participants"
    }
  );

  return Participant;
};
