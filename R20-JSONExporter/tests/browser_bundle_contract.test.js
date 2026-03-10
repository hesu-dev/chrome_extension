const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../../roll20-json-core/src/index.js");

test("browser contract groups parser and chat modules", () => {
  assert.equal(typeof core.browserContract, "object");
  assert.equal(typeof core.browserContract.chatJson.parseRoll20DicePayload, "function");
  assert.equal(typeof core.browserContract.parserUtils.normalizeText, "function");
  assert.equal(typeof core.browserContract.cocRuleParser.parseCocRulePayload, "function");
  assert.equal(typeof core.browserContract.insaneRuleParser.parseInsaneRulePayload, "function");
});
