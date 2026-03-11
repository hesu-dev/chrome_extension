const parserUtils = require("./parser_utils.js");

function parseCocDefaultPayload({ html, template }) {
  const { extractCaptionText, collectTrInnerHtmlList, collectTdTexts } = parserUtils;
  if (String(template || "").toLowerCase() !== "default") return null;
  const safeHtml = String(html || "");
  const title = extractCaptionText(safeHtml);
  if (!title) return null;

  const rows = [];
  const trList = collectTrInnerHtmlList(safeHtml);
  trList.forEach((trHtml) => {
    const tds = collectTdTexts(trHtml);
    if (tds.length >= 2) rows.push({ key: tds[0], value: tds[1] });
  });

  return {
    source: "roll20",
    rule: "table",
    template: "default",
    inputs: { title, rows },
  };
}

function parseCoc1DicePayload(html, template) {
  const { normalizeText, stripHtmlTags, collectTemplateValueCells, extractFirstInteger } = parserUtils;
  const safeHtml = String(html || "");
  const normalizedTemplate = String(template || "").toLowerCase();
  const allowedTemplates = new Set(["coc-1", "coc-default"]);
  if (!allowedTemplates.has(normalizedTemplate)) return null;

  const captionMatch = safeHtml.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
  const captionText = normalizeText(stripHtmlTags(captionMatch?.[1] || ""));
  const skill = captionText.replace(/\s+roll\s*$/i, "").trim();

  const cells = collectTemplateValueCells(safeHtml);
  const target = extractFirstInteger(cells[0] || "");
  const roll = extractFirstInteger(cells[1] || "");
  if (!skill || !Number.isFinite(target) || !Number.isFinite(roll)) return null;

  return {
    source: "roll20",
    rule: "coc7",
    template: "coc",
    inputs: { skill, roll, target },
  };
}

function parseCocRowsPayload(html, template) {
  const { normalizeText, stripHtmlTags, collectTemplateRows } = parserUtils;
  const allowedTemplates = new Set(["coc-dice-roll", "coc-body-hit-loc"]);
  if (!allowedTemplates.has(String(template || "").toLowerCase())) return null;

  const safeHtml = String(html || "");
  const captionMatch = safeHtml.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
  const title = normalizeText(stripHtmlTags(captionMatch?.[1] || ""));
  const rows = collectTemplateRows(safeHtml);
  if (!title || !rows.length) return null;

  return {
    source: "roll20",
    rule: "coc7",
    template: String(template || "")
      .toLowerCase()
      .replace(/^coc-dice-roll$/, "coc-dice")
      .replace(/^coc-body-hit-loc$/, "coc-body-hit"),
    inputs: { title, rows },
  };
}

function parseCocInitStcPayload(html, template) {
  const { extractCaptionText, collectTemplateRowsWithCells, sanitizeTrailingColon, normalizeText } =
    parserUtils;
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
    source: "roll20",
    rule: "coc7",
    template: "coc-init-stc",
    inputs: { title, rows: [{ label }] },
  };
}

function parseCocDefence2Payload(html, template) {
  const { extractCaptionText, collectTemplateRowsWithCells, extractFirstInteger } = parserUtils;
  if (String(template || "").toLowerCase() !== "coc-defence-2") return null;
  const safeHtml = String(html || "");
  const caption = extractCaptionText(safeHtml);
  const rows = collectTemplateRowsWithCells(safeHtml);
  const firstRow = rows[0] || { value: "" };
  const value = extractFirstInteger(firstRow.value || "");
  if (!caption || !Number.isFinite(value)) return null;

  return {
    source: "roll20",
    rule: "coc7",
    template: "coc-defence-2",
    inputs: { title: `장갑(방어구) : ${caption}`, rows: [{ label: String(value) }] },
  };
}

function parseCocBomadnessPayload(html, template) {
  const {
    extractCaptionSuffix,
    extractCaptionText,
    extractTemplateValueCellTexts,
    sanitizeTrailingColon,
    normalizeText,
    findIntegerFromTextByKeyword,
  } = parserUtils;
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

  const label = { title: first, detail: second };
  const duration = findIntegerFromTextByKeyword(cells, "duration");
  if (Number.isFinite(duration)) label.duration = duration;

  if (normalizedTemplate === "coc-bomadness-rt") {
    const number = findIntegerFromTextByKeyword(cells, "mania number");
    const rounds = findIntegerFromTextByKeyword(cells, "rounds");
    if (Number.isFinite(number)) label.number = number;
    if (Number.isFinite(rounds)) label.rounds = rounds;
  }

  return {
    source: "roll20",
    rule: "coc7",
    template:
      normalizedTemplate === "coc-bomadness-rt"
        ? "coc-madness-realtime"
        : "coc-madness-summary",
    inputs: { title, rows: [{ label }] },
  };
}

function mapAttackSkill(caption) {
  const { normalizeText } = parserUtils;
  const safe = normalizeText(caption);
  if (!safe) return "";
  if (/(라이플|권총|산탄총|총|rifle|pistol|shotgun|smg|gun)/i.test(safe)) return "총";
  return safe;
}

function parseCocAttackPayload(html, template) {
  const { extractCaptionText, collectTemplateRowsWithCells, extractFirstInteger, extractAllIntegers } =
    parserUtils;
  if (String(template || "").toLowerCase() !== "coc-attack") return null;
  const safeHtml = String(html || "");
  const caption = extractCaptionText(safeHtml);
  const rows = collectTemplateRowsWithCells(safeHtml);
  if (!caption || !rows.length) return null;

  const successRow = rows.find((row) => /기준치|value/i.test(String(row.label || "")));
  const rollRow = rows.find((row) => /굴림|rolled/i.test(String(row.label || "")));
  const damageRow = rows.find((row) => /피해|dam/i.test(String(row.label || "")));

  const target = extractFirstInteger(successRow?.value || "");
  const rollNumbers = extractAllIntegers(rollRow?.value || "");
  const damage = extractFirstInteger(damageRow?.value || "");
  const skill = mapAttackSkill(caption);

  if (!skill || !Number.isFinite(target) || !rollNumbers.length || !Number.isFinite(damage)) return null;
  return {
    source: "roll20",
    rule: "coc7",
    template: "coc-attack-bonus-penalty",
    inputs: { skill, target, rolls: rollNumbers, damage },
  };
}

function parseCocAttackOnePayload(html, template) {
  const { extractCaptionText, collectTemplateRowsWithCells, extractFirstInteger } = parserUtils;
  if (String(template || "").toLowerCase() !== "coc-attack-1") return null;
  const safeHtml = String(html || "");
  const skill = extractCaptionText(safeHtml);
  const rows = collectTemplateRowsWithCells(safeHtml);

  const successRow = rows.find((row) => /기준치|value/i.test(String(row.label || "")));
  const damageRow = rows.find((row) => /피해|dam/i.test(String(row.label || "")));
  const target = extractFirstInteger(successRow?.value || "");
  const damage = extractFirstInteger(damageRow?.value || "");

  if (!skill || !Number.isFinite(target) || !Number.isFinite(damage)) return null;
  return {
    source: "roll20",
    rule: "coc7",
    template: "coc-attack",
    inputs: { skill, target, rolls: [target], damage },
  };
}

function parseCocPayload(html, template) {
  const { extractCaptionText, collectTemplateRowsWithCells, extractAllIntegers } = parserUtils;
  if (String(template || "").toLowerCase() !== "coc") return null;
  const safeHtml = String(html || "");
  const skill = extractCaptionText(safeHtml);
  const rows = collectTemplateRowsWithCells(safeHtml);
  const rollRow = rows.find((row) => /굴림|rolled/i.test(String(row.label || "")));
  const rolls = extractAllIntegers(rollRow?.value || "");
  const target = rolls.length ? rolls[0] : null;
  if (!skill || !Number.isFinite(target) || !rolls.length) return null;

  return {
    source: "roll20",
    rule: "coc7",
    template: "coc-bonus-penalty",
    inputs: { skill, target, rolls },
  };
}

function parseCocBonusPayload(html, template) {
  const { extractCaptionText, collectTemplateRowsWithCells, extractAllIntegers, extractFirstInteger } =
    parserUtils;
  if (String(template || "").toLowerCase() !== "coc-bonus") return null;
  const safeHtml = String(html || "");
  const skill = extractCaptionText(safeHtml);
  const rows = collectTemplateRowsWithCells(safeHtml);
  const successRow = rows.find((row) => /기준치|value/i.test(String(row.label || "")));
  const rollRow = rows.find((row) => /굴림|rolled/i.test(String(row.label || "")));
  const target = extractFirstInteger(successRow?.value || "");
  const rolls = extractAllIntegers(rollRow?.value || "");
  if (!Number.isFinite(target) || !rolls.length) return null;
  const inputs = { target, rolls };
  if (skill) inputs.skill = skill;

  return {
    source: "roll20",
    rule: "coc7",
    template: "coc-bonus-penalty",
    inputs,
  };
}

function parseCocRulePayload({ html, template }) {
  if (template === "coc-1" || template === "coc-default") {
    return parseCoc1DicePayload(html, template);
  }
  if (template === "coc-bonus") return parseCocBonusPayload(html, template);
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

module.exports = { parseCocDefaultPayload, parseCocRulePayload };
