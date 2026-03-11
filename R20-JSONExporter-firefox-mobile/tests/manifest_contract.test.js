const test = require("node:test");
const assert = require("node:assert/strict");

const manifest = require("../manifest.json");

test("firefox manifest targets Android self-distribution", () => {
  assert.equal(manifest.manifest_version, 2);
  assert.equal(
    manifest.browser_specific_settings?.gecko?.id,
    "r20-json-exporter-firefox@reha.dev"
  );
  assert.equal(
    manifest.browser_specific_settings?.gecko_android?.strict_min_version,
    "120.0"
  );
});
