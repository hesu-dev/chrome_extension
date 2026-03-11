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
  assert.equal(parsed?.template, "coc");
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
  assert.equal(parsed?.template, "coc-attack-bonus-penalty");
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
  assert.equal(parsed?.template, "coc-bonus-penalty");
  assert.equal(parsed?.inputs?.target, 45);
  assert.deepEqual(parsed?.inputs?.rolls, [11, 74]);
});

test("coc row templates use renamed output template values", () => {
  const diceHtml = `
    <div class="sheet-rolltemplate-coc-dice-roll">
      <table>
        <caption>Dice Roll</caption>
        <tr>
          <td class="sheet-template_label">굴림</td>
          <td class="sheet-template_value">12</td>
        </tr>
      </table>
    </div>
  `;
  const bodyHitHtml = `
    <div class="sheet-rolltemplate-coc-body-hit-loc">
      <table>
        <caption>Body Hit</caption>
        <tr>
          <td class="sheet-template_label">부위</td>
          <td class="sheet-template_value">왼팔</td>
        </tr>
      </table>
    </div>
  `;

  assert.equal(parseCocRulePayload({ html: diceHtml, template: "coc-dice-roll" })?.template, "coc-dice");
  assert.equal(
    parseCocRulePayload({ html: bodyHitHtml, template: "coc-body-hit-loc" })?.template,
    "coc-body-hit"
  );
});

test("coc madness templates use renamed output template values", () => {
  const realtimeHtml = `
    <div class="sheet-rolltemplate-coc-bomadness-rt">
      <table>
        <caption>Bout Of Madness: Realtime</caption>
        <tr><td class="sheet-template_value">Reactive Action:</td></tr>
        <tr><td class="sheet-template_value">Keep running</td></tr>
      </table>
    </div>
  `;
  const summaryHtml = `
    <div class="sheet-rolltemplate-coc-bomadness-summ">
      <table>
        <caption>Bout Of Madness: Summary</caption>
        <tr><td class="sheet-template_value">Reactive Action:</td></tr>
        <tr><td class="sheet-template_value">Keep running</td></tr>
      </table>
    </div>
  `;

  assert.equal(
    parseCocRulePayload({ html: realtimeHtml, template: "coc-bomadness-rt" })?.template,
    "coc-madness-realtime"
  );
  assert.equal(
    parseCocRulePayload({ html: summaryHtml, template: "coc-bomadness-summ" })?.template,
    "coc-madness-summary"
  );
});
