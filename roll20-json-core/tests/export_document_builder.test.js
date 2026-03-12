const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildExportDocument,
} = require("../src/exporter/export_document_builder.js");

test("buildExportDocument produces a stable ReadingLog document from normalized snapshots", () => {
  const result = buildExportDocument({
    scenarioTitle: "세션A",
    snapshots: [
      {
        id: "msg-1",
        speaker: "KP",
        role: "character",
        timestamp: "8:15 PM",
        textColor: "#ff00aa",
        text: "테스트 메시지",
        speakerImageUrl: "https://cdn.example.com/avatar-final.png",
      },
      {
        id: "msg-2",
        speaker: "System",
        role: "dice",
        text: "SAN 판정",
        dice: {
          source: "roll20",
          rule: "coc7",
          template: "coc-text",
          inputs: {
            skill: "SAN",
            target: 60,
            roll: 74,
          },
        },
      },
    ],
  });

  assert.equal(result.lineCount, 2);
  assert.ok(result.jsonByteLength > 0);
  assert.equal(result.documentPayload.schemaVersion, 1);
  assert.equal(result.documentPayload.ebookView.titlePage.scenarioTitle, "세션A");
  assert.equal(result.documentPayload.ebookView.titlePage.ruleType, "COC");
  assert.equal(
    result.documentPayload.lines[0].input.speakerImages.avatar.url,
    "https://cdn.example.com/avatar-final.png"
  );
  assert.equal(result.documentPayload.lines[1].input.dice.rule, "coc7");
  assert.equal(typeof result.jsonText, "string");
});

test("buildExportDocument canonicalizes legacy coc-init-stc dice templates to coc-dice", () => {
  const result = buildExportDocument({
    snapshots: [
      {
        id: "msg-1",
        speaker: "System",
        role: "dice",
        text: "선제 판정",
        dice: {
          source: "roll20",
          rule: "coc7",
          template: "coc-init-stc",
          inputs: {
            title: "Initiative",
            rows: [{ label: "굴림: DEX 75" }],
          },
        },
      },
    ],
  });

  assert.equal(result.documentPayload.lines[0].input.dice.template, "coc-dice");
  assert.match(result.jsonText, /"template":"coc-dice"/);
  assert.doesNotMatch(result.jsonText, /"template":"coc-init-stc"/);
});
