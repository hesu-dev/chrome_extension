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

test("web release popups keep the hidden message helper text outside the toggle body", () => {
  const chrome = stageChromeRelease();
  const firefoxWeb = stageFirefoxWebRelease();
  const chromePopup = fs.readFileSync(
    path.join(chrome.releaseRoot, "popup.html"),
    "utf8"
  );
  const firefoxWebPopup = fs.readFileSync(
    path.join(firefoxWeb.releaseRoot, "popup.html"),
    "utf8"
  );

  const expectedPattern =
    /<label class="toggle">\s*<input id="hiddenTextEnabled" type="checkbox" \/>\s*<span class="toggle-ui" aria-hidden="true"><\/span>\s*<span class="toggle-text">히든 메세지 감춤<\/span>\s*<\/label>\s*<span class="label">\(히든메세지 설정시, 'This message has been hidden\.' 이라는 메세지들이 감춰집니다\)<\/span>/;
  const legacyPattern =
    /<label class="toggle">\s*<input id="hiddenTextEnabled" type="checkbox" \/>\s*<span class="toggle-ui" aria-hidden="true"><\/span>\s*<span class="toggle-text">히든 메세지 감춤<\/span>\s*<small>\('This message has been hidden\.' 이라는 메세지들이 감춰집니다\)<\/small>\s*<\/label>/;

  assert.match(chromePopup, expectedPattern);
  assert.match(firefoxWebPopup, expectedPattern);
  assert.doesNotMatch(chromePopup, legacyPattern);
  assert.doesNotMatch(firefoxWebPopup, legacyPattern);
});
