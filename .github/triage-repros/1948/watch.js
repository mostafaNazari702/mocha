const { spawn } = require('child_process');
const fs = require('fs');

const mocha = spawn(
  process.execPath,
  ['node_modules/mocha/bin/mocha.js', '--no-config', '--watch', '--check-leaks', 'test.js'],
  { stdio: 'inherit' }
);

setTimeout(() => fs.utimesSync('test.js', new Date(), new Date()), 6000);
setTimeout(() => { mocha.kill(); process.exit(0); }, 14000);
