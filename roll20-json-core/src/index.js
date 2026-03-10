function notReady() {
  throw new Error("shared core not implemented yet");
}

const parserUtils = require("./parsers/parser_utils.js");
const cocRuleParser = require("./parsers/coc_rule_parser.js");
const insaneRuleParser = require("./parsers/insane_rule_parser.js");
const chatJson = require("./chat_json_export.js");
const browserContract = {
  parserUtils,
  cocRuleParser,
  insaneRuleParser,
  chatJson,
};

module.exports = {
  parseRoll20DicePayload: chatJson.parseRoll20DicePayload || notReady,
  buildChatJsonDocument: chatJson.buildChatJsonDocument || notReady,
  buildChatJsonEntry: chatJson.buildChatJsonEntry || notReady,
  parserUtils,
  cocRuleParser,
  insaneRuleParser,
  chatJson,
  browserContract,
};
