const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const popupHtmlPath = path.join(
  __dirname,
  "..",
  "..",
  "R20-JSONExporter-safari-app",
  "ios",
  "Roll20SafariExtension",
  "Resources",
  "popup.html"
);

test("safari popup shell shows Korean readinglog copy guidance", () => {
  const popupHtml = fs.readFileSync(popupHtmlPath, "utf8");

  assert.match(popupHtml, /<html lang="ko">/);
  assert.match(popupHtml, /<title>리딩로그 가져오기<\/title>/);
  assert.doesNotMatch(popupHtml, /<h1>/);
  assert.match(popupHtml, /Roll20 채팅 로그를 리딩로그 파일로 복사합니다\./);
  assert.match(popupHtml, /<button id="exportButton" type="button">리딩로그로 복사하기<\/button>/);
  assert.match(popupHtml, /background: #225a83;/);
  assert.match(popupHtml, /<dt>단계<\/dt>/);
  assert.match(popupHtml, /<dt>메시지 수<\/dt>/);
  assert.match(popupHtml, /<dd id="statusMessage">Roll20 채팅 로그를 가져올 준비가 되었습니다\.<\/dd>/);
  assert.match(popupHtml, /<dd id="statusPayload">현재 파일 크기를 아직 계산하지 않았습니다\.<\/dd>/);
  assert.match(popupHtml, /<!-- <dt>보관함<\/dt>/);
});
