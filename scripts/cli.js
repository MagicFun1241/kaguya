const { exec } = require("child_process");
const { readFileSync } = require("fs");

const config = JSON.parse(readFileSync("config.json").toString("utf-8"));

exec(`node ./node_modules/cross-env/src/bin/cross-env.js TOKEN=${config.token} node build/index.js`);
