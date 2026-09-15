const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Sport extends Model {
    static associate(models) {
      // Sport hasMany Session
      Sport.hasMany(models.Session, {
        foreignKey: "sportId",
        as: "sessions"
      });
    }
  }

  Sport.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: {
            msg: "Sport name cannot be empty"
          }
        }
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "Sport",
      tableName: "Sports"
    }
  );

  return Sport;
};
