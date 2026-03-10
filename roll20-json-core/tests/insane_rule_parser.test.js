const test = require("node:test");
const assert = require("node:assert/strict");

const { parseInsaneRulePayload } = require("../src/parsers/insane_rule_parser.js");

test("ninpo payload maps to insane-dice", () => {
  const html = `
    <div class="sheet-rolltemplate-Ninpo">
      <div class="sheet-bordered">
        <div class="sheet-vtop">
          <div class="sheet-blacklabel sheet-top" style="width: 80%">
            <span class="sheet-big">나비 Roll 풍경</span>
          </div>
          <div class="sheet-resright">
            <span class="inlinerollresult">11</span>
          </div>
        </div>
        <div class="sheet-myrow">
          <span class="sheet-lbl sheet-bold">목표치: </span>
          <span class="sheet-notes sheet-inl"><span class="inlinerollresult">5</span></span>
        </div>
      </div>
    </div>
  `;

  const parsed = parseInsaneRulePayload({ html, template: "ninpo" });
  assert.deepEqual(parsed, {
    source: "roll20",
    rule: "insane",
    template: "insane-dice",
    inputs: {
      skill: "풍경",
      target: 5,
      roll: 11,
    },
  });
});
