const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const popupHtml = fs.readFileSync(path.join(__dirname, "..", "popup.html"), "utf8");
const manifest = require("../manifest.json");

test("popup exposes the renamed image-link check and shared ReadingLog download buttons", () => {
  assert.match(popupHtml, /<h1>Exporter Setting<\/h1>/);
  assert.match(
    popupHtml,
    /현재 한국어만 지원합니다, Roll20 채팅로그\(Show on One Page\)화면 에서 사용하세요\./
  );
  assert.match(popupHtml, /다운로드전 이미지 링크 확인/);
  assert.match(popupHtml, /ReadingLog 파일 다운로드/);
  assert.doesNotMatch(popupHtml, /프로필 이미지 교체/);
  assert.doesNotMatch(popupHtml, /Reading용 다운로드/);
  assert.doesNotMatch(
    popupHtml,
    /<button id="downloadAvatarMappedJson"[^>]*\bhidden\b/i
  );
  assert.match(popupHtml, /js\/popup\/avatar_preview\.js/);
});

test("popup keeps the hidden message toggle label and helper text outside the toggle body", () => {
  assert.match(
    popupHtml,
    /<label class="toggle">\s*<input id="hiddenTextEnabled" type="checkbox" \/>\s*<span class="toggle-ui" aria-hidden="true"><\/span>\s*<span class="toggle-text">히든 메세지 감춤<\/span>\s*<\/label>\s*<span class="label">\(히든메세지 설정시, 'This message has been hidden\.' 이라는 메세지들이 감춰집니다\)<\/span>/
  );
  assert.doesNotMatch(
    popupHtml,
    /<label class="toggle">\s*<input id="hiddenTextEnabled" type="checkbox" \/>\s*<span class="toggle-ui" aria-hidden="true"><\/span>\s*<span class="toggle-text">히든 메세지 감춤<\/span>\s*<small>\('This message has been hidden\.' 이라는 메세지들이 감춰집니다\)<\/small>\s*<\/label>/
  );
});

test("chrome manifest version is bumped to 0.8.1", () => {
  assert.equal(manifest.version, "0.8.1");
});
