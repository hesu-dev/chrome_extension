const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseRoll20DicePayload,
  buildChatJsonEntry,
  collectJsonExportMessages,
  isHiddenMessagePlaceholderText,
  normalizeImgurLinksInJsonText,
  joinDescAnchorLines,
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

const COC_DEFAULT_HTML = `
<div class="sheet-rolltemplate-coc-default">
  <table>
    <caption>관찰력</caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">기준치:</td>
        <td class="sheet-template_value"><span>85</span>/<span>42</span>/<span>17</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">굴림:</td>
        <td class="sheet-template_value"><span>88</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">판정결과:</td>
        <td class="sheet-template_value">실패</td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_BONUS_HTML = `
<div class="sheet-rolltemplate-coc-bonus">
  <table>
    <caption>심리학</caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">기준치:</td>
        <td class="sheet-template_value"><span>80</span>/<span>40</span>/<span>16</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">굴림:</td>
        <td class="sheet-template_value"><span>95</span>, <span>24</span>, <span>6</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">+2:</td>
        <td class="sheet-template_value">극단적 성공</td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_BONUS_SUCCESS_FROM_THRESHOLD_HTML = `
<div class="sheet-rolltemplate-coc-bonus">
  <table>
    <caption>위협</caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">기준치:</td>
        <td class="sheet-template_value"><span>60</span>/<span>30</span>/<span>12</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">굴림:</td>
        <td class="sheet-template_value"><span>3</span>, <span>64</span>, <span>45</span></td>
      </tr>
    </tbody>
  </table>
</div>`;

const COC_BONUS_EMPTY_CAPTION_HTML = `
<div class="sheet-rolltemplate-coc-bonus">
  <table>
    <caption></caption>
    <tbody>
      <tr>
        <td class="sheet-template_label">기준치:</td>
        <td class="sheet-template_value"><span>80</span>/<span>40</span>/<span>16</span></td>
      </tr>
      <tr>
        <td class="sheet-template_label">굴림:</td>
        <td class="sheet-template_value"><span>92</span>, <span>24</span>, <span>97</span></td>
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

const INS_SKILL_HTML = `
<div class="sheet-rolltemplate-InsSkill">
  <div class="sheet-template">
    <div class="sheet-ch-name">Hub Igriucko</div>
    <div class="sheet-subj"><span>공격</span><strong>기본공격</strong></div>
    <div class="sheet-dice-area">
      <div class="sheet-total">
        <div class="sheet-roll">
          <div class="sheet-dice-val"><span class="inlinerollresult" title="Rolling (2+6) = (2+6)">8</span></div>
        </div>
      </div>
      <div class="sheet-data">
        <div class="sheet-subj">구타<span class="inlinerollresult" title="Rolling 0 = 0"></span></div>
        <div class="sheet-target">
          <span>목표치</span>
          <strong><span class="inlinerollresult" title="Rolling 5 = 5">5</span></strong>
        </div>
      </div>
    </div>
    <div class="sheet-desc">목표 1명을 선택해서 명중판정을 한다.</div>
  </div>
</div>`;

const INS_SKILL_NO_INPUT_HTML = `
<div class="sheet-rolltemplate-InsSkill">
  <div class="sheet-template">
    <div class="sheet-ch-name">Hub Igriucko</div>
    <div class="sheet-subj"><span>서포트</span><strong>전장이동</strong></div>
    <div class="sheet-desc">지원행동. 전투에 참가한 캐릭터 전원은 다음 라운드의 시작에 플롯을 한다.</div>
  </div>
</div>`;

const INS_DESC_HTML = `
<div class="sheet-rolltemplate-InsDesc">
  <div class="sheet-template">
    <div class="sheet-ch-name">Hub Igriucko</div>
    <div class="sheet-subj">
      <span>아이템</span>
      <strong>무기</strong>
    </div>
    <div class="sheet-desc">전투 중에 자신이 행동판정을 위해 주사위를 굴렸을 때 사용할 수 있다. 굴림 결과와 관계없이 다시 주사위를 굴릴 수 있다.</div>
  </div>
</div>`;

const INS_DESC_SCENE_HTML = `
<div class="sheet-rolltemplate-InsDesc">
  <div class="sheet-template">
    <div class="sheet-ch-name">Hub Igriucko</div>
    <div class="sheet-subj">사실은 무서운 현대 일본 장면표</div>
    <div class="sheet-desc">어두운 적색의 석양. 태양은 저물어가고, 하늘은 피처럼 붉다. 불안한 기분이 커져 간다...</div>
  </div>
</div>`;

const INS_DESC_EMOTION_HTML = `
<div class="sheet-rolltemplate-InsDesc">
  <div class="sheet-template">
    <div class="sheet-ch-name">Hub Igriucko</div>
    <div class="sheet-desc sheet-emot">애정(플러스) / 질투(마이너스)</div>
  </div>
</div>`;

const INS_PLOT_HTML = `
<div class="sheet-rolltemplate-InsPlot">
  <div class="sheet-template">
    <div class="sheet-random">
      <strong><i>1</i><em>1.폭력</em></strong>
      <span><i>6</i><em>파괴</em></span>
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

test("parseRoll20DicePayload treats coc-default as coc-1", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_DEFAULT_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc-1",
    inputs: { skill: "관찰력", roll: 88, success: 85 },
  });
});

test("parseRoll20DicePayload treats coc-bonus as coc", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_BONUS_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc",
    inputs: { skill: "심리학", success: 80, rolls: [95, 24, 6] },
  });
});

test("parseRoll20DicePayload uses threshold first value as success for coc-bonus", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_BONUS_SUCCESS_FROM_THRESHOLD_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc",
    inputs: { skill: "위협", success: 60, rolls: [3, 64, 45] },
  });
});

test("parseRoll20DicePayload parses coc-bonus even when caption is empty", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: COC_BONUS_EMPTY_CAPTION_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc",
    inputs: { success: 80, rolls: [92, 24, 97] },
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

test("parseRoll20DicePayload extracts InsSkill ability payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: INS_SKILL_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "insane",
    template: "ability",
    inputs: {
      type: "공격",
      title: "기본공격",
      detail: "목표 1명을 선택해서 명중판정을 한다.",
      skill: "구타",
      target: 5,
      roll: 8,
    },
  });
});

test("parseRoll20DicePayload extracts InsSkill with null defaults when no input area", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: INS_SKILL_NO_INPUT_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "insane",
    template: "ability",
    inputs: {
      type: "서포트",
      title: "전장이동",
      detail: "지원행동. 전투에 참가한 캐릭터 전원은 다음 라운드의 시작에 플롯을 한다.",
      skill: null,
      target: null,
      roll: null,
    },
  });
});

test("parseRoll20DicePayload extracts InsDesc item payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: INS_DESC_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "insane",
    template: "item",
    inputs: {
      type: "아이템",
      title: "무기",
      detail:
        "전투 중에 자신이 행동판정을 위해 주사위를 굴렸을 때 사용할 수 있다. 굴림 결과와 관계없이 다시 주사위를 굴릴 수 있다.",
      skill: null,
      target: null,
      roll: null,
    },
  });
});

test("parseRoll20DicePayload extracts InsDesc scene-table payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: INS_DESC_SCENE_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "insane",
    template: "scene-table",
    inputs: {
      type: null,
      title: "장면표",
      detail: "어두운 적색의 석양. 태양은 저물어가고, 하늘은 피처럼 붉다. 불안한 기분이 커져 간다...",
      skill: null,
      target: null,
      roll: null,
    },
  });
});

test("parseRoll20DicePayload extracts InsDesc emotion payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: INS_DESC_EMOTION_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "insane",
    template: "emotion",
    inputs: {
      type: "감정",
      title: "애정(플러스) / 질투(마이너스)",
      detail: null,
      skill: null,
      target: null,
      roll: null,
    },
  });
});

test("parseRoll20DicePayload extracts InsPlot dice payload", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: INS_PLOT_HTML,
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "insane",
    template: "dice",
    inputs: {
      type: null,
      title: "1. 폭력",
      detail: null,
      skill: "포박",
      target: null,
      roll: null,
    },
  });
});

test("parseRoll20DicePayload falls back to text-based coc parsing for unsupported templates", () => {
  const dice = parseRoll20DicePayload({
    role: "dice",
    html: '<div class="sheet-rolltemplate-coc-2">심리학 기준치: 80/40/16 굴림: <span class="inlinerollresult">36</span> 판정결과: 어려운 성공</div>',
  });

  assert.deepEqual(dice, {
    v: 1,
    source: "roll20",
    rule: "coc7",
    template: "coc-text",
    inputs: {
      skill: "심리학",
      success: 80,
      roll: 36,
      result: "어려운 성공",
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
  assert.equal(entry.timestamp, "");
  assert.equal(entry.textColor, "");
  assert.equal("nameColor" in entry, false);
});

test("buildChatJsonEntry omits null fields recursively", () => {
  const entry = buildChatJsonEntry({
    id: "2",
    speaker: "테스터",
    role: "dice",
    text: "sample",
    timestamp: "8:42PM",
    textColor: "#aaaaaa",
    imageUrl: null,
    speakerImageUrl: null,
    dice: {
      v: 1,
      source: "roll20",
      rule: "insane",
      template: "item",
      inputs: {
        type: "아이템",
        title: "무기",
        detail: "설명",
        skill: null,
        target: null,
        roll: null,
      },
    },
  });

  assert.equal("imageUrl" in entry, false);
  assert.equal("speakerImageUrl" in entry, false);
  assert.equal("skill" in entry.dice.inputs, false);
  assert.equal("target" in entry.dice.inputs, false);
  assert.equal("roll" in entry.dice.inputs, false);
  assert.equal(entry.dice.inputs.type, "아이템");
  assert.equal(entry.timestamp, "오후 8:42");
  assert.equal(entry.textColor, "#aaaaaa");
});

test("buildChatJsonEntry formats long timestamp strings to korean meridiem format", () => {
  const entry = buildChatJsonEntry({
    id: "4",
    speaker: "테스터",
    role: "character",
    text: "sample",
    timestamp: "May 26, 2025 12:01AM",
  });

  assert.equal(entry.timestamp, "오전 12:01");
});

test("buildChatJsonEntry adds safetext with special symbols removed", () => {
  const entry = buildChatJsonEntry({
    id: "3",
    speaker: "테스터",
    role: "character",
    text: "안녕😀!! Roll20 #1 / 테스트✨",
  });

  assert.equal(entry.text, "안녕😀!! Roll20 #1 / 테스트✨");
  assert.equal(entry.safetext, "안녕!! Roll20 1 테스트");
});

test("isHiddenMessagePlaceholderText detects hidden placeholder", () => {
  assert.equal(isHiddenMessagePlaceholderText("This message has been hidden."), true);
  assert.equal(isHiddenMessagePlaceholderText("  This message has been hidden.  "), true);
  assert.equal(isHiddenMessagePlaceholderText("Normal message"), false);
});

test("collectJsonExportMessages excludes display-none messages", () => {
  const visibleMessage = {
    id: "visible",
    style: { display: "" },
    classList: { contains: (name) => name === "message" },
  };
  const hiddenByStyleMessage = {
    id: "hidden-style",
    style: { display: "none" },
    classList: { contains: (name) => name === "message" },
    getAttribute: (name) => (name === "data-roll20-cleaner-color-hide" ? "true" : null),
  };
  const hiddenPlaceholderMessage = {
    id: "hidden-placeholder",
    style: { display: "none" },
    textContent: "This message has been hidden.",
    classList: { contains: (name) => name === "message" },
  };
  const fakeRoot = {
    querySelectorAll: (selector) =>
      selector === "div.message"
        ? [visibleMessage, hiddenByStyleMessage, hiddenPlaceholderMessage]
        : [],
  };

  const collected = collectJsonExportMessages(fakeRoot);
  assert.equal(collected.length, 1);
  assert.equal(collected[0], visibleMessage);
});

test("normalizeImgurLinksInJsonText converts imgur.com links to direct i.imgur.com links", () => {
  const rawJson = JSON.stringify({
    speakerImageUrl: "https://imgur.com/I1nyBqA.png",
    imageUrl: "https://www.imgur.com/AbCdE12.jpg?foo=bar",
  });

  const normalized = normalizeImgurLinksInJsonText(rawJson);

  assert.equal(
    normalized,
    JSON.stringify({
      speakerImageUrl: "https://i.imgur.com/I1nyBqA.png",
      imageUrl: "https://i.imgur.com/AbCdE12.jpg?foo=bar",
    })
  );
});

test("normalizeImgurLinksInJsonText leaves existing i.imgur.com links unchanged", () => {
  const rawJson = JSON.stringify({
    speakerImageUrl: "https://i.imgur.com/I1nyBqA.png",
  });

  const normalized = normalizeImgurLinksInJsonText(rawJson);

  assert.equal(
    normalized,
    JSON.stringify({
      speakerImageUrl: "https://i.imgur.com/I1nyBqA.png",
    })
  );
});

test("joinDescAnchorLines joins repeated desc anchors with newline", () => {
  const html =
    '<a style="color:#bababa">─────── 세이렌, 세이지 ───────</a><a style="color:white">SCENE : 세상을 등지고</a>';

  assert.equal(joinDescAnchorLines(html), "─────── 세이렌, 세이지 ───────\nSCENE : 세상을 등지고");
});

test("joinDescAnchorLines returns empty string for single anchor", () => {
  const html = '<a>SCENE : 세상을 등지고</a>';

  assert.equal(joinDescAnchorLines(html), "");
});
