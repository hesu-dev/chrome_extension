const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  VENDOR_CORE_PATH,
  getChromeStageManifest,
  getFirefoxWebStageManifest,
  getFirefoxStageManifest,
  stageChromeRelease,
  stageFirefoxWebRelease,
  stageFirefoxRelease,
} = require("../scripts/lib/release_layout.js");

test("chrome staged manifest loads bundled core before dependent scripts", () => {
  const manifest = getChromeStageManifest();
  const scripts = manifest.content_scripts?.[0]?.js || [];

  assert.equal(VENDOR_CORE_PATH, "js/vendor/roll20-json-core.js");
  assert.equal(scripts[0], VENDOR_CORE_PATH);
  assert.ok(scripts.includes("js/content/export/parsers/parser_utils.js"));
  assert.ok(scripts.includes("js/content/export/chat_json_export.js"));
});

test("firefox staged manifest loads bundled core before dependent scripts", () => {
  const manifest = getFirefoxStageManifest();
  const scripts = manifest.content_scripts?.[0]?.js || [];

  assert.equal(scripts[0], VENDOR_CORE_PATH);
  assert.ok(scripts.includes("js/content/export/parsers/parser_utils.js"));
  assert.ok(scripts.includes("js/content/export/chat_json_export.js"));
});

test("firefox web staged manifest loads bundled core and keeps the desktop popup shell", () => {
  const manifest = getFirefoxWebStageManifest();
  const scripts = manifest.content_scripts?.[0]?.js || [];

  assert.equal(scripts[0], VENDOR_CORE_PATH);
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.action?.default_popup, "popup.html");
  assert.deepEqual(manifest.background?.scripts, ["js/background/background.js"]);
  assert.equal(manifest.background?.service_worker, "js/background/background.js");
  assert.equal(
    manifest.browser_specific_settings?.gecko?.id,
    "r20-json-exporter-firefox@reha.dev"
  );
  assert.equal(
    manifest.browser_specific_settings?.gecko?.strict_min_version,
    "140.0"
  );
  assert.deepEqual(
    manifest.browser_specific_settings?.gecko?.data_collection_permissions,
    { required: ["none"] }
  );
  assert.equal("gecko_android" in (manifest.browser_specific_settings || {}), false);
});

function collectStageArtifacts(rootPath) {
  const output = [];
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      output.push(...collectStageArtifacts(fullPath));
      continue;
    }
    output.push(path.relative(rootPath, fullPath));
  }
  return output;
}

test("release staging excludes macOS metadata files", () => {
  const chrome = stageChromeRelease();
  const firefoxWeb = stageFirefoxWebRelease();
  const firefox = stageFirefoxRelease();

  const chromeEntries = collectStageArtifacts(chrome.releaseRoot);
  const firefoxWebEntries = collectStageArtifacts(firefoxWeb.releaseRoot);
  const firefoxEntries = collectStageArtifacts(firefox.releaseRoot);

  assert.equal(chromeEntries.some((item) => item.endsWith(".DS_Store")), false);
  assert.equal(firefoxWebEntries.some((item) => item.endsWith(".DS_Store")), false);
  assert.equal(firefoxEntries.some((item) => item.endsWith(".DS_Store")), false);
});
