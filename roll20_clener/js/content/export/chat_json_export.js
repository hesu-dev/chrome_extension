(function () {
  const HIDDEN_PLACEHOLDER_TEXT = "This message has been hidden";

  function isHiddenMessagePlaceholderText(raw) {
    const normalized = String(raw || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!normalized) return false;
    return normalized.includes(HIDDEN_PLACEHOLDER_TEXT.toLowerCase());
  }

  function stripHtmlTags(html) {
    return String(html || "").replace(/<[^>]*>/g, " ");
  }

  function normalizeText(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim();
  }

  function extractFirstInteger(raw) {
    const matched = String(raw || "").match(/-?\d+/);
    if (!matched) return null;
    const parsed = Number(matched[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function extractFirstIntegerFromRenderedHtml(rawHtml) {
    return extractFirstInteger(normalizeText(stripHtmlTags(rawHtml)));
  }

  function collectInlineRollSpanIntegers(containerHtml) {
    const values = [];
    const regex =
      /<span[^>]*class=["'][^"']*\binlinerollresult\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
    let matched = regex.exec(String(containerHtml || ""));
    while (matched) {
      const value = extractFirstIntegerFromRenderedHtml(matched[1] || "");
      if (Number.isFinite(value)) values.push(value);
      matched = regex.exec(String(containerHtml || ""));
    }
    return values;
  }

  function collectTemplateValueCells(html) {
    const cells = [];
    const regex = /<td[^>]*class=["'][^"']*\bsheet-template_value\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi;
    let matched = regex.exec(String(html || ""));
    while (matched) {
      cells.push(normalizeText(stripHtmlTags(matched[1])));
      matched = regex.exec(String(html || ""));
    }
    return cells;
  }

  function extractTemplateName(html) {
    const matched = String(html || "").match(/\bsheet-rolltemplate-([a-z0-9-]+)/i);
    if (!matched?.[1]) return "";
    return String(matched[1]).toLowerCase();
  }

  function extractCellHtmlByClass(rowHtml, className) {
    const safeClass = String(className || "").trim();
    if (!safeClass) return "";
    const regex = /<td[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/td>/gi;
    let matched = regex.exec(String(rowHtml || ""));
    while (matched) {
      const classTokens = String(matched[1] || "").split(/\s+/).filter(Boolean);
      if (classTokens.includes(safeClass)) return matched[2] || "";
      matched = regex.exec(String(rowHtml || ""));
    }
    return "";
  }

  function extractElementInnerHtmlByClass(html, tagName, className) {
    const safeTag = String(tagName || "").trim();
    if (!safeTag) return "";
    const escapedTag = safeTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const safeClass = String(className || "").trim();
    const regex = new RegExp(
      `<${escapedTag}\\b([^>]*)>([\\s\\S]*?)<\\/${escapedTag}>`,
      "gi"
    );
    let matched = regex.exec(String(html || ""));
    while (matched) {
      if (!safeClass) return matched[2] || "";
      const attrs = String(matched[1] || "");
      const classMatch = attrs.match(/\bclass=["']([^"']*)["']/i);
      const classTokens = String(classMatch?.[1] || "")
        .split(/\s+/)
        .filter(Boolean);
      if (classTokens.includes(safeClass)) return matched[2] || "";
      matched = regex.exec(String(html || ""));
    }
    return "";
  }

  function collectTemplateRows(html) {
    const rows = [];
    const regex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let matched = regex.exec(String(html || ""));
    while (matched) {
      const rowHtml = matched[1] || "";
      const valueCellHtml = extractCellHtmlByClass(rowHtml, "sheet-template_value");
      const labelCellHtml = extractCellHtmlByClass(rowHtml, "sheet-template_label");
      const rowLabel = normalizeText(stripHtmlTags(valueCellHtml || labelCellHtml || ""));
      if (rowLabel) rows.push({ label: rowLabel });
      matched = regex.exec(String(html || ""));
    }
    return rows;
  }

  function extractTemplateValueCellTexts(html) {
    const cells = [];
    const regex = /<td[^>]*class=["'][^"']*\bsheet-template_value\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi;
    let matched = regex.exec(String(html || ""));
    while (matched) {
      cells.push(normalizeText(stripHtmlTags(matched[1] || "")));
      matched = regex.exec(String(html || ""));
    }
    return cells;
  }

  function sanitizeTrailingColon(text) {
    return normalizeText(String(text || "").replace(/\s*:\s*$/, ""));
  }

  function extractCaptionText(html) {
    const captionMatch = String(html || "").match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    return normalizeText(stripHtmlTags(captionMatch?.[1] || ""));
  }

  function extractCaptionSuffix(captionText) {
    const safe = normalizeText(captionText);
    if (!safe) return "";
    const parts = safe.split(/\s*-\s*/);
    return normalizeText(parts[parts.length - 1] || safe);
  }

  function findIntegerFromTextByKeyword(cells, keyword) {
    const loweredKeyword = String(keyword || "").toLowerCase();
    if (!loweredKeyword) return null;
    for (const cell of cells || []) {
      const safeCell = String(cell || "");
      if (!safeCell.toLowerCase().includes(loweredKeyword)) continue;
      const number = extractFirstInteger(safeCell);
      if (Number.isFinite(number)) return number;
    }
    return null;
  }

  function extractAllIntegers(raw) {
    const matched = String(raw || "").match(/-?\d+/g) || [];
    return matched.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }

  function collectTemplateRowsWithCells(html) {
    const rows = [];
    const regex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let matched = regex.exec(String(html || ""));
    while (matched) {
      const rowHtml = matched[1] || "";
      const labelCellHtml = extractCellHtmlByClass(rowHtml, "sheet-template_label");
      const valueCellHtml = extractCellHtmlByClass(rowHtml, "sheet-template_value");
      rows.push({
        label: normalizeText(stripHtmlTags(labelCellHtml || "")),
        value: normalizeText(stripHtmlTags(valueCellHtml || "")),
      });
      matched = regex.exec(String(html || ""));
    }
    return rows;
  }

  function collectTrInnerHtmlList(html) {
    const list = [];
    const regex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let matched = regex.exec(String(html || ""));
    while (matched) {
      list.push(matched[1] || "");
      matched = regex.exec(String(html || ""));
    }
    return list;
  }

  function collectTdTexts(rowHtml) {
    const values = [];
    const regex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let matched = regex.exec(String(rowHtml || ""));
    while (matched) {
      const text = normalizeText(stripHtmlTags(matched[1] || ""));
      if (text) values.push(text);
      matched = regex.exec(String(rowHtml || ""));
    }
    return values;
  }

  function parseCoc1DicePayload(html) {
    const safeHtml = String(html || "");
    if (!/\bsheet-rolltemplate-coc-1\b/i.test(safeHtml)) return null;

    const captionMatch = safeHtml.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    const captionText = normalizeText(stripHtmlTags(captionMatch?.[1] || ""));
    const skill = captionText.replace(/\s+roll\s*$/i, "").trim();

    const cells = collectTemplateValueCells(safeHtml);
    const success = extractFirstInteger(cells[0] || "");
    const roll = extractFirstInteger(cells[1] || "");

    if (!skill || !Number.isFinite(success) || !Number.isFinite(roll)) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "coc7",
      template: "coc-1",
      inputs: {
        skill,
        roll,
        success,
      },
    };
  }

  function parseCocRowsPayload(html, template) {
    const allowedTemplates = new Set(["coc-dice-roll", "coc-body-hit-loc"]);
    if (!allowedTemplates.has(String(template || "").toLowerCase())) return null;

    const safeHtml = String(html || "");
    const captionMatch = safeHtml.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    const title = normalizeText(stripHtmlTags(captionMatch?.[1] || ""));
    const rows = collectTemplateRows(safeHtml);
    if (!title || !rows.length) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "coc7",
      template: String(template),
      inputs: {
        title,
        rows,
      },
    };
  }

  function parseCocInitStcPayload(html, template) {
    if (String(template || "").toLowerCase() !== "coc-init-stc") return null;
    const safeHtml = String(html || "");
    const title = extractCaptionText(safeHtml);
    const rows = collectTemplateRowsWithCells(safeHtml);
    const firstRow = rows[0] || { label: "", value: "" };
    const label = normalizeText(
      `${sanitizeTrailingColon(firstRow.label || "")}: ${normalizeText(firstRow.value || "")}`
    );
    if (!title || !label) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "coc7",
      template: "coc-init-stc",
      inputs: {
        title,
        rows: [{ label }],
      },
    };
  }

  function parseCocDefence2Payload(html, template) {
    if (String(template || "").toLowerCase() !== "coc-defence-2") return null;
    const safeHtml = String(html || "");
    const caption = extractCaptionText(safeHtml);
    const rows = collectTemplateRowsWithCells(safeHtml);
    const firstRow = rows[0] || { value: "" };
    const value = extractFirstInteger(firstRow.value || "");
    if (!caption || !Number.isFinite(value)) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "coc7",
      template: "coc-defence-2",
      inputs: {
        title: `장갑(방어구) : ${caption}`,
        rows: [{ label: String(value) }],
      },
    };
  }

  function parseDefaultTablePayload(html, template) {
    if (String(template || "").toLowerCase() !== "default") return null;
    const safeHtml = String(html || "");
    const title = extractCaptionText(safeHtml);
    if (!title) return null;

    const rows = [];
    const trList = collectTrInnerHtmlList(safeHtml);
    trList.forEach((trHtml) => {
      const tds = collectTdTexts(trHtml);
      if (tds.length >= 2) {
        rows.push({
          key: tds[0],
          value: tds[1],
        });
      }
    });

    return {
      v: 1,
      source: "roll20",
      rule: "table",
      template: "default",
      inputs: {
        title,
        rows,
      },
    };
  }

  function parseCocBomadnessPayload(html, template) {
    const normalizedTemplate = String(template || "").toLowerCase();
    const allowedTemplates = new Set(["coc-bomadness-rt", "coc-bomadness-summ"]);
    if (!allowedTemplates.has(normalizedTemplate)) return null;

    const safeHtml = String(html || "");
    const title = extractCaptionSuffix(extractCaptionText(safeHtml));
    const cells = extractTemplateValueCellTexts(safeHtml);
    if (!title || !cells.length) return null;

    const first = sanitizeTrailingColon(cells[0] || "");
    const second = normalizeText(cells[1] || "");
    if (!first || !second) return null;

    const label = {
      title: first,
      detail: second,
    };

    const duration = findIntegerFromTextByKeyword(cells, "duration");
    if (Number.isFinite(duration)) label.duration = duration;

    if (normalizedTemplate === "coc-bomadness-rt") {
      const number = findIntegerFromTextByKeyword(cells, "mania number");
      const rounds = findIntegerFromTextByKeyword(cells, "rounds");
      if (Number.isFinite(number)) label.number = number;
      if (Number.isFinite(rounds)) label.rounds = rounds;
    }

    return {
      v: 1,
      source: "roll20",
      rule: "coc7",
      template: normalizedTemplate,
      inputs: {
        title,
        rows: [{ label }],
      },
    };
  }

  function mapAttackSkill(caption) {
    const safe = normalizeText(caption);
    if (!safe) return "";
    if (/(라이플|권총|산탄총|총|rifle|pistol|shotgun|smg|gun)/i.test(safe)) return "총";
    return safe;
  }

  function parseCocAttackPayload(html, template) {
    if (String(template || "").toLowerCase() !== "coc-attack") return null;
    const safeHtml = String(html || "");
    const caption = extractCaptionText(safeHtml);
    const rows = collectTemplateRowsWithCells(safeHtml);
    if (!caption || !rows.length) return null;

    const successRow = rows.find((row) => /기준치|value/i.test(String(row.label || "")));
    const rollRow = rows.find((row) => /굴림|rolled/i.test(String(row.label || "")));
    const damageRow = rows.find((row) => /피해|dam/i.test(String(row.label || "")));

    const success = extractFirstInteger(successRow?.value || "");
    const rollNumbers = extractAllIntegers(rollRow?.value || "");
    const damage = extractFirstInteger(damageRow?.value || "");
    const skill = mapAttackSkill(caption);

    if (!skill || !Number.isFinite(success) || !rollNumbers.length || !Number.isFinite(damage)) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "coc7",
      template: "coc-attack",
      inputs: {
        skill,
        success,
        rolls: rollNumbers,
        damage,
      },
    };
  }

  function parseCocAttackOnePayload(html, template) {
    if (String(template || "").toLowerCase() !== "coc-attack-1") return null;
    const safeHtml = String(html || "");
    const skill = extractCaptionText(safeHtml);
    const rows = collectTemplateRowsWithCells(safeHtml);

    const successRow = rows.find((row) => /기준치|value/i.test(String(row.label || "")));
    const damageRow = rows.find((row) => /피해|dam/i.test(String(row.label || "")));
    const success = extractFirstInteger(successRow?.value || "");
    const damage = extractFirstInteger(damageRow?.value || "");

    if (!skill || !Number.isFinite(success) || !Number.isFinite(damage)) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "coc7",
      template: "coc-attack-1",
      inputs: {
        skill,
        success,
        rolls: [success],
        damage,
      },
    };
  }

  function parseCocPayload(html, template) {
    if (String(template || "").toLowerCase() !== "coc") return null;
    const safeHtml = String(html || "");
    const skill = extractCaptionText(safeHtml);
    const rows = collectTemplateRowsWithCells(safeHtml);
    const rollRow = rows.find((row) => /굴림|rolled/i.test(String(row.label || "")));
    const rolls = extractAllIntegers(rollRow?.value || "");
    const success = rolls.length ? rolls[0] : null;
    if (!skill || !Number.isFinite(success) || !rolls.length) return null;

    return {
      v: 1,
      source: "roll20",
      rule: "coc7",
      template: "coc",
      inputs: {
        skill,
        success,
        rolls,
      },
    };
  }

  function parseInsanePayload(html, template) {
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
      inputs: {
        skill,
        target,
        roll,
      },
    };
  }

  function parseInsDicePayload(html, template) {
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
      inputs: {
        skill,
        target,
        roll,
      },
    };
  }

  function parseInsSkillPayload(html, template) {
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
    const text = normalizeText(raw);
    if (!text) return "";
    return text.replace(/^(\d+)\.\s*/, "$1. ");
  }

  function normalizeInsPlotSkill(raw) {
    const text = normalizeText(raw);
    if (!text) return "";
    if (text === "파괴") return "포박";
    return text;
  }

  function parseInsPlotPayload(html, template) {
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

  function parseRoll20DicePayload({ role, html }) {
    const template = extractTemplateName(html);
    if (template === "default") return parseDefaultTablePayload(html, template);
    if (String(role || "").toLowerCase() !== "dice") return null;
    if (template === "coc-1") return parseCoc1DicePayload(html);
    if (template === "insane") return parseInsanePayload(html, template);
    if (template === "insdice") return parseInsDicePayload(html, template);
    if (template === "insskill") return parseInsSkillPayload(html, template);
    if (template === "insdesc") return parseInsDescPayload(html, template);
    if (template === "insplot") return parseInsPlotPayload(html, template);
    if (template === "coc") return parseCocPayload(html, template);
    if (template === "coc-attack") return parseCocAttackPayload(html, template);
    if (template === "coc-attack-1") return parseCocAttackOnePayload(html, template);
    if (template === "coc-init-stc") return parseCocInitStcPayload(html, template);
    if (template === "coc-defence-2") return parseCocDefence2Payload(html, template);
    if (template === "coc-bomadness-rt" || template === "coc-bomadness-summ") {
      return parseCocBomadnessPayload(html, template);
    }
    return parseCocRowsPayload(html, template);
  }

  function normalizeMessageText(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim();
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

  function buildChatJsonEntry({
    id,
    speaker,
    role = "character",
    text,
    imageUrl = null,
    speakerImageUrl = null,
    nameColor = null,
    dice = null,
  }) {
    const entry = {
      id: String(id || ""),
      speaker: String(speaker || ""),
      role: String(role || "character"),
      text: String(text || ""),
      imageUrl: imageUrl == null ? null : String(imageUrl),
      speakerImageUrl: speakerImageUrl == null ? null : String(speakerImageUrl),
      nameColor: nameColor == null ? null : String(nameColor),
    };

    if (dice && typeof dice === "object") {
      entry.dice = dice;
    }

    return omitNullishDeep(entry);
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

  const api = {
    parseRoll20DicePayload,
    isHiddenMessagePlaceholderText,
    normalizeMessageText,
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
