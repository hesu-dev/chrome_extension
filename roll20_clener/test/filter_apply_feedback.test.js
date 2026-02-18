const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getSavedStatusMessage,
  isNonFatalApplyDispatchError,
  toApplyProgressPercent,
} = require("../filter_apply_feedback.js");

test("getSavedStatusMessage returns unified saved text", () => {
  assert.equal(
    getSavedStatusMessage(),
    "설정은 저장되었습니다. 반영되었으니 화면을 확인해주세요."
  );
});

test("isNonFatalApplyDispatchError treats permission/port issues as non-fatal", () => {
  assert.equal(
    isNonFatalApplyDispatchError("The message port closed before a response was received."),
    true
  );
  assert.equal(
    isNonFatalApplyDispatchError("Could not establish connection. Receiving end does not exist."),
    true
  );
  assert.equal(
    isNonFatalApplyDispatchError("Cannot access contents of url"),
    true
  );
  assert.equal(isNonFatalApplyDispatchError("HTTP 500"), false);
});

test("toApplyProgressPercent clamps progress and reserves finish for done event", () => {
  assert.equal(toApplyProgressPercent(0, 100), 15);
  assert.equal(toApplyProgressPercent(50, 100), 55);
  assert.equal(toApplyProgressPercent(100, 100), 95);
  assert.equal(toApplyProgressPercent(400, 100), 95);
});
