const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../src/index.js");

test("shared core exposes stable entry points", () => {
  assert.equal(typeof core.parseRoll20DicePayload, "function");
  assert.equal(typeof core.buildChatJsonDocument, "function");
  assert.equal(typeof core.buildChatJsonEntry, "function");
});
