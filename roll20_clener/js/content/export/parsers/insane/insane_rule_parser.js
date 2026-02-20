(function () {
  const parserUtils =
    typeof module !== "undefined" && module.exports
      ? require("../parser_utils.js")
      : window.Roll20CleanerParserUtils || {};

  function parseInsanePayload(html, template) {
    const {
      extractElementInnerHtmlByClass,
      normalizeText,
      stripHtmlTags,
      sanitizeTrailingColon,
      collectInlineRollSpanIntegers,
    } = parserUtils;
    if (String(template || "").toLowerCase() !== "insane") return null;
    const safeHtml = String(html || "");

    const diceAreaHtml = extractElementInnerHtmlByClass(safeHtml, "div", "sheet-dice-area");
    const resultHtml = extractElementInnerHtmlByClass(safeHtml, "div", "sheet-dice-result");
    const checkHtml = extractElementInnerHtmlByClass(diceAreaHtml, "strong");
    const checkText = normalizeText(stripHtmlTags(checkHtml || diceAreaHtml));
    const skill = sanitizeTrailingColon(checkText);

    const targetRolls = collectInlineRollSpanIntegers(diceAreaHtml);
    const resultRolls = collectInlineRollSpanIntegers(resultHtml);
    const target = targetRolls.length ? targetRolls[targetRolls.length - 1] : null;
    const roll = resultRolls.length ? resultRolls[0] : null;
    if (!skill || !Number.isFinite(target) || !Number.isFinite(roll)) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "insane",
      template: "insane-dice",
      inputs: { skill, target, roll },
    };
  }

  function parseInsDicePayload(html, template) {
    const { normalizeText, stripHtmlTags, extractFirstIntegerFromRenderedHtml } = parserUtils;
    if (String(template || "").toLowerCase() !== "insdice") return null;
    const safeHtml = String(html || "");

    const skillMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-subj\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );
    const targetSpanMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-target\b(?!-result)[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*\binlinerollresult\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );
    const rollSpanMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-dice-val\b[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*\binlinerollresult\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );

    const skill = normalizeText(stripHtmlTags(skillMatch?.[1] || ""));
    const target = extractFirstIntegerFromRenderedHtml(targetSpanMatch?.[1] || "");
    const roll = extractFirstIntegerFromRenderedHtml(rollSpanMatch?.[1] || "");
    if (!skill || !Number.isFinite(target) || !Number.isFinite(roll)) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "insane",
      template: "insane-dice",
      inputs: { skill, target, roll },
    };
  }

  function parseInsSkillPayload(html, template) {
    const { normalizeText, stripHtmlTags, extractFirstIntegerFromRenderedHtml } = parserUtils;
    if (String(template || "").toLowerCase() !== "insskill") return null;
    const safeHtml = String(html || "");

    const headSubjMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-subj\b[^"']*["'][^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<strong[^>]*>([\s\S]*?)<\/strong>[\s\S]*?<\/div>/i
    );
    const detailMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-desc\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );
    const dataSubjMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-data\b[^"']*["'][^>]*>[\s\S]*?<div[^>]*class=["'][^"']*\bsheet-subj\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );
    const targetSpanMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-target\b(?!-result)[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*\binlinerollresult\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );
    const rollSpanMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-dice-val\b[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*\binlinerollresult\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );

    const type = normalizeText(stripHtmlTags(headSubjMatch?.[1] || ""));
    const title = normalizeText(stripHtmlTags(headSubjMatch?.[2] || ""));
    const detail = normalizeText(stripHtmlTags(detailMatch?.[1] || ""));
    const skill = normalizeText(stripHtmlTags(dataSubjMatch?.[1] || "")) || null;
    const target = extractFirstIntegerFromRenderedHtml(targetSpanMatch?.[1] || "");
    const roll = extractFirstIntegerFromRenderedHtml(rollSpanMatch?.[1] || "");
    if (!type || !title || !detail) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "insane",
      template: "ability",
      inputs: {
        type,
        title,
        detail,
        skill,
        target: Number.isFinite(target) ? target : null,
        roll: Number.isFinite(roll) ? roll : null,
      },
    };
  }

  function parseInsDescPayload(html, template) {
    const { normalizeText, stripHtmlTags } = parserUtils;
    if (String(template || "").toLowerCase() !== "insdesc") return null;
    const safeHtml = String(html || "");

    const emotionMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-desc\b[^"']*\bsheet-emot\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );
    const emotionTitle = normalizeText(stripHtmlTags(emotionMatch?.[1] || ""));
    if (emotionTitle) {
      return {
        v: 1,
        source: "roll20",
        rule: "insane",
        template: "emotion",
        inputs: {
          type: "감정",
          title: emotionTitle,
          detail: null,
          skill: null,
          target: null,
          roll: null,
        },
      };
    }

    const headSubjMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-subj\b[^"']*["'][^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<strong[^>]*>([\s\S]*?)<\/strong>[\s\S]*?<\/div>/i
    );
    const detailMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-desc\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );

    const type = normalizeText(stripHtmlTags(headSubjMatch?.[1] || ""));
    const title = normalizeText(stripHtmlTags(headSubjMatch?.[2] || ""));
    const detail = normalizeText(stripHtmlTags(detailMatch?.[1] || ""));

    if (type && title && detail) {
      return {
        v: 1,
        source: "roll20",
        rule: "insane",
        template: "item",
        inputs: {
          type,
          title,
          detail,
          skill: null,
          target: null,
          roll: null,
        },
      };
    }

    const singleSubjMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-subj\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );
    const singleTitleRaw = normalizeText(stripHtmlTags(singleSubjMatch?.[1] || ""));
    if (!singleTitleRaw || !detail) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "insane",
      template: "scene-table",
      inputs: {
        type: null,
        title: "장면표",
        detail,
        skill: null,
        target: null,
        roll: null,
      },
    };
  }

  function normalizeInsPlotTitle(raw) {
    const { normalizeText } = parserUtils;
    const text = normalizeText(raw);
    if (!text) return "";
    return text.replace(/^(\d+)\.\s*/, "$1. ");
  }

  function normalizeInsPlotSkill(raw) {
    const { normalizeText } = parserUtils;
    const text = normalizeText(raw);
    if (!text) return "";
    if (text === "파괴") return "포박";
    return text;
  }

  function parseInsPlotPayload(html, template) {
    const { stripHtmlTags } = parserUtils;
    if (String(template || "").toLowerCase() !== "insplot") return null;
    const safeHtml = String(html || "");
    const titleMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-random\b[^"']*["'][^>]*>[\s\S]*?<strong[^>]*>[\s\S]*?<em[^>]*>([\s\S]*?)<\/em>[\s\S]*?<\/strong>/i
    );
    const skillMatch = safeHtml.match(
      /<div[^>]*class=["'][^"']*\bsheet-random\b[^"']*["'][^>]*>[\s\S]*?<span[^>]*>[\s\S]*?<em[^>]*>([\s\S]*?)<\/em>[\s\S]*?<\/span>/i
    );

    const title = normalizeInsPlotTitle(stripHtmlTags(titleMatch?.[1] || ""));
    const skill = normalizeInsPlotSkill(stripHtmlTags(skillMatch?.[1] || ""));
    if (!title || !skill) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "insane",
      template: "dice",
      inputs: {
        type: null,
        title,
        detail: null,
        skill,
        target: null,
        roll: null,
      },
    };
  }

  function parseInsaneRulePayload({ html, template }) {
    if (template === "insane") return parseInsanePayload(html, template);
    if (template === "insdice") return parseInsDicePayload(html, template);
    if (template === "insskill") return parseInsSkillPayload(html, template);
    if (template === "insdesc") return parseInsDescPayload(html, template);
    if (template === "insplot") return parseInsPlotPayload(html, template);
    return null;
  }

  const api = { parseInsaneRulePayload };

  if (typeof window !== "undefined") {
    window.Roll20CleanerInsaneRuleParser = window.Roll20CleanerInsaneRuleParser || {};
    Object.assign(window.Roll20CleanerInsaneRuleParser, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
