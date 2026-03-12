function notReady() {
  throw new Error("shared core not implemented yet");
}

const parserUtils = require("./parsers/parser_utils.js");
const cocRuleParser = require("./parsers/coc_rule_parser.js");
const insaneRuleParser = require("./parsers/insane_rule_parser.js");
const chatJson = require("./chat_json_export.js");
const avatarResolutionContext = require("./exporter/avatar_resolution_context.js");
const messageSnapshotBuilder = require("./exporter/message_snapshot_builder.js");
const exportDocumentBuilder = require("./exporter/export_document_builder.js");
const browserContract = {
  parserUtils,
  cocRuleParser,
  insaneRuleParser,
  chatJson,
  avatarResolutionContext,
  messageSnapshotBuilder,
  exportDocumentBuilder,
};

module.exports = {
  parseRoll20DicePayload: chatJson.parseRoll20DicePayload || notReady,
  buildChatJsonDocument: chatJson.buildChatJsonDocument || notReady,
  buildChatJsonEntry: chatJson.buildChatJsonEntry || notReady,
  buildExportDocument: exportDocumentBuilder.buildExportDocument || notReady,
  parserUtils,
  cocRuleParser,
  insaneRuleParser,
  chatJson,
  avatarResolutionContext,
  messageSnapshotBuilder,
  exportDocumentBuilder,
  browserContract,
};
