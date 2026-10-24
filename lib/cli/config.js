/**
 * Responsible for loading / finding Mocha's "rc" files.
 *
 * @private
 * @module
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import debugModule from "debug";
import { findUpSync } from "find-up-simple";
import { createUnparsableFileError } from "../errors.js";
import utils from "../utils.cjs";

const require = createRequire(import.meta.url);
const debug = debugModule("mocha:cli:config");

const findUpSyncAny = (files, options) => {
  for (const file of files) {
    const filepath = findUpSync(file, options);
    if (filepath) {
      return filepath;
    }
  }

  return undefined;
};

/**
 * These are the valid config files, in order of precedence;
 * e.g., if `.mocharc.js` is present, then `.mocharc.yaml` and the rest
 * will be ignored.
 * The user should still be able to explicitly specify a file.
 * @private
 */
// This is documented publicly in `configuring.mdx`
export const CONFIG_FILES = [
  ".mocharc.cjs",
  ".mocharc.js",
  ".mocharc.mjs",
  ".mocharc.yaml",
  ".mocharc.yml",
  ".mocharc.jsonc",
  ".mocharc.json",
];

/**
 * Parsers for various config filetypes. Each accepts a filepath and
 * returns an object (but could throw)
 */
export const parsers = {
  yaml: (filepath) =>
    require("js-yaml").load(fs.readFileSync(filepath, "utf8")),
  js: (filepath) => {
    let cwdFilepath;
    try {
      debug('parsers: load cwd-relative path: "%s"', path.resolve(filepath));
      cwdFilepath = require.resolve(path.resolve(filepath)); // evtl. throws
      return require(cwdFilepath);
    } catch (err) {
      if (cwdFilepath) throw err;

      debug('parsers: retry load as module-relative path: "%s"', filepath);
      return require(filepath);
    }
  },
  json: (filepath) =>
    JSON.parse(
      require("strip-json-comments").default(fs.readFileSync(filepath, "utf8")),
    ),
};

/**
 * Loads and parses, based on file extension, a config file.
 * "JSON" files may have comments.
 *
 * @private
 * @param {string} filepath - Config file path to load
 * @returns {Object} Parsed config object
 */
export const loadConfig = (filepath) => {
  let config;
  debug("loadConfig: trying to parse config at %s", filepath);

  const ext = path.extname(filepath);
  try {
    if (ext === ".yml" || ext === ".yaml") {
      config = parsers.yaml(filepath);
    } else if (ext === ".js" || ext === ".cjs" || ext === ".mjs") {
      const parsedConfig = parsers.js(filepath);
      config = parsedConfig.default ?? parsedConfig;
    } else {
      config = parsers.json(filepath);
    }
  } catch (err) {
    throw createUnparsableFileError(
      `Unable to read/parse ${filepath}: ${err}`,
      filepath,
    );
  }
  return config;
};

/**
 * Find ("find up") config file starting at `cwd`
 *
 * @param {string} [cwd] - Current working directory
 * @returns {string|null} Filepath to config, if found
 */
export const findConfig = (cwd = utils.cwd()) => {
  const filepath = findUpSyncAny(CONFIG_FILES, { cwd });
  if (filepath) {
    debug("findConfig: found config file %s", filepath);
  }
  return filepath;
};
