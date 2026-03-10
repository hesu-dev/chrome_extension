function notReady() {
  throw new Error("shared core not implemented yet");
}

const parserUtils = require("./parsers/parser_utils.js");
const cocRuleParser = require("./parsers/coc_rule_parser.js");
const insaneRuleParser = require("./parsers/insane_rule_parser.js");

module.exports = {
  parseRoll20DicePayload: notReady,
  buildChatJsonDocument: notReady,
  buildChatJsonEntry: notReady,
  parserUtils,
  cocRuleParser,
  insaneRuleParser,
};
