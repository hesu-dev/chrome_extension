(function () {
  const coreApi =
    typeof module !== "undefined" && module.exports
      ? require("../../../../roll20-json-core/src/chat_json_export.js")
      : window.Roll20JsonCore?.chatJson || {};
  const parserUtils =
    typeof module !== "undefined" && module.exports
      ? require("../../../../roll20-json-core/src/parsers/parser_utils.js")
      : window.Roll20JsonCore?.parserUtils || {};
  const cocRuleParser =
    typeof module !== "undefined" && module.exports
      ? require("./parsers/coc/coc_rule_parser.js")
      : window.Roll20CleanerCocRuleParser || {};

  function parseRoll20DicePayload({ role, html }) {
    const parsed =
      typeof coreApi.parseRoll20DicePayload === "function"
        ? coreApi.parseRoll20DicePayload({ role, html })
        : null;
    if (parsed) return parsed;

    const template =
      typeof parserUtils.extractTemplateName === "function" ? parserUtils.extractTemplateName(html) : "";
    if (
      String(role || "").toLowerCase() === "dice" &&
      String(template || "").toLowerCase() === "coc-attack-bonus" &&
      typeof cocRuleParser.parseCocRulePayload === "function"
    ) {
      return cocRuleParser.parseCocRulePayload({
        html,
        template: "coc-attack-bonus-penalty",
      });
    }

    return null;
  }

  const api = {
    ...coreApi,
    parseRoll20DicePayload,
  };

  if (typeof window !== "undefined") {
    window.Roll20CleanerChatJson = window.Roll20CleanerChatJson || {};
    Object.assign(window.Roll20CleanerChatJson, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
