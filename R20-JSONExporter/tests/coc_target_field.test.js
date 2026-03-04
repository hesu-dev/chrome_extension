const test = require('node:test');
const assert = require('node:assert/strict');

const { parseCocRulePayload } = require('../js/content/export/parsers/coc/coc_rule_parser.js');
const { parseRoll20DicePayload } = require('../js/content/export/chat_json_export.js');

test('coc-1 payload uses inputs.target', () => {
  const html = `
    <div class="sheet-rolltemplate-coc-1">
      <table>
        <caption>Spot Hidden Roll</caption>
        <tr><td class="sheet-template_value">55</td></tr>
        <tr><td class="sheet-template_value">67</td></tr>
      </table>
    </div>
  `;

  const parsed = parseCocRulePayload({ html, template: 'coc-1' });
  assert.equal(parsed?.inputs?.target, 55);
  assert.equal(parsed?.inputs?.roll, 67);
  assert.ok(!('success' in (parsed?.inputs || {})));
});

test('coc-attack payload uses inputs.target', () => {
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

  const parsed = parseCocRulePayload({ html, template: 'coc-attack' });
  assert.equal(parsed?.inputs?.target, 60);
  assert.deepEqual(parsed?.inputs?.rolls, [23]);
  assert.equal(parsed?.inputs?.damage, 8);
  assert.ok(!('success' in (parsed?.inputs || {})));
});

test('coc-attack-1 payload uses inputs.target', () => {
  const html = `
    <div class="sheet-rolltemplate-coc-attack-1">
      <table>
        <caption>Knife</caption>
        <tr>
          <td class="sheet-template_label">기준치</td>
          <td class="sheet-template_value">50</td>
        </tr>
        <tr>
          <td class="sheet-template_label">피해</td>
          <td class="sheet-template_value">6</td>
        </tr>
      </table>
    </div>
  `;

  const parsed = parseCocRulePayload({ html, template: 'coc-attack-1' });
  assert.equal(parsed?.inputs?.target, 50);
  assert.deepEqual(parsed?.inputs?.rolls, [50]);
  assert.equal(parsed?.inputs?.damage, 6);
  assert.ok(!('success' in (parsed?.inputs || {})));
});

test('coc payload uses inputs.target', () => {
  const html = `
    <div class="sheet-rolltemplate-coc">
      <table>
        <caption>Listen</caption>
        <tr>
          <td class="sheet-template_label">굴림</td>
          <td class="sheet-template_value">42 / 88</td>
        </tr>
      </table>
    </div>
  `;

  const parsed = parseCocRulePayload({ html, template: 'coc' });
  assert.equal(parsed?.inputs?.target, 42);
  assert.deepEqual(parsed?.inputs?.rolls, [42, 88]);
  assert.ok(!('success' in (parsed?.inputs || {})));
});

test('coc-bonus payload uses inputs.target', () => {
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

  const parsed = parseCocRulePayload({ html, template: 'coc-bonus' });
  assert.equal(parsed?.inputs?.target, 45);
  assert.deepEqual(parsed?.inputs?.rolls, [11, 74]);
  assert.ok(!('success' in (parsed?.inputs || {})));
});

test('fallback coc-like text uses inputs.target', () => {
  const html = '듣기 기준치: 55 굴림: 67 판정결과: 실패';

  const parsed = parseRoll20DicePayload({ role: 'dice', html });
  assert.equal(parsed?.inputs?.target, 55);
  assert.equal(parsed?.inputs?.roll, 67);
  assert.equal(parsed?.inputs?.result, '실패');
  assert.ok(!('success' in (parsed?.inputs || {})));
});
