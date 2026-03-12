const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scriptPath = path.join(__dirname, "..", "deploy.sh");
const packagePath = path.join(__dirname, "..", "package.json");

test("deploy.sh exists and runs the release build from the project root", () => {
  const stat = fs.statSync(scriptPath);
  const content = fs.readFileSync(scriptPath, "utf8");

  assert.equal(stat.isFile(), true);
  assert.equal(content.startsWith("#!/usr/bin/env bash\n"), true);
  assert.match(content, /cd "\$\(dirname "\$0"\)"/);
  assert.match(content, /npm run build:release/);
});

test("build:release also generates the firefox source submission bundle", () => {
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  assert.match(String(pkg?.scripts?.["build:release"] || ""), /npm run source:zip/);
});
