(function () {
  const api =
    typeof module !== "undefined" && module.exports
      ? require("../../../../../../roll20-json-core/src/parsers/insane_rule_parser.js")
      : window.Roll20JsonCore?.insaneRuleParser || {};

  if (typeof window !== "undefined") {
    window.Roll20CleanerInsaneRuleParser = window.Roll20CleanerInsaneRuleParser || {};
    Object.assign(window.Roll20CleanerInsaneRuleParser, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
