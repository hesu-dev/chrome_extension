function notReady() {
  throw new Error("shared core not implemented yet");
}

const parserUtils = require("./parsers/parser_utils.js");

module.exports = {
  parseRoll20DicePayload: notReady,
  buildChatJsonDocument: notReady,
  buildChatJsonEntry: notReady,
  parserUtils,
};
