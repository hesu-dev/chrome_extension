function notReady() {
  throw new Error("shared core not implemented yet");
}

module.exports = {
  parseRoll20DicePayload: notReady,
  buildChatJsonDocument: notReady,
  buildChatJsonEntry: notReady,
};
