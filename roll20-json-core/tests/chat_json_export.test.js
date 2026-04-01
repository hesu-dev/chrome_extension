const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildChatJsonDocument,
  buildChatJsonEntry,
} = require("../src/chat_json_export.js");

test("buildChatJsonDocument sets version to 1 with a root titlePage", () => {
  const doc = buildChatJsonDocument({ scenarioTitle: "테스트", lines: [] });
  assert.equal(doc.version, 1);
  assert.equal(doc.titlePage.scenarioTitle, "테스트");
  assert.deepEqual(doc.lines, []);
});

test("buildChatJsonEntry normalizes text and color and emits portrait pair payload", () => {
  const entry = buildChatJsonEntry({
    id: "1",
    speaker: "홍길동",
    text: " 안녕   하세요 ",
    textColor: "#ffffff",
    speakerImageUrl: "https://example.com/avatar.png",
  });

  assert.equal(entry.id, "1");
  assert.equal(entry.speaker, "홍길동");
  assert.equal(entry.text, " 안녕   하세요 ");
  assert.equal(entry.safetext, "안녕 하세요");
  assert.equal(entry.textColor, "#ffffff");
  assert.equal(entry.input.portrait.mode, "pair");
  assert.equal(
    entry.input.portrait.images.avatar.originUrl,
    "https://example.com/avatar.png"
  );
});

test("buildChatJsonEntry emits portrait none and canonical dice version", () => {
  const entry = buildChatJsonEntry({
    id: "2",
    speaker: "SYSTEM",
    role: "dice",
    text: "SAN 체크",
    dice: {
      source: "roll20",
      rule: "coc7",
      template: "coc-text",
      inputs: {
        skill: "SAN",
        target: 55,
        roll: 67,
      },
    },
  });

  assert.equal(entry.input.portrait.mode, "none");
  assert.equal(entry.input.dice.v, 1);
  assert.equal(entry.input.dice.rule, "coc7");
});
