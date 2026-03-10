const test = require("node:test");
const assert = require("node:assert/strict");

const { parseCocRulePayload } = require("../src/parsers/coc_rule_parser.js");

test("coc-1 payload uses inputs.target", () => {
  const html = `
    <div class="sheet-rolltemplate-coc-1">
      <table>
        <caption>Spot Hidden Roll</caption>
        <tr><td class="sheet-template_value">55</td></tr>
        <tr><td class="sheet-template_value">67</td></tr>
      </table>
    </div>
  `;

  const parsed = parseCocRulePayload({ html, template: "coc-1" });
  assert.equal(parsed?.inputs?.target, 55);
  assert.equal(parsed?.inputs?.roll, 67);
  assert.ok(!("success" in (parsed?.inputs || {})));
});

test("coc-attack payload uses inputs.target", () => {
  const html = `
    <div class="sheet-rolltemplate-coc-attack">
      <table>
        <caption>Rifle</caption>
        <tr>
          <td class="sheet-template_label">기준치</td>
          <td class="sheet-template_value">60</td>
        </tr>
        <tr>
          <td class="sheet-template_label">굴림</td>
          <td class="sheet-template_value">23</td>
        </tr>
        <tr>
          <td class="sheet-template_label">피해</td>
          <td class="sheet-template_value">8</td>
        </tr>
      </table>
    </div>
  `;

  const parsed = parseCocRulePayload({ html, template: "coc-attack" });
  assert.equal(parsed?.inputs?.target, 60);
  assert.deepEqual(parsed?.inputs?.rolls, [23]);
  assert.equal(parsed?.inputs?.damage, 8);
});

test("coc-bonus payload uses inputs.target", () => {
  const html = `
    <div class="sheet-rolltemplate-coc-bonus">
      <table>
        <caption>Dodge</caption>
        <tr>
          <td class="sheet-template_label">기준치</td>
          <td class="sheet-template_value">45</td>
        </tr>
        <tr>
          <td class="sheet-template_label">굴림</td>
          <td class="sheet-template_value">11 / 74</td>
        </tr>
      </table>
    </div>
  `;

  const parsed = parseCocRulePayload({ html, template: "coc-bonus" });
  assert.equal(parsed?.inputs?.target, 45);
  assert.deepEqual(parsed?.inputs?.rolls, [11, 74]);
});
