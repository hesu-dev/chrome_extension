(function () {
  const api =
    typeof module !== "undefined" && module.exports
      ? require("../../../../../../roll20-json-core/src/parsers/coc_rule_parser.js")
      : window.Roll20JsonCore?.cocRuleParser || {};

  if (typeof window !== "undefined") {
    window.Roll20CleanerCocRuleParser = window.Roll20CleanerCocRuleParser || {};
    Object.assign(window.Roll20CleanerCocRuleParser, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
