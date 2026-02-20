const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseRoll20DicePayload,
  buildChatJsonEntry,
  isHiddenMessagePlaceholderText,
} = require("../js/content/export/chat_json_export.js");

const COC1_HTML = `
<div class="sheet-rolltemplate-coc-1">
  <table>
    <caption>SAN Roll</caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">기준치:</td>
        <td class="sheet-template_value"><span>55</span>/<span>27</span>/<span>11</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">굴림:</td>
        <td class="sheet-template_value"><span>67</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">판정결과:</td>
        <td class="sheet-template_value">실패</td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_DICE_ROLL_HTML = `
<div class="sheet-rolltemplate-coc-dice-roll">
  <table>
    <caption>Rolling 1D3</caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">굴림:</td>
        <td class="sheet-template_value"><span>3</span></td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_BODY_HIT_LOC_HTML = `
<div class="sheet-rolltemplate-coc-body-hit-loc">
  <table>
    <caption>명중 부위</caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">오른쪽 다리</td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_BOMADNESS_RT_HTML = `
<div class="sheet-rolltemplate-coc-bomadness-rt">
  <table>
    <caption>광기의 발작 - 실시간</caption>
    <tbody>
      <tr>
        <td class="sheet-template_value"><b>집착증: </b></td>
      </tr>
      <tr>
        <td class="sheet-template_value">The investigator gains a new mania.</td>
      </tr>
      <tr>
        <td class="sheet-template_value">
          <span style="font-weight: bold">Mania Number:</span>
          <span><span>87</span></span>
        </td>
      </tr>
      <tr>
        <td class="sheet-template_value">
          <span style="font-weight: bold">Rounds:</span>
          <span><span>4</span></span>
        </td>
      </tr>
      <tr>
        <td class="sheet-template_value">
          <span style="font-weight: bold">Underlying Insanity Duration (Hours):</span>
          <span><span>8</span></span>
        </td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_BOMADNESS_SUMM_HTML = `
<div class="sheet-rolltemplate-coc-bomadness-summ">
  <table>
    <caption>광기의 발작 - 요약</caption>
    <tbody>
      <tr>
        <td class="sheet-template_value"><b>필사적인 도주: </b></td>
      </tr>
      <tr>
        <td class="sheet-template_value">탐사자가 정신을 차려 보니 먼 곳에 와 있습니다.</td>
      </tr>
      <tr>
        <td class="sheet-template_value">
          <span style="font-weight: bold">Underlying Insanity Duration (Hours):</span>
          <span><span>5</span></span>
        </td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_ATTACK_HTML = `
<div class="sheet-rolltemplate-coc-attack">
  <table>
    <caption>라이플</caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">기준치:</td>
        <td class="sheet-template_value"><span>25</span>/<span>12</span>/<span>5</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">굴림:</td>
        <td class="sheet-template_value"><span>47</span>, <span>66</span>, <span>43</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">피해:</td>
        <td class="sheet-template_value"><span>12</span></td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_HTML = `
<div class="sheet-rolltemplate-coc">
  <table>
    <caption>회계</caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">기준치:</td>
        <td class="sheet-template_value"><span>5</span>/<span>2</span>/<span>1</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">굴림:</td>
        <td class="sheet-template_value"><span>40</span>, <span>26</span>, <span>37</span></td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_ATTACK_1_HTML = `
<div class="sheet-rolltemplate-coc-attack-1">
  <table>
    <caption>라이플</caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">기준치:</td>
        <td class="sheet-template_value"><span>25</span>/<span>12</span>/<span>5</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">굴림:</td>
        <td class="sheet-template_value"><span>11</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">피해:</td>
        <td class="sheet-template_value"><span>12</span></td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_INIT_STC_HTML = `
<div class="sheet-rolltemplate-coc-init-stc">
  <table>
    <caption>Luck Recovery</caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">실패:</td>
        <td class="sheet-template_value"><span>8</span></td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_DEFENCE_2_HTML = `
<div class="sheet-rolltemplate-coc-defence-2">
  <table>
    <caption>몸</caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">Def:</td>
        <td class="sheet-template_value"><span>2</span></td>
      </tr>
    </tbody>
  </table>
</div>`;

const DEFAULT_TABLE_HTML = `
<div class="sheet-rolltemplate-default">
  <table>
    <caption>케이크틀 정하기</caption>
    <tbody>
      <tr><td>1</td><td>파운드케이크틀</td></tr>
      <tr><td>2</td><td>동그란 원형 틀</td></tr>
      <tr><td>3</td><td>곰돌이 모양틀</td></tr>
      <tr><td>4</td><td>마들렌 조개모양 틀</td></tr>
    </tbody>
  </table>
</div>`;

const DEFAULT_TABLE_EMPTY_ROWS_HTML = `
<div class="sheet-rolltemplate-default">
  <table>
    <caption>케이크틀 정하기</caption>
  </table>
</div>`;

const INSANE_HTML = `
<div class="sheet-rolltemplate-Insane">
  <div class="sheet-template-area">
    <div class="sheet-name">PC1 해저드</div>
    <div class="sheet-dice-area">
      <strong>고통</strong>
      <p>
        <span>목표치 : <span class="inlinerollresult showtip tipsy-n-right" title="Rolling 5 = 5">5</span></span>
      </p>
    </div>
    <div class="sheet-dice-result">
      <span class="inlinerollresult showtip tipsy-n-right" title="Rolling 2d6 = (&lt;span class=&quot;basicdiceroll&quot;&gt;2&lt;/span&gt;+&lt;span class=&quot;basicdiceroll&quot;&gt;3&lt;/span&gt;)">5</span>
    </div>
    <div class="sheet-target-result">
      <strong class="sheet-succed">판정성공</strong>
    </div>
  </div>
</div>`;

const INS_DICE_HTML = `
<div class="sheet-rolltemplate-InsDice">
  <div class="sheet-template">
    <div class="sheet-ch-name">Hub Igriucko</div>
    <div class="sheet-dice-area">
      <div class="sheet-total">
        <div class="sheet-roll">
          <div class="sheet-dice-val"><span class="inlinerollresult showtip tipsy-n-right" title="Rolling (1+1) = (1+1)">2</span></div>
        </div>
        <div class="sheet-detail-dice">
          <span class="inlinerollresult showtip tipsy-n-right fullfail" title="Rolling 1d6 = (<span class=&quot;basicdiceroll critfail &quot;>1</span>)">1</span>
          <span class="inlinerollresult showtip tipsy-n-right fullfail" title="Rolling 1d6 = (<span class=&quot;basicdiceroll critfail &quot;>1</span>)">1</span>
        </div>
      </div>
      <div class="sheet-data">
        <div class="sheet-subj">효율</div>
        <div class="sheet-target">
          <span>목표치</span>
          <strong><span class="inlinerollresult">5</span></strong>
        </div>
      </div>
    </div>
  </div>
</div>`;

test("parseRoll20DicePayload extracts coc-1 inputs", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC1_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc-1",
    inputs: {
      skill: "SAN",
      roll: 67,
      success: 55,
    },
  });
});

test("parseRoll20DicePayload returns null for non-target template", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: "<div class=\"sheet-rolltemplate-5e\"><caption>Attack</caption></div>",
  });

  assert.equal(dice, null);
});

test("parseRoll20DicePayload extracts coc-dice-roll rows", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_DICE_ROLL_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc-dice-roll",
    inputs: {
      title: "Rolling 1D3",
      rows: [{ label: "3" }],
    },
  });
});

test("parseRoll20DicePayload extracts coc-body-hit-loc rows", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_BODY_HIT_LOC_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc-body-hit-loc",
    inputs: {
      title: "명중 부위",
      rows: [{ label: "오른쪽 다리" }],
    },
  });
});

test("parseRoll20DicePayload extracts coc-bomadness-rt nested label", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_BOMADNESS_RT_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc-bomadness-rt",
    inputs: {
      title: "실시간",
      rows: [
        {
          label: {
            title: "집착증",
            detail: "The investigator gains a new mania.",
            number: 87,
            rounds: 4,
            duration: 8,
          },
        },
      ],
    },
  });
});

test("parseRoll20DicePayload extracts coc-bomadness-summ nested label", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_BOMADNESS_SUMM_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc-bomadness-summ",
    inputs: {
      title: "요약",
      rows: [
        {
          label: {
            title: "필사적인 도주",
            detail: "탐사자가 정신을 차려 보니 먼 곳에 와 있습니다.",
            duration: 5,
          },
        },
      ],
    },
  });
});

test("parseRoll20DicePayload extracts coc-attack payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_ATTACK_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc-attack",
    inputs: {
      skill: "총",
      success: 25,
      rolls: [47, 66, 43],
      damage: 12,
    },
  });
});

test("parseRoll20DicePayload extracts coc payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc",
    inputs: {
      skill: "회계",
      success: 40,
      rolls: [40, 26, 37],
    },
  });
});

test("parseRoll20DicePayload extracts coc-attack-1 payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_ATTACK_1_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc-attack-1",
    inputs: {
      skill: "라이플",
      success: 25,
      rolls: [25],
      damage: 12,
    },
  });
});

test("parseRoll20DicePayload extracts coc-init-stc payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_INIT_STC_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc-init-stc",
    inputs: {
      title: "Luck Recovery",
      rows: [{ label: "실패: 8" }],
    },
  });
});

test("parseRoll20DicePayload extracts coc-defence-2 payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_DEFENCE_2_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc-defence-2",
    inputs: {
      title: "장갑(방어구) : 몸",
      rows: [{ label: "2" }],
    },
  });
});

test("parseRoll20DicePayload extracts default table payload", () => {
  const dice = parseRoll20DicePayload({
    role: "system",
    html: DEFAULT_TABLE_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "table",
    template: "default",
    inputs: {
      title: "케이크틀 정하기",
      rows: [
        { key: "1", value: "파운드케이크틀" },
        { key: "2", value: "동그란 원형 틀" },
        { key: "3", value: "곰돌이 모양틀" },
        { key: "4", value: "마들렌 조개모양 틀" },
      ],
    },
  });
});

test("parseRoll20DicePayload extracts default table payload with empty rows", () => {
  const dice = parseRoll20DicePayload({
    role: "system",
    html: DEFAULT_TABLE_EMPTY_ROWS_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "table",
    template: "default",
    inputs: {
      title: "케이크틀 정하기",
      rows: [],
    },
  });
});

test("parseRoll20DicePayload extracts Insane payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: INSANE_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "insane",
    template: "insane-dice",
    inputs: {
      skill: "고통",
      target: 5,
      roll: 5,
    },
  });
});

test("parseRoll20DicePayload extracts InsDice payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: INS_DICE_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "insane",
    template: "insane-dice",
    inputs: {
      skill: "효율",
      target: 5,
      roll: 2,
    },
  });
});

test("buildChatJsonEntry includes dice when provided", () => {
  const entry = buildChatJsonEntry({
    id: "1",
    speaker: "테스터",
    role: "dice",
    text: "SAN Roll 기준치: 55/27/11 굴림: 67 판정결과: 실패",
    dice: parseRoll20DicePayload({ role: "dice", html: COC1_HTML }),
  });

  assert.equal(entry.dice?.inputs?.skill, "SAN");
  assert.equal(entry.dice?.inputs?.success, 55);
  assert.equal(entry.dice?.inputs?.roll, 67);
});

test("isHiddenMessagePlaceholderText detects hidden placeholder", () => {
  assert.equal(isHiddenMessagePlaceholderText("This message has been hidden."), true);
  assert.equal(isHiddenMessagePlaceholderText("  This message has been hidden.  "), true);
  assert.equal(isHiddenMessagePlaceholderText("Normal message"), false);
});
