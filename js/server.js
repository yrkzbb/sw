const fs = require("fs");
const path = require("path");

const partsDir = path.join(__dirname, "server-parts");
const serverSource = fs
  .readdirSync(partsDir)
  .filter((file) => /^\d+-.+\.js$/.test(file))
  .sort()
  .map((file) => fs.readFileSync(path.join(partsDir, file), "utf-8"))
  .join("\n\n");

const runServer = new Function("require", "__dirname", "console", "process", "Buffer", serverSource);
runServer(require, __dirname, console, process, Buffer);
