const test = require("node:test");
const assert = require("node:assert/strict");

const {
  VENDOR_CORE_PATH,
  getChromeStageManifest,
} = require("../scripts/lib/release_layout.js");

test("chrome staged manifest loads bundled core before dependent scripts", () => {
  const manifest = getChromeStageManifest();
  const scripts = manifest.content_scripts?.[0]?.js || [];

  assert.equal(VENDOR_CORE_PATH, "js/vendor/roll20-json-core.js");
  assert.equal(scripts[0], VENDOR_CORE_PATH);
  assert.ok(scripts.includes("js/content/export/parsers/parser_utils.js"));
  assert.ok(scripts.includes("js/content/export/chat_json_export.js"));
});
