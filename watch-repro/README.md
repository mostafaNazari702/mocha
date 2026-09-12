Four checks, run against three versions of `lib/cli/watch-run.cjs`: `mochajs/mocha`
main unchanged, main plus the patch as it was first reviewed and main plus the
patch now proposed.

1. Noise: start `mocha --watch --watch-files lib` in a folder where `lib`
   does not exist yet, alongside `notes.txt`, `src/`, `assets/` and `node_modules/`. 
   Touch each of those and see whether anything reruns.

2. Watched directories: which directories mocha ends up putting an
   OS-level watch on as the missing path gets deeper (1, 3 and 8 levels) amd
   the case where the directory already exists.

3. Startup cost: time to the first run when the directory above the
   watched one holds 3000 files and 300 subdirectories.

4. Race margin: the gap between chokidar reporting `ready` and the watcher
   actually being armed against the gap between `ready` and the first run's
   output being visible. The watch tests assume the second is larger.

Run it:

```sh
git clone https://github.com/mochajs/mocha.git

cd mocha

npm ci --ignore-scripts

cd ..

node watch-repro/run.cjs mocha "main"
```

The only instrumentation is `log-watches.cjs`, loaded with `NODE_OPTIONS=--require`. 
We wrap `fs.watch` to print what gets watched and when and changes nothing else.
