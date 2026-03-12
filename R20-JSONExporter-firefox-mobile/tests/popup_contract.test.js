const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const popupHtml = fs.readFileSync(path.join(__dirname, "..", "popup.html"), "utf8");

test("firefox mobile popup exposes image-check and deeplink-localhost actions", () => {
  assert.match(popupHtml, /다운로드전 이미지 링크 확인/);
  assert.match(popupHtml, /ReadingLog 앱으로 데이터 보내기/);
  assert.match(popupHtml, /작은 JSON은 공유 목록에서 ReadingLog 앱으로 바로 보낼 수 있습니다/);
  assert.doesNotMatch(popupHtml, /id="downloadReadingLogJson"/);
  assert.match(popupHtml, /id="exportProgressWrap"/);
  assert.match(popupHtml, /id="exportProgressBar"/);
  assert.match(popupHtml, /id="exportProgressLabel"/);
  assert.match(popupHtml, /id="exportMeta"/);
  assert.match(popupHtml, /id="avatarEditor"/);
  assert.match(popupHtml, /id="avatarList"/);
  assert.match(popupHtml, /js\/popup\/avatar_preview\.js/);
});
