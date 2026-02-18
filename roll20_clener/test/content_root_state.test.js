const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeRootClassDesired,
  syncRootClass,
  shouldResyncOnMutations,
  createCoalescedScheduler,
} = require("../root_state.js");

function createMockClassList(initial = []) {
  const set = new Set(initial);
  return {
    contains: (name) => set.has(name),
    add: (name) => set.add(name),
    remove: (name) => set.delete(name),
  };
}

test("computeRootClassDesired returns true when any filter is enabled", () => {
  assert.equal(
    computeRootClassDesired({ colorFilterEnabled: true, hiddenTextEnabled: false }),
    true
  );
  assert.equal(
    computeRootClassDesired({ colorFilterEnabled: false, hiddenTextEnabled: true }),
    true
  );
  assert.equal(
    computeRootClassDesired({ colorFilterEnabled: false, hiddenTextEnabled: false }),
    false
  );
});

test("syncRootClass recovers class when it was removed unexpectedly", () => {
  const rootClass = "roll20-cleaner-enabled";
  const classList = createMockClassList([]);

  assert.equal(syncRootClass(classList, rootClass, true), true);
  assert.equal(classList.contains(rootClass), true);

  classList.remove(rootClass);
  assert.equal(syncRootClass(classList, rootClass, true), true);
  assert.equal(classList.contains(rootClass), true);
});

test("syncRootClass is no-op when class already matches desired state", () => {
  const rootClass = "roll20-cleaner-enabled";
  const classList = createMockClassList([rootClass]);

  assert.equal(syncRootClass(classList, rootClass, true), false);
  assert.equal(classList.contains(rootClass), true);
});

test("shouldResyncOnMutations reacts only to html class mutations", () => {
  const rootEl = { tagName: "HTML" };
  const otherEl = { tagName: "DIV" };

  assert.equal(
    shouldResyncOnMutations([{ type: "attributes", attributeName: "class", target: rootEl }], rootEl),
    true
  );
  assert.equal(
    shouldResyncOnMutations([{ type: "attributes", attributeName: "style", target: rootEl }], rootEl),
    false
  );
  assert.equal(
    shouldResyncOnMutations([{ type: "attributes", attributeName: "class", target: otherEl }], rootEl),
    false
  );
});

test("createCoalescedScheduler runs once for burst calls", async () => {
  let called = 0;
  const scheduler = createCoalescedScheduler(() => {
    called += 1;
  });

  scheduler();
  scheduler();
  scheduler();

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(called, 1);
});
