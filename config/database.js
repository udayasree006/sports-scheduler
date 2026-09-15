const { Sequelize } = require("sequelize");
const dbConfig = require("./config");

const env = process.env.NODE_ENV || "development";
const config = dbConfig[env];

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else if (config.dialect === "sqlite") {
  sequelize = new Sequelize(config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

module.exports = sequelize;
