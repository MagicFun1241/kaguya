const { readFileSync } = require("fs");

const config = JSON.parse(readFileSync("config.json").toString("utf-8"));

module.exports = {
  apps : [{
    name: 'Kaguya',
    script: 'build/index.js',
    env: {
      "TOKEN": config.token
    }
  }]
};
