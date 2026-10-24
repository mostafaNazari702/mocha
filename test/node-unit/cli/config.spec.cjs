"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sinon = require("sinon");
const {
  parsers,
  loadConfig,
  findConfig,
  CONFIG_FILES,
} = require("../../../lib/cli/config.js");

describe("cli/config", function () {
  const phonyConfigObject = { ok: true };

  afterEach(function () {
    sinon.restore();
  });

  describe("loadConfig()", function () {
    describe("when parsing succeeds", function () {
      beforeEach(function () {
        sinon.stub(parsers, "yaml").returns(phonyConfigObject);
        sinon.stub(parsers, "json").returns(phonyConfigObject);
        sinon.stub(parsers, "js").returns(phonyConfigObject);
      });

      describe('when supplied a filepath with ".cjs" extension', function () {
        const filepath = "foo.cjs";

        it("should use the JS parser", function () {
          loadConfig(filepath);
          expect(parsers.js, "to have calls satisfying", [
            { args: [filepath], returned: phonyConfigObject },
          ]).and("was called once");
        });
      });

      describe('when supplied a filepath with ".js" extension', function () {
        const filepath = "foo.js";

        it("should use the JS parser", function () {
          loadConfig(filepath);
          expect(parsers.js, "to have calls satisfying", [
            { args: [filepath], returned: phonyConfigObject },
          ]).and("was called once");
        });
      });

      describe('when supplied a filepath with ".json" extension', function () {
        const filepath = "foo.json";

        it("should use the JSON parser", function () {
          loadConfig("foo.json");
          expect(parsers.json, "to have calls satisfying", [
            { args: [filepath], returned: phonyConfigObject },
          ]).and("was called once");
        });
      });

      describe('when supplied a filepath with ".jsonc" extension', function () {
        const filepath = "foo.jsonc";

        it("should use the JSON parser", function () {
          loadConfig("foo.jsonc");
          expect(parsers.json, "to have calls satisfying", [
            { args: [filepath], returned: phonyConfigObject },
          ]).and("was called once");
        });
      });

      describe('when supplied a filepath with ".mjs" extension', function () {
        const filepath = "foo.mjs";

        it("should use the JS parser", function () {
          loadConfig(filepath);
          expect(parsers.js, "to have calls satisfying", [
            { args: [filepath], returned: phonyConfigObject },
          ]).and("was called once");
        });
      });

      describe('when supplied a filepath with ".yaml" extension', function () {
        const filepath = "foo.yaml";

        it("should use the YAML parser", function () {
          loadConfig(filepath);
          expect(parsers.yaml, "to have calls satisfying", [
            { args: [filepath], returned: phonyConfigObject },
          ]).and("was called once");
        });
      });

      describe('when supplied a filepath with ".yml" extension', function () {
        const filepath = "foo.yml";

        it("should use the YAML parser", function () {
          loadConfig(filepath);
          expect(parsers.yaml, "to have calls satisfying", [
            { args: [filepath], returned: phonyConfigObject },
          ]).and("was called once");
        });
      });
    });

    describe("when supplied a filepath with unsupported extension", function () {
      beforeEach(function () {
        sinon.stub(parsers, "json").returns(phonyConfigObject);
      });

      it("should use the JSON parser", function () {
        loadConfig("foo.bar");
        expect(parsers.json, "was called");
      });
    });

    describe("when config file parsing fails", function () {
      beforeEach(function () {
        const err = new Error();
        err.name = "goo.yaml is unparsable";
        sinon.stub(parsers, "yaml").throws(err);
      });

      it("should throw", function () {
        expect(
          () => loadConfig("goo.yaml"),
          "to throw",
          "Unable to read/parse goo.yaml: goo.yaml is unparsable",
        );
      });
    });
  });

  describe("findConfig()", function () {
    let tmpdir;

    const touch = (...segments) => {
      const filepath = path.join(tmpdir, ...segments);
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, "");
      return filepath;
    };

    beforeEach(function () {
      tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "mocha-find-config-"));
    });

    afterEach(function () {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    });

    it("should look in the current working directory by default", function () {
      const expected = touch(".mocharc.yml");
      sinon.stub(process, "cwd").returns(tmpdir);
      expect(findConfig(), "to equal", expected);
    });

    it("should support an explicit `cwd`", function () {
      const expected = touch(".mocharc.yml");
      expect(findConfig(tmpdir), "to equal", expected);
    });

    it("should look in parent directories", function () {
      const expected = touch(".mocharc.json");
      const cwd = path.dirname(touch("some", "path", "file.txt"));
      expect(findConfig(cwd), "to equal", expected);
    });

    it("should prefer config files in CONFIG_FILES order", function () {
      CONFIG_FILES.forEach((file) => touch(file));
      expect(
        findConfig(tmpdir),
        "to equal",
        path.join(tmpdir, CONFIG_FILES[0]),
      );
    });

    it("should skip config files that do not exist", function () {
      const expected = touch(".mocharc.mjs");
      touch(".mocharc.json");
      expect(findConfig(tmpdir), "to equal", expected);
    });

    it("should return undefined if no item is found", function () {
      expect(findConfig("/some/path/"), "to be undefined");
    });
  });

  describe("parsers()", function () {
    it("should print error message for faulty require", function () {
      // Fixture exists, but fails loading.
      // Prints correct error message without using fallback path.
      expect(
        () => parsers.js(require.resolve("./fixtures/bad-require.fixture.cjs")),
        "to throw",
        { message: /Cannot find module 'fake'/, code: "MODULE_NOT_FOUND" },
      );
    });

    it("should print error message for non-existing file", function () {
      expect(() => parsers.js("not-existing.js"), "to throw", {
        message: /Cannot find module 'not-existing.js'/,
        code: "MODULE_NOT_FOUND",
      });
    });
  });
});
