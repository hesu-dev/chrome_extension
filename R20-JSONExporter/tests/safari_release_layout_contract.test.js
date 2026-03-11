const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  REPO_ROOT,
  VENDOR_CORE_PATH,
  SAFARI_PROJECT_ROOT,
  SAFARI_RELEASE_ROOT,
  stageSafariRelease,
} = require("../scripts/lib/release_layout.js");

test("safari release layout exposes sibling source and release roots", () => {
  assert.equal(
    SAFARI_PROJECT_ROOT,
    path.join(REPO_ROOT, "R20-JSONExporter-safari-app")
  );
  assert.equal(
    SAFARI_RELEASE_ROOT,
    path.join(REPO_ROOT, "R20-JSONExporter", "release", "ios-safari")
  );
});

test("safari release staging returns app metadata and shared core bundle paths", () => {
  const result = stageSafariRelease();

  assert.equal(result.releaseRoot, SAFARI_RELEASE_ROOT);
  assert.equal(result.appMetadataPath, path.join(SAFARI_RELEASE_ROOT, "app.json"));
  assert.equal(
    result.vendorPath,
    path.join(
      SAFARI_RELEASE_ROOT,
      "ios",
      "Roll20SafariExtension",
      "Resources",
      VENDOR_CORE_PATH
    )
  );
});
