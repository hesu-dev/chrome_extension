const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const popupHtml = fs.readFileSync(path.join(__dirname, "..", "popup.html"), "utf8");

test("firefox mobile popup exposes the same ReadingLog actions as chrome", () => {
  assert.match(popupHtml, /다운로드전 이미지 링크 확인/);
  assert.match(popupHtml, /ReadingLog 파일 다운로드/);
  assert.match(popupHtml, /id="avatarEditor"/);
  assert.match(popupHtml, /id="avatarList"/);
  assert.match(popupHtml, /js\/popup\/avatar_preview\.js/);
});
