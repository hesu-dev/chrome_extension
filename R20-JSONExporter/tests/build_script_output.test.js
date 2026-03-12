const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scriptPath = path.join(__dirname, "..", "scripts", "build.mjs");

test("build.mjs stages and reports chrome, firefox web/mobile, and safari release output", () => {
  const content = fs.readFileSync(scriptPath, "utf8");

  assert.match(content, /stageFirefoxWebRelease/);
  assert.match(content, /stageSafariRelease/);
  assert.match(content, /Firefox web release staged at/);
  assert.match(content, /Firefox web manifest:/);
  assert.match(content, /Firefox web shared core bundle:/);
  assert.match(content, /Firefox mobile release staged at/);
  assert.match(content, /Firefox mobile manifest:/);
  assert.match(content, /Firefox mobile shared core bundle:/);
  assert.match(content, /Safari release staged at/);
  assert.match(content, /Safari app metadata:/);
  assert.match(content, /Safari shared core bundle:/);
});
