const test = require("node:test");
const assert = require("node:assert/strict");

const manifest = require("../manifest.json");

test("firefox manifest targets Android self-distribution", () => {
  assert.equal(manifest.manifest_version, 2);
  assert.equal(typeof manifest.browser_specific_settings?.gecko?.id, "string");
  assert.equal(
    typeof manifest.browser_specific_settings?.gecko?.gecko_android?.strict_min_version,
    "string"
  );
});
