const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.join(
  __dirname,
  "..",
  "..",
  "R20-JSONExporter-safari-app",
  "ios",
  "Roll20SafariExtension",
  "Resources",
  "manifest.json"
);

test("safari source manifest declares popup messaging and native save permissions", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.version, "0.7.0");
  assert.ok(Array.isArray(manifest.permissions));
  assert.ok(manifest.permissions.includes("tabs"));
  assert.ok(manifest.permissions.includes("nativeMessaging"));
});
