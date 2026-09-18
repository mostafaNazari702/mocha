const { spawn, execSync } = require('child_process');
const fs = require('fs');

// make something inside the watched tree that chokidar will fail to stat
if (process.platform === 'win32') {
  fs.mkdirSync('locked', { recursive: true });
  execSync(`icacls locked /deny "${process.env.USERNAME}:(OI)(CI)(F)"`, { stdio: 'ignore' });
} else {
  fs.rmSync('loop', { force: true });
  fs.symlinkSync('loop', 'loop');
  fs.mkdirSync('locked/sub', { recursive: true });
  fs.chmodSync('locked', 0o400);
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
