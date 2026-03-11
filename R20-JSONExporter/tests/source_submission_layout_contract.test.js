const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  SOURCE_SUBMISSION_ITEMS,
  SOURCE_SUBMISSION_README_TEMPLATE_PATH,
  SOURCE_SUBMISSION_ZIP_PATH,
} = require("../scripts/lib/source_submission_layout.js");

test("source submission bundle targets the firefox source set", () => {
  assert.deepEqual(SOURCE_SUBMISSION_ITEMS, [
    "R20-JSONExporter",
    "R20-JSONExporter-firefox-mobile",
    "roll20-json-core",
  ]);
  assert.equal(
    path.basename(SOURCE_SUBMISSION_README_TEMPLATE_PATH),
    "firefox-source-submission-README.md"
  );
  assert.equal(path.basename(SOURCE_SUBMISSION_ZIP_PATH), "firefox-mobile-source.zip");
});
