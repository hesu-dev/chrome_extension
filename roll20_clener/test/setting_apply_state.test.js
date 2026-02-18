const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeExpectedRootClassEnabled,
  isRootClassApplied,
} = require("../setting_apply_state.js");

test("computeExpectedRootClassEnabled reflects checkbox states", () => {
  assert.equal(
    computeExpectedRootClassEnabled({ colorFilterEnabled: true, hiddenTextEnabled: false }),
    true
  );
  assert.equal(
    computeExpectedRootClassEnabled({ colorFilterEnabled: false, hiddenTextEnabled: true }),
    true
  );
  assert.equal(
    computeExpectedRootClassEnabled({ colorFilterEnabled: false, hiddenTextEnabled: false }),
    false
  );
});

test("isRootClassApplied requires expected applied state", () => {
  assert.equal(
    isRootClassApplied(
      { ok: true, desiredRootClassEnabled: true, rootClassApplied: true },
      true
    ),
    true
  );
  assert.equal(
    isRootClassApplied(
      { ok: true, desiredRootClassEnabled: true, rootClassApplied: false },
      true
    ),
    false
  );
  assert.equal(
    isRootClassApplied(
      { ok: true, desiredRootClassEnabled: false, rootClassApplied: false },
      false
    ),
    true
  );
});

test("isRootClassApplied returns false for invalid payloads", () => {
  assert.equal(isRootClassApplied(null, true), false);
  assert.equal(isRootClassApplied({ ok: false }, true), false);
  assert.equal(isRootClassApplied({ ok: true, rootClassApplied: "yes" }, true), false);
  assert.equal(
    isRootClassApplied(
      { ok: true, desiredRootClassEnabled: false, rootClassApplied: true },
      true
    ),
    false
  );
});
