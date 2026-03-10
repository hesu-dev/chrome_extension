(function () {
  const api =
    typeof module !== "undefined" && module.exports
      ? require("../../../../../roll20-json-core/src/parsers/parser_utils.js")
      : window.Roll20JsonCore?.parserUtils || {};

  if (typeof window !== "undefined") {
    window.Roll20CleanerParserUtils = window.Roll20CleanerParserUtils || {};
    Object.assign(window.Roll20CleanerParserUtils, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
