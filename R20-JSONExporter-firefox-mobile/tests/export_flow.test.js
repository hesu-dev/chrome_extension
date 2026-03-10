const test = require("node:test");
const assert = require("node:assert/strict");

const { getFirefoxExportAction } = require("../js/popup/popup.js");

test("firefox mobile export prefers file download", () => {
  const action = getFirefoxExportAction({ canDownload: true, canShare: true });
  assert.equal(action.primary, "download");
  assert.deepEqual(action.fallbacks, ["share"]);
});

test("firefox mobile export falls back to share when download is unavailable", () => {
  const action = getFirefoxExportAction({ canDownload: false, canShare: true });
  assert.equal(action.primary, "share");
});
