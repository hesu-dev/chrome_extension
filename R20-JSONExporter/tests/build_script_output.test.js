const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scriptPath = path.join(__dirname, "..", "scripts", "build.mjs");

test("build.mjs stages and reports safari release output", () => {
  const content = fs.readFileSync(scriptPath, "utf8");

  assert.match(content, /stageSafariRelease/);
  assert.match(content, /Safari release staged at/);
  assert.match(content, /Safari app metadata:/);
  assert.match(content, /Safari shared core bundle:/);
});
