const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const progressModelPath = path.join(
  __dirname,
  "..",
  "..",
  "R20-JSONExporter-safari-app",
  "ios",
  "Roll20SafariExtension",
  "Resources",
  "js",
  "export_progress_model.js"
);

const {
  EXPORT_PROGRESS_STAGES,
  createInitialExportProgress,
  updateExportProgress,
} = require(progressModelPath);

test("safari export progress model exposes ordered stages and immutable updates", () => {
  assert.deepEqual(EXPORT_PROGRESS_STAGES, [
    "idle",
    "checking_page",
    "measuring_dom",
    "building_json",
    "checking_storage",
    "writing_inbox",
    "done",
    "error",
  ]);

  const initial = createInitialExportProgress();
  const next = updateExportProgress(initial, {
    stage: "measuring_dom",
    message: "현재 열려 있는 Roll20 채팅 로그를 확인하고 있습니다.",
    metrics: {
      messageCount: 12,
      domNodeEstimate: 84,
    },
  });

  assert.equal(initial.stage, "idle");
  assert.equal(initial.message, "Roll20 채팅 로그를 가져올 준비가 되었습니다.");
  assert.equal(next.stage, "measuring_dom");
  assert.equal(next.message, "현재 열려 있는 Roll20 채팅 로그를 확인하고 있습니다.");
  assert.deepEqual(next.metrics, {
    messageCount: 12,
    domNodeEstimate: 84,
  });
});
