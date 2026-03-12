const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildChatJsonDocument,
  buildChatJsonEntry,
} = require("../src/chat_json_export.js");

test("buildChatJsonDocument sets schemaVersion to 1", () => {
  const doc = buildChatJsonDocument({ scenarioTitle: "테스트", lines: [] });
  assert.equal(doc.schemaVersion, 1);
  assert.equal(doc.ebookView.titlePage.scenarioTitle, "테스트");
  assert.deepEqual(doc.lines, []);
});

test("buildChatJsonEntry normalizes text and color", () => {
  const entry = buildChatJsonEntry({
    id: "1",
    speaker: "홍길동",
    text: " 안녕   하세요 ",
    textColor: "#ffffff",
  });

  assert.equal(entry.id, "1");
  assert.equal(entry.speaker, "홍길동");
  assert.equal(entry.text, " 안녕   하세요 ");
  assert.equal(entry.safetext, "안녕 하세요");
  assert.equal(entry.textColor, "#ffffff");
});
