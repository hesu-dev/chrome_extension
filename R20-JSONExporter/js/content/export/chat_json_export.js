(function () {
  const api =
    typeof module !== "undefined" && module.exports
      ? require("../../../../roll20-json-core/src/chat_json_export.js")
      : window.Roll20JsonCore?.chatJson || {};

  if (typeof window !== "undefined") {
    window.Roll20CleanerChatJson = window.Roll20CleanerChatJson || {};
    Object.assign(window.Roll20CleanerChatJson, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
