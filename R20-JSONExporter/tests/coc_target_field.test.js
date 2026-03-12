const test = require('node:test');
const assert = require('node:assert/strict');

const { parseCocRulePayload } = require('../js/content/export/parsers/coc/coc_rule_parser.js');
const { parseRoll20DicePayload } = require('../js/content/export/chat_json_export.js');

test('coc payload uses inputs.target', () => {
  const html = `
    <div class="sheet-rolltemplate-coc">
      <table>
        <caption>Spot Hidden Roll</caption>
        <tr><td class="sheet-template_value">55</td></tr>
        <tr><td class="sheet-template_value">67</td></tr>
      </table>
    </div>
  `;

  const parsed = parseCocRulePayload({ html, template: 'coc' });
  assert.equal(parsed?.template, 'coc');
  assert.equal(parsed?.inputs?.target, 55);
  assert.equal(parsed?.inputs?.roll, 67);
  assert.ok(!('success' in (parsed?.inputs || {})));
});

test('coc-attack-bonus-penalty payload uses inputs.target', () => {
  const html = `
    <div class="sheet-rolltemplate-coc-attack-bonus-penalty">
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

  const parsed = parseCocRulePayload({ html, template: 'coc-attack-bonus-penalty' });
  assert.equal(parsed?.template, 'coc-attack-bonus-penalty');
  assert.equal(parsed?.inputs?.target, 60);
  assert.deepEqual(parsed?.inputs?.rolls, [23]);
  assert.equal(parsed?.inputs?.damage, 8);
  assert.ok(!('success' in (parsed?.inputs || {})));
});

test('coc-attack payload uses inputs.target', () => {
  const html = `
    <div class="sheet-rolltemplate-coc-attack">
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

  const parsed = parseCocRulePayload({ html, template: 'coc-attack' });
  assert.equal(parsed?.template, 'coc-attack');
  assert.equal(parsed?.inputs?.target, 50);
  assert.deepEqual(parsed?.inputs?.rolls, [50]);
  assert.equal(parsed?.inputs?.damage, 6);
  assert.ok(!('success' in (parsed?.inputs || {})));
});

test('coc-bonus-penalty payload uses inputs.target', () => {
  const html = `
    <div class="sheet-rolltemplate-coc-bonus-penalty">
      <table>
        <caption>Listen</caption>
        <tr>
          <td class="sheet-template_label">굴림</td>
          <td class="sheet-template_value">42 / 88</td>
        </tr>
      </table>
    </div>
  `;

  const parsed = parseCocRulePayload({ html, template: 'coc-bonus-penalty' });
  assert.equal(parsed?.template, 'coc-bonus-penalty');
  assert.equal(parsed?.inputs?.target, 42);
  assert.deepEqual(parsed?.inputs?.rolls, [42, 88]);
  assert.ok(!('success' in (parsed?.inputs || {})));
});

test('coc payload uses the first target value from rendered threshold spans', () => {
  const html = `
    <div class="sheet-rolltemplate-coc">
      <table>
        <caption>운</caption>
        <tbody>
          <tr>
            <td class="sheet-template_label" data-i18n="value">기준치:</td>
            <td class="sheet-template_value">
              <span class="inlinerollresult showtip tipsy-n-right" title="Rolling 0 = 0">0</span>/
              <span class="inlinerollresult showtip tipsy-n-right" title="Rolling floor(0/2) = floor(0/2)">0</span>/
              <span class="inlinerollresult showtip tipsy-n-right" original-title="Rolling floor(0/5) = floor(0/5)">0</span>
            </td>
          </tr>
          <tr>
            <td class="sheet-template_label" data-i18n="rolled">굴림:</td>
            <td class="sheet-template_value">
              <span class="inlinerollresult showtip tipsy-n-right" original-title="Rolling 1d100cs1cf100 = (&lt;span class=&quot;basicdiceroll&quot;&gt;68&lt;/span&gt;)">68</span>
            </td>
          </tr>
          <tr style="background: #bebebe">
            <td class="sheet-template_label" data-i18n="result">판정결과:</td>
            <td style="background: crimson" class="sheet-template_value" data-i18n="fail">실패</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const parsed = parseCocRulePayload({ html, template: 'coc' });
  assert.deepEqual(parsed, {
    source: 'roll20',
    rule: 'coc7',
    template: 'coc',
    inputs: {
      skill: '운',
      roll: 68,
      target: 0,
    },
  });
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
  assert.equal(parsed?.template, 'coc-bonus-penalty');
  assert.equal(parsed?.inputs?.target, 45);
  assert.deepEqual(parsed?.inputs?.rolls, [11, 74]);
  assert.ok(!('success' in (parsed?.inputs || {})));
});

test('coc row templates use the renamed output template values', () => {
  const diceHtml = `
    <div class="sheet-rolltemplate-coc-dice">
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
    <div class="sheet-rolltemplate-coc-body-hit">
      <table>
        <caption>Body Hit</caption>
        <tr>
          <td class="sheet-template_label">부위</td>
          <td class="sheet-template_value">왼팔</td>
        </tr>
      </table>
    </div>
  `;

  assert.equal(
    parseCocRulePayload({ html: diceHtml, template: 'coc-dice' })?.template,
    'coc-dice'
  );
  assert.equal(
    parseCocRulePayload({ html: bodyHitHtml, template: 'coc-body-hit' })?.template,
    'coc-body-hit'
  );
});

test('coc madness templates use the renamed output template values', () => {
  const realtimeHtml = `
    <div class="sheet-rolltemplate-coc-madness-realtime">
      <table>
        <caption>Bout Of Madness: Realtime</caption>
        <tr><td class="sheet-template_value">Reactive Action:</td></tr>
        <tr><td class="sheet-template_value">Keep running</td></tr>
      </table>
    </div>
  `;
  const summaryHtml = `
    <div class="sheet-rolltemplate-coc-madness-summary">
      <table>
        <caption>Bout Of Madness: Summary</caption>
        <tr><td class="sheet-template_value">Reactive Action:</td></tr>
        <tr><td class="sheet-template_value">Keep running</td></tr>
      </table>
    </div>
  `;

  assert.equal(
    parseCocRulePayload({ html: realtimeHtml, template: 'coc-madness-realtime' })?.template,
    'coc-madness-realtime'
  );
  assert.equal(
    parseCocRulePayload({ html: summaryHtml, template: 'coc-madness-summary' })?.template,
    'coc-madness-summary'
  );
});

test('legacy coc template names are ignored', () => {
  const legacyTemplates = [
    'coc-1',
    'coc-attack-1',
    'coc-body-hit-loc',
    'coc-dice-roll',
    'coc-bomadness-rt',
    'coc-bomadness-summ',
  ];

  legacyTemplates.forEach((template) => {
    assert.equal(parseCocRulePayload({ html: `<div class="sheet-rolltemplate-${template}"></div>`, template }), null);
  });
});

test('fallback coc-like text uses inputs.target', () => {
  const html = '듣기 기준치: 55 굴림: 67 판정결과: 실패';

  const parsed = parseRoll20DicePayload({ role: 'dice', html });
  assert.equal(parsed?.inputs?.target, 55);
  assert.equal(parsed?.inputs?.roll, 67);
  assert.equal(parsed?.inputs?.result, '실패');
  assert.ok(!('success' in (parsed?.inputs || {})));
});
