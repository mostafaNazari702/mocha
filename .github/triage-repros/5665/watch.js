const { spawn, execSync } = require('child_process');
const fs = require('fs');

// windows: make a dir in the watched tree that chokidar can't stat.
// linux: the workflow sets fs.inotify.max_user_watches=0 instead.
if (process.platform === 'win32') {
  fs.mkdirSync('locked', { recursive: true });
  execSync(`icacls locked /deny "${process.env.USERNAME}:(OI)(CI)(F)"`, { stdio: 'ignore' });
}

const m = spawn(
  process.execPath,
  ['node_modules/mocha/bin/mocha.js', '--no-config', '--watch', 'test.js'],
  { stdio: 'inherit' }
);

m.on('exit', (code) => {
  console.log('mocha exited with ' + code);
  process.exit(0);
});

setTimeout(() => { console.log('still running after 10s'); m.kill(); process.exit(0); }, 10000);
