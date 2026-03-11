const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scriptPath = path.join(__dirname, "..", "scripts", "zip.mjs");

test("zip.mjs keeps safari as a staged folder artifact", () => {
  const content = fs.readFileSync(scriptPath, "utf8");

  assert.match(content, /chrome\.zip/);
  assert.match(content, /firefox-mobile\.zip/);
  assert.doesNotMatch(content, /ios-safari\.zip/);
  assert.match(content, /Safari release is staged as a folder/);
});
