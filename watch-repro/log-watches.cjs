"use strict";

const fs = require("node:fs");
const realWatch = fs.watch;

fs.watch = function (target, ...rest) {
  process.stderr.write(`[watch] ${target}\n`);
  process.stderr.write(`[armed ${new Date().toISOString()}]\n`);
  return realWatch.call(this, target, ...rest);
};
