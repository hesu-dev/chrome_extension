const test = require("node:test");
const assert = require("node:assert/strict");

const parserUtils = require("../src/parsers/parser_utils.js");

test("toSafeText strips unsupported punctuation but keeps spacing", () => {
  assert.equal(parserUtils.toSafeText("  [홍길동] !!!  "), "홍길동 !!!");
});

test("extractTemplateName reads rolltemplate names", () => {
  assert.equal(
    parserUtils.extractTemplateName('<div class="sheet-rolltemplate-coc-1"></div>'),
    "coc-1"
  );
});
