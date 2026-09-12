"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const REPO = path.resolve(process.argv[2] || "../mocha");
const LABEL = process.argv[3] || "mocha";
const PRELOAD = path.join(__dirname, "log-watches.cjs");
const FIXTURE = path.join(REPO, "test/integration/fixtures/__default__.fixture.js");
const BIN = path.join(REPO, "bin/mocha.js");

const sleep = (t) => new Promise((r) => setTimeout(r, t));
const pad = (s, n) => String(s).padEnd(n);

function makeTempDir(extra) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "repro-")));
  fs.cpSync(FIXTURE, path.join(dir, "test.js"));
  if (extra) extra(dir);
  return dir;
}

function startMocha(dir, watchFiles) {
  const child = cp.spawn(
    process.execPath,
    [BIN, path.join(dir, "test.js"), "--watch-files", watchFiles,
      "--reporter", "json", "--watch"],
    {
      cwd: dir,
      stdio: ["pipe", "pipe", "pipe"],
      env: Object.assign({}, process.env, {
        NODE_OPTIONS: "--require " + PRELOAD,
        DEBUG: "mocha:cli:watch",
      }),
    },
  );
  const state = { out: "", err: "" };
  child.stdout.on("data", (c) => { state.out += c; });
  child.stderr.on("data", (c) => { state.err += c; });
  state.runs = () => (state.out.match(/"stats"/g) || []).length;
  state.watches = () =>
    [...new Set(state.err.split("\n")
      .filter((l) => l.startsWith("[watch] "))
      .map((l) => path.resolve(l.slice(8))))];
  return [child, state];
}

async function stop(child, dir) {
  try { child.kill("SIGKILL"); } catch { /* already gone */ }
  await sleep(150);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* windows */ }
}

// First, does mocha rerun for files it was never asked to watch?
async function checkNoise() {
  console.log("\n1. Noise: does anything unrelated trigger a rerun?");
  const dir = makeTempDir((d) => {
    fs.writeFileSync(path.join(d, "notes.txt"), "x");
    fs.mkdirSync(path.join(d, "src"), { recursive: true });
    fs.writeFileSync(path.join(d, "src/thing.js"), "//");
    fs.mkdirSync(path.join(d, "assets/img"), { recursive: true });
    fs.writeFileSync(path.join(d, "assets/img/a.png"), "x");
    fs.mkdirSync(path.join(d, "node_modules/pkg"), { recursive: true });
    fs.writeFileSync(path.join(d, "node_modules/pkg/index.js"), "//");
  });
  const [child, st] = startMocha(dir, "lib"); // `lib` does not exist yet
  const t0 = Date.now();
  while (st.runs() < 1 && Date.now() - t0 < 30000) await sleep(10);

  const step = async (label, fn) => {
    const before = st.runs();
    fn();
    await sleep(2500);
    const after = st.runs();
    console.log(`     ${pad(label, 32)} ${after > before ? "RERAN" : "no rerun"}`);
  };
  await step("touch notes.txt", () => fs.writeFileSync(path.join(dir, "notes.txt"), "y"));
  await step("touch src/thing.js", () => fs.writeFileSync(path.join(dir, "src/thing.js"), "// y"));
  await step("touch assets/img/a.png", () => fs.writeFileSync(path.join(dir, "assets/img/a.png"), "y"));
  await step("add node_modules/pkg/new.js", () => fs.writeFileSync(path.join(dir, "node_modules/pkg/new.js"), "//"));
  await step("mkdir other/", () => fs.mkdirSync(path.join(dir, "other")));
  await step("mkdir lib/   <- the watched one", () => fs.mkdirSync(path.join(dir, "lib")));
  await step("touch lib/file.xyz", () => fs.writeFileSync(path.join(dir, "lib/file.xyz"), "z"));
  await stop(child, dir);
}

// Also, which directories actually get an OS-level watch by depth of the missing path? 
// Mark on Discord gave me a "great great grandparent" question so this is it.
async function checkWatchedDirs() {
  console.log("\n2. Which directories get an OS-level watch?");
  const cases = [
    { name: "lib (1 level missing)", watch: "lib" },
    { name: "a/b/c (3 missing)", watch: "a/b/c" },
    { name: "a/b/c/d/e/f/g/h (8 missing)", watch: "a/b/c/d/e/f/g/h" },
    { name: "a/b/c/d/e/f/g/h (a/b exist)", watch: "a/b/c/d/e/f/g/h", pre: ["a/b"] },
    { name: "lib (already exists)", watch: "lib", pre: ["lib"] },
  ];
  for (const c of cases) {
    const dir = makeTempDir((d) => {
      for (const p of c.pre || []) fs.mkdirSync(path.join(d, p), { recursive: true });
    });
    const [child, st] = startMocha(dir, c.watch);
    const t0 = Date.now();
    while (st.runs() < 1 && Date.now() - t0 < 30000) await sleep(5);
    await sleep(800);
    const watched = st.watches()
      .map((w) => (w === dir ? "<tmp>" : w.replace(dir, "<tmp>")))
      .sort();
    console.log(`     ${pad(c.name, 32)} [${watched.join(", ") || "none"}]`);
    await stop(child, dir);
  }
}

// Third, if the directory above is big then how long until the first run starts?
async function checkStartupCost() {
  console.log("\n3. Startup cost when the directory above is big");
  const FILES = 3000;
  const DIRS = 300;
  const times = [];
  for (let i = 0; i < 3; i++) {
    const dir = makeTempDir((d) => {
      for (let n = 0; n < FILES; n++) fs.writeFileSync(path.join(d, `f${n}.txt`), "x");
      for (let n = 0; n < DIRS; n++) {
        fs.mkdirSync(path.join(d, `d${n}`));
        fs.writeFileSync(path.join(d, `d${n}`, "a.js"), "//");
      }
    });
    const started = Date.now();
    const [child, st] = startMocha(dir, "lib");
    while (st.runs() < 1 && Date.now() - started < 60000) await sleep(2);
    times.push(Date.now() - started);
    await stop(child, dir);
  }
  console.log(`     ${pad(FILES + " files + " + DIRS + " dirs alongside", 32)} ${times.join(" ms, ")} ms to first run`);
}

// lastely, the actual bug: is the watcher armed before the first run finishes?
async function checkRaceMargin() {
  console.log("\n4. Race margin: watcher armed vs. first run visible");
  const A = [], B = [];
  for (let i = 0; i < 6; i++) {
    const dir = makeTempDir();
    const [child, st] = startMocha(dir, "lib");
    let run1At = null;
    const t0 = Date.now();
    for (;;) {
      if (!run1At && st.runs() >= 1) run1At = Date.now();
      if (run1At && /\[watch\] /.test(st.err)) break;
      if (Date.now() - t0 > 30000) break;
      await sleep(1);
    }
    const ready = st.err.match(/(\d{4}-[\dT:.Z-]+) mocha:cli:watch watcher ready/);
    const armed = st.err.match(/\[armed (\d{4}-[\dT:.Z-]+)\]/);
    if (ready && armed && run1At) {
      const r = new Date(ready[1]).getTime();
      A.push(new Date(armed[1]).getTime() - r);
      B.push(run1At - r);
    }
    await stop(child, dir);
  }
  if (!A.length) {
    console.log("     (no samples)");
    return;
  }
  const margins = A.map((a, i) => B[i] - a);
  const fmt = (x) => `min=${Math.min(...x)} max=${Math.max(...x)}`;
  console.log(`     ready -> watcher armed        ${fmt(A)} ms`);
  console.log(`     ready -> first run visible    ${fmt(B)} ms`);
  console.log(`     margin the test relies on     ${fmt(margins)} ms`);
}

(async () => {
  console.log("=".repeat(66));
  console.log(`  ${LABEL}   (node ${process.version}, ${process.platform})`);
  console.log("=".repeat(66));
  await checkNoise();
  await checkWatchedDirs();
  await checkStartupCost();
  await checkRaceMargin();
  console.log("");
  process.exit(0);
})();
