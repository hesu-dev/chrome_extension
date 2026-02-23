(function () {
  const parserUtils =
    typeof module !== "undefined" && module.exports
      ? require("./parsers/parser_utils.js")
      : window.Roll20CleanerParserUtils || {};

  const cocRuleParser =
    typeof module !== "undefined" && module.exports
      ? require("./parsers/coc/coc_rule_parser.js")
      : window.Roll20CleanerCocRuleParser || {};

  const insaneRuleParser =
    typeof module !== "undefined" && module.exports
      ? require("./parsers/insane/insane_rule_parser.js")
      : window.Roll20CleanerInsaneRuleParser || {};

  const HIDDEN_PLACEHOLDER_TEXT = "This message has been hidden";

  function isHiddenMessagePlaceholderText(raw) {
    const normalized = String(raw || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!normalized) return false;
    return normalized.includes(HIDDEN_PLACEHOLDER_TEXT.toLowerCase());
  }

  function parseRoll20DicePayload({ role, html }) {
    const { extractTemplateName, stripHtmlTags, normalizeText } = parserUtils;
    const template = extractTemplateName(html);
    const parseCocDefaultPayload = cocRuleParser.parseCocDefaultPayload;
    if (typeof parseCocDefaultPayload === "function") {
      const defaultPayload = parseCocDefaultPayload({ html, template });
      if (defaultPayload) return defaultPayload;
    }
    if (String(role || "").toLowerCase() !== "dice") return null;

    const ruleParsers = [
      insaneRuleParser.parseInsaneRulePayload,
      cocRuleParser.parseCocRulePayload,
    ].filter((fn) => typeof fn === "function");

    for (const parseRulePayload of ruleParsers) {
      const parsed = parseRulePayload({ html, template });
      if (parsed) return parsed;
    }

    const safeNormalize = typeof normalizeText === "function" ? normalizeText : normalizeMessageText;
    const safeStripTags =
      typeof stripHtmlTags === "function"
        ? stripHtmlTags
        : (rawHtml) => String(rawHtml || "").replace(/<[^>]*>/g, " ");
    const renderedText = safeNormalize(safeStripTags(html));
    const cocLikeMatch = renderedText.match(
      /^(.+?)\s+기준치:\s*(\d+)(?:\s*\/\s*\d+){0,2}\s+굴림:\s*(\d+)(?:\s+판정결과:\s*(.+))?$/i
    );
    if (cocLikeMatch) {
      return {
        v: 1,
        source: "roll20",
        rule: "coc7",
        template: "coc-text",
        inputs: {
          skill: safeNormalize(cocLikeMatch[1] || ""),
          success: Number(cocLikeMatch[2]),
          roll: Number(cocLikeMatch[3]),
          result: safeNormalize(cocLikeMatch[4] || "") || null,
        },
      };
    }

    return null;
  }

  function normalizeMessageText(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim();
  }

  function joinDescAnchorLines(rawHtml, lineBreakToken = "\n") {
    const { normalizeText, stripHtmlTags } = parserUtils;
    const safeNormalize = typeof normalizeText === "function" ? normalizeText : normalizeMessageText;
    const safeStripTags =
      typeof stripHtmlTags === "function"
        ? stripHtmlTags
        : (html) => String(html || "").replace(/<[^>]*>/g, " ");

    const lines = [];
    const regex = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
    let matched = regex.exec(String(rawHtml || ""));
    while (matched) {
      const line = safeNormalize(safeStripTags(matched[1] || ""));
      if (line) lines.push(line);
      matched = regex.exec(String(rawHtml || ""));
    }

    if (lines.length < 2) return "";
    return lines.join(String(lineBreakToken || "\n"));
  }

  function normalizeImgurLinksInJsonText(rawJsonText) {
    return String(rawJsonText || "").replace(
      /https:\/\/(?:www\.)?imgur\.com\//gi,
      "https://i.imgur.com/"
    );
  }

  function resolveMessageId(message, index) {
    const direct = String(message?.id || "").trim();
    if (direct) return direct;
    return String((Number(index) || 0) + 1);
  }

  function collectJsonExportMessages(root) {
    if (!root || typeof root.querySelectorAll !== "function") return [];
    const view =
      root.defaultView ||
      (root.ownerDocument && root.ownerDocument.defaultView) ||
      (typeof window !== "undefined" ? window : null);
    return Array.from(root.querySelectorAll("div.message")).filter((messageEl) => {
      const inlineDisplay = String(messageEl?.style?.display || "")
        .trim()
        .toLowerCase();
      if (inlineDisplay === "none") return false;

      if (view && typeof view.getComputedStyle === "function") {
        const computedDisplay = String(view.getComputedStyle(messageEl)?.display || "")
          .trim()
          .toLowerCase();
        if (computedDisplay === "none") return false;
      }

      return true;
    });
  }

  function formatTimestampToKoreanMeridiem(rawTimestamp) {
    const normalized = normalizeMessageText(rawTimestamp);
    if (!normalized) return "";

    const alreadyKorean = normalized.match(/^(오전|오후)\s*(\d{1,2}):(\d{2})$/);
    if (alreadyKorean) return `${alreadyKorean[1]} ${alreadyKorean[2]}:${alreadyKorean[3]}`;

    const ampmMatch = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
    if (!ampmMatch) return normalized;

    const hour = Number(ampmMatch[1]);
    const minute = ampmMatch[2];
    if (!Number.isFinite(hour) || hour < 1 || hour > 12) return normalized;
    const meridiem = String(ampmMatch[3] || "").toUpperCase() === "AM" ? "오전" : "오후";
    return `${meridiem} ${hour}:${minute}`;
  }

  function omitNullishDeep(value) {
    if (value == null) return undefined;

    if (Array.isArray(value)) {
      return value
        .map((item) => omitNullishDeep(item))
        .filter((item) => item !== undefined);
    }

    if (typeof value === "object") {
      const result = {};
      Object.entries(value).forEach(([key, val]) => {
        const cleaned = omitNullishDeep(val);
        if (cleaned !== undefined) result[key] = cleaned;
      });
      return result;
    }

    return value;
  }

  function buildChatJsonEntry({
    id,
    speaker,
    role = "character",
    text,
    timestamp = "",
    textColor = "",
    imageUrl = null,
    speakerImageUrl = null,
    dice = null,
  }) {
    const safeTextBuilder =
      typeof parserUtils.toSafeText === "function"
        ? parserUtils.toSafeText
        : (raw) =>
            String(raw || "")
              .replace(/[^\p{L}\p{N}\s!?.,~]/gu, "")
              .replace(/\s+/g, " ")
              .trim();
    const normalizedText = String(text || "");
    const entry = {
      id: String(id || ""),
      speaker: String(speaker || ""),
      role: String(role || "character"),
      timestamp: formatTimestampToKoreanMeridiem(timestamp),
      textColor: String(textColor || "").trim(),
      text: normalizedText,
      safetext: safeTextBuilder(normalizedText),
      imageUrl: imageUrl == null ? null : String(imageUrl),
      speakerImageUrl: speakerImageUrl == null ? null : String(speakerImageUrl),
    };

    if (dice && typeof dice === "object") {
      entry.dice = dice;
    }

    return omitNullishDeep(entry);
  }

  const api = {
    parseRoll20DicePayload,
    isHiddenMessagePlaceholderText,
    normalizeMessageText,
    joinDescAnchorLines,
    normalizeImgurLinksInJsonText,
    resolveMessageId,
    collectJsonExportMessages,
    buildChatJsonEntry,
  };

  if (typeof window !== "undefined") {
    window.Roll20CleanerChatJson = window.Roll20CleanerChatJson || {};
    Object.assign(window.Roll20CleanerChatJson, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
