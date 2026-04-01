const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildChatJsonDocument,
  buildChatJsonEntry,
} = require("../src/chat_json_export.js");

test("shared fixture preserves a stable cross-target chat json shape", () => {
  const lines = [
    buildChatJsonEntry({
      id: "1",
      speaker: "KP",
      role: "character",
      timestamp: "8:15 PM",
      text: "조사 개시",
      speakerImageUrl: "https://example.com/kp.png",
    }),
    buildChatJsonEntry({
      id: "2",
      speaker: "System",
      role: "dice",
      text: "SAN 판정",
      dice: {
        v: 1,
        source: "roll20",
        rule: "coc7",
        template: "coc-text",
        inputs: {
          skill: "SAN",
          target: 60,
          roll: 74,
        },
      },
    }),
  ];

  const doc = buildChatJsonDocument({
    scenarioTitle: "fixture",
    lines,
  });

  assert.equal(doc.version, 1);
  assert.equal(Array.isArray(doc.lines), true);
  assert.equal(doc.titlePage.scenarioTitle, "fixture");
  assert.equal(doc.titlePage.ruleType, "COC");
  assert.equal(doc.lines[0].speaker, "KP");
  assert.equal(
    doc.lines[0].input.portrait.images.avatar.originUrl,
    "https://example.com/kp.png"
  );
  assert.equal(doc.lines[1].role, "dice");
  assert.equal(doc.lines[1].input.dice.rule, "coc7");
  assert.equal(doc.lines[1].input.dice.v, 1);
});
