# Shared Core, Chrome Release, and Firefox Mobile Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the Roll20 JSON parsing pipeline into a shared sibling package, keep Chrome behavior unchanged through `release/chrome`, and ship a separate Firefox-for-Android extension through `release/firefox-mobile` without copying parser rules between targets.

**Architecture:** Treat `/Users/he-su/Desktop/chrome_extension` as the execution root. Move pure parsing and JSON-building logic into `roll20-json-core`, keep browser-specific messaging and download UX in thin target shells, and make each release folder self-contained by staging target files plus a built shared-core bundle. Do not load unpacked extensions from source folders after this change; always load from `release/chrome` or `release/firefox-mobile`.

**Tech Stack:** Vanilla JavaScript, Node `node:test`, WebExtensions (Chrome MV3 and Firefox MV2 for Android compatibility), staging scripts in Node, release zip packaging.

---

### Task 1: Create the shared-core skeleton

**Files:**
- Create: `roll20-json-core/package.json`
- Create: `roll20-json-core/src/index.js`
- Create: `roll20-json-core/src/browser_entry.js`
- Create: `roll20-json-core/tests/core_exports.test.js`
- Create: `R20-JSONExporter/release/chrome/.gitkeep`
- Create: `R20-JSONExporter/release/firefox-mobile/.gitkeep`
- Create: `R20-JSONExporter/release/ios-safari/README.md`

**Step 1: Write the failing test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../src/index.js");

test("shared core exposes stable entry points", () => {
  assert.equal(typeof core.parseRoll20DicePayload, "function");
  assert.equal(typeof core.buildChatJsonDocument, "function");
  assert.equal(typeof core.buildChatJsonEntry, "function");
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/he-su/Desktop/chrome_extension && node --test roll20-json-core/tests/core_exports.test.js`

Expected: FAIL with `MODULE_NOT_FOUND` for `../src/index.js`.

**Step 3: Write minimal implementation**

```js
function notReady() {
  throw new Error("shared core not implemented yet");
}

module.exports = {
  parseRoll20DicePayload: notReady,
  buildChatJsonDocument: notReady,
  buildChatJsonEntry: notReady,
};
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/he-su/Desktop/chrome_extension && node --test roll20-json-core/tests/core_exports.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
cd /Users/he-su/Desktop/chrome_extension
git add roll20-json-core R20-JSONExporter/release
git commit -m "chore: scaffold shared roll20 json core"
```

### Task 2: Move parser utility helpers into the shared core

**Files:**
- Create: `roll20-json-core/src/parsers/parser_utils.js`
- Create: `roll20-json-core/tests/parser_utils.test.js`
- Modify: `R20-JSONExporter/js/content/export/parsers/parser_utils.js`
- Modify: `roll20-json-core/src/index.js`

**Step 1: Write the failing test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const parserUtils = require("../src/parsers/parser_utils.js");

test("toSafeText strips unsupported punctuation but keeps spacing", () => {
  assert.equal(parserUtils.toSafeText("  [홍길동] !!!  "), "홍길동 !!!");
});

test("extractTemplateName reads rolltemplate names", () => {
  assert.equal(
    parserUtils.extractTemplateName('<div class="sheet-rolltemplate-coc"></div>'),
    "coc"
  );
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/he-su/Desktop/chrome_extension && node --test roll20-json-core/tests/parser_utils.test.js`

Expected: FAIL with `MODULE_NOT_FOUND` for `../src/parsers/parser_utils.js`.

**Step 3: Write minimal implementation**

Copy the pure helper functions from `R20-JSONExporter/js/content/export/parsers/parser_utils.js` into `roll20-json-core/src/parsers/parser_utils.js`, export them with `module.exports`, and change the existing Chrome-side file into a wrapper:

```js
(function () {
  const api =
    typeof module !== "undefined" && module.exports
      ? require("../../../../../roll20-json-core/src/parsers/parser_utils.js")
      : window.Roll20JsonCore?.parserUtils || {};

  if (typeof window !== "undefined") {
    window.Roll20CleanerParserUtils = window.Roll20CleanerParserUtils || {};
    Object.assign(window.Roll20CleanerParserUtils, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/he-su/Desktop/chrome_extension && node --test roll20-json-core/tests/parser_utils.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
cd /Users/he-su/Desktop/chrome_extension
git add roll20-json-core/src/parsers/parser_utils.js roll20-json-core/tests/parser_utils.test.js R20-JSONExporter/js/content/export/parsers/parser_utils.js
git commit -m "refactor: move parser utilities into shared core"
```

### Task 3: Move COC and Insane rule parsers into the shared core

**Files:**
- Create: `roll20-json-core/src/parsers/coc_rule_parser.js`
- Create: `roll20-json-core/src/parsers/insane_rule_parser.js`
- Create: `roll20-json-core/tests/coc_rule_parser.test.js`
- Create: `roll20-json-core/tests/insane_rule_parser.test.js`
- Modify: `R20-JSONExporter/js/content/export/parsers/coc/coc_rule_parser.js`
- Modify: `R20-JSONExporter/js/content/export/parsers/insane/insane_rule_parser.js`
- Modify: `R20-JSONExporter/tests/coc_target_field.test.js`
- Modify: `R20-JSONExporter/tests/insane_ninpo_template.test.js`
- Modify: `roll20-json-core/src/index.js`

**Step 1: Write the failing tests**

Port the existing parser tests into the shared core and add one new smoke test for the Insane parser:

```js
test("ninpo payload maps to insane-dice", () => {
  const parsed = parseInsaneRulePayload({ html: fixtureHtml, template: "ninpo" });
  assert.equal(parsed?.template, "insane-dice");
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
cd /Users/he-su/Desktop/chrome_extension
node --test roll20-json-core/tests/coc_rule_parser.test.js
node --test roll20-json-core/tests/insane_rule_parser.test.js
```

Expected: FAIL with missing shared-core parser modules.

**Step 3: Write minimal implementation**

Move the pure parser logic from:

- `R20-JSONExporter/js/content/export/parsers/coc/coc_rule_parser.js`
- `R20-JSONExporter/js/content/export/parsers/insane/insane_rule_parser.js`

into the shared core. Keep the Chrome-side files as wrappers that expose:

```js
window.Roll20CleanerCocRuleParser = api;
window.Roll20CleanerInsaneRuleParser = api;
```

and `module.exports = api` for Node tests.

**Step 4: Run tests to verify they pass**

Run:

```bash
cd /Users/he-su/Desktop/chrome_extension
node --test roll20-json-core/tests/coc_rule_parser.test.js
node --test roll20-json-core/tests/insane_rule_parser.test.js
node --test R20-JSONExporter/tests/coc_target_field.test.js
node --test R20-JSONExporter/tests/insane_ninpo_template.test.js
```

Expected: PASS for all four commands.

**Step 5: Commit**

```bash
cd /Users/he-su/Desktop/chrome_extension
git add roll20-json-core/src/parsers roll20-json-core/tests R20-JSONExporter/js/content/export/parsers R20-JSONExporter/tests
git commit -m "refactor: share coc and insane rule parsers"
```

### Task 4: Move chat JSON building into the shared core

**Files:**
- Create: `roll20-json-core/src/chat_json_export.js`
- Create: `roll20-json-core/tests/chat_json_export.test.js`
- Modify: `R20-JSONExporter/js/content/export/chat_json_export.js`
- Modify: `roll20-json-core/src/index.js`

**Step 1: Write the failing test**

Port the current JSON export assertions into the shared core and add one DOM-light fixture:

```js
test("buildChatJsonDocument sets schemaVersion to 1", () => {
  const doc = buildChatJsonDocument({ scenarioTitle: "테스트", lines: [] });
  assert.equal(doc.schemaVersion, 1);
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/he-su/Desktop/chrome_extension && node --test roll20-json-core/tests/chat_json_export.test.js`

Expected: FAIL with missing `chat_json_export.js`.

**Step 3: Write minimal implementation**

Move the pure functions from `R20-JSONExporter/js/content/export/chat_json_export.js` into the shared core, keeping the browser-facing wrapper in place:

```js
(function () {
  const api =
    typeof module !== "undefined" && module.exports
      ? require("../../../../roll20-json-core/src/chat_json_export.js")
      : window.Roll20JsonCore?.chatJson || {};

  if (typeof window !== "undefined") {
    window.Roll20CleanerChatJson = window.Roll20CleanerChatJson || {};
    Object.assign(window.Roll20CleanerChatJson, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
```

**Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/he-su/Desktop/chrome_extension
node --test roll20-json-core/tests/chat_json_export.test.js
node --test R20-JSONExporter/tests/coc_target_field.test.js
```

Expected: PASS.

**Step 5: Commit**

```bash
cd /Users/he-su/Desktop/chrome_extension
git add roll20-json-core/src/chat_json_export.js roll20-json-core/tests/chat_json_export.test.js R20-JSONExporter/js/content/export/chat_json_export.js
git commit -m "refactor: move chat json builder into shared core"
```

### Task 5: Add a browser bundle entry point for the shared core

**Files:**
- Create: `roll20-json-core/src/browser_entry.js`
- Create: `R20-JSONExporter/tests/browser_bundle_contract.test.js`
- Modify: `roll20-json-core/src/index.js`

**Step 1: Write the failing test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../../roll20-json-core/src/index.js");

test("browser contract groups parser and chat modules", () => {
  assert.equal(typeof core.browserContract, "object");
  assert.equal(typeof core.browserContract.chatJson.parseRoll20DicePayload, "function");
  assert.equal(typeof core.browserContract.parserUtils.normalizeText, "function");
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/he-su/Desktop/chrome_extension && node --test R20-JSONExporter/tests/browser_bundle_contract.test.js`

Expected: FAIL because `browserContract` does not exist yet.

**Step 3: Write minimal implementation**

Expose one browser-friendly object shape from the shared core:

```js
module.exports = {
  parserUtils,
  cocRuleParser,
  insaneRuleParser,
  chatJson,
  browserContract: {
    parserUtils,
    cocRuleParser,
    insaneRuleParser,
    chatJson,
  },
};
```

`browser_entry.js` should attach this to `window.Roll20JsonCore`.

**Step 4: Run test to verify it passes**

Run: `cd /Users/he-su/Desktop/chrome_extension && node --test R20-JSONExporter/tests/browser_bundle_contract.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
cd /Users/he-su/Desktop/chrome_extension
git add roll20-json-core/src/index.js roll20-json-core/src/browser_entry.js R20-JSONExporter/tests/browser_bundle_contract.test.js
git commit -m "feat: add browser bundle contract for shared core"
```

### Task 6: Replace the broken Chrome build with release staging

**Files:**
- Create: `R20-JSONExporter/scripts/build.mjs`
- Create: `R20-JSONExporter/scripts/zip.mjs`
- Create: `R20-JSONExporter/scripts/lib/stage_shared_core.mjs`
- Create: `R20-JSONExporter/tests/build_release_layout.test.js`
- Modify: `R20-JSONExporter/package.json`
- Modify: `R20-JSONExporter/manifest.json`

**Step 1: Write the failing test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { getChromeStagePlan } = require("../scripts/lib/stage_shared_core.mjs");

test("chrome release plan includes bundled core before dependent scripts", () => {
  const plan = getChromeStagePlan();
  assert.equal(plan.bundleOutput, "release/chrome/js/vendor/roll20-json-core.js");
  assert.ok(plan.manifestContentScripts[0].includes("js/vendor/roll20-json-core.js"));
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter && node --test tests/build_release_layout.test.js`

Expected: FAIL with missing build helper.

**Step 3: Write minimal implementation**

Implement a staging build that:

- clears `release/chrome`
- copies the Chrome source tree into `release/chrome`
- writes `release/chrome/js/vendor/roll20-json-core.js` from `roll20-json-core/src/browser_entry.js`
- patches the staged manifest so `js/vendor/roll20-json-core.js` loads before parser wrappers
- zips `release/chrome` instead of the source folder

Keep `R20-JSONExporter` as source only after this change.

**Step 4: Run test and build verification**

Run:

```bash
cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter
node --test tests/build_release_layout.test.js
npm run build
```

Expected:

- test PASS
- `release/chrome/manifest.json` exists
- `release/chrome/js/vendor/roll20-json-core.js` exists

**Step 5: Commit**

```bash
cd /Users/he-su/Desktop/chrome_extension
git add R20-JSONExporter/package.json R20-JSONExporter/scripts R20-JSONExporter/tests/build_release_layout.test.js R20-JSONExporter/manifest.json
git commit -m "build: stage chrome release artifacts"
```

### Task 7: Wire the Chrome extension source to the staged shared core

**Files:**
- Modify: `R20-JSONExporter/manifest.json`
- Modify: `R20-JSONExporter/js/content/export/parsers/parser_utils.js`
- Modify: `R20-JSONExporter/js/content/export/parsers/coc/coc_rule_parser.js`
- Modify: `R20-JSONExporter/js/content/export/parsers/insane/insane_rule_parser.js`
- Modify: `R20-JSONExporter/js/content/export/chat_json_export.js`
- Modify: `R20-JSONExporter/js/content/core/content.js`
- Modify: `R20-JSONExporter/tests/message_context_timestamp_inherit.test.js`

**Step 1: Write the failing regression test**

Add a small Node regression that imports the wrapper modules and asserts that they forward to the shared core API:

```js
test("chrome wrapper exposes shared normalizeText", () => {
  const parserUtils = require("../js/content/export/parsers/parser_utils.js");
  assert.equal(parserUtils.normalizeText(" a  b "), "a b");
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter && node --test tests/message_context_timestamp_inherit.test.js tests/coc_target_field.test.js`

Expected: at least one test FAILs while wrappers are half-migrated.

**Step 3: Write minimal implementation**

- make wrappers consume `window.Roll20JsonCore`
- keep the existing global names (`Roll20CleanerParserUtils`, `Roll20CleanerCocRuleParser`, `Roll20CleanerInsaneRuleParser`, `Roll20CleanerChatJson`) unchanged
- leave `content.js` call sites intact except for script-order assumptions

**Step 4: Run test and staged smoke verification**

Run:

```bash
cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter
node --test tests/*.test.js
npm run build
```

Expected:

- all local Node tests PASS
- unpacked extension can now be loaded from `release/chrome`

**Step 5: Commit**

```bash
cd /Users/he-su/Desktop/chrome_extension
git add R20-JSONExporter/js R20-JSONExporter/tests R20-JSONExporter/manifest.json
git commit -m "refactor: wire chrome shell to staged shared core"
```

### Task 8: Create the Firefox-for-Android extension shell

**Files:**
- Create: `R20-JSONExporter-firefox-mobile/manifest.json`
- Create: `R20-JSONExporter-firefox-mobile/popup.html`
- Create: `R20-JSONExporter-firefox-mobile/js/popup/popup.js`
- Create: `R20-JSONExporter-firefox-mobile/js/background/background.js`
- Create: `R20-JSONExporter-firefox-mobile/js/content/core/content.js`
- Create: `R20-JSONExporter-firefox-mobile/js/content/export/chat_json_export.js`
- Create: `R20-JSONExporter-firefox-mobile/js/content/export/parsers/parser_utils.js`
- Create: `R20-JSONExporter-firefox-mobile/js/content/export/parsers/coc/coc_rule_parser.js`
- Create: `R20-JSONExporter-firefox-mobile/js/content/export/parsers/insane/insane_rule_parser.js`
- Create: `R20-JSONExporter-firefox-mobile/tests/manifest_contract.test.js`

**Step 1: Write the failing test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../manifest.json");

test("firefox manifest targets Android self-distribution", () => {
  assert.equal(manifest.manifest_version, 2);
  assert.equal(typeof manifest.browser_specific_settings.gecko.id, "string");
  assert.equal(
    typeof manifest.browser_specific_settings.gecko.gecko_android.strict_min_version,
    "string"
  );
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile && node --test tests/manifest_contract.test.js`

Expected: FAIL with missing manifest.

**Step 3: Write minimal implementation**

Create a Firefox Android target that:

- uses Manifest V2 for Android compatibility
- declares `browser_specific_settings.gecko.id`
- loads the same staged `js/vendor/roll20-json-core.js`
- keeps the same DOM-wide parsing behavior as Chrome
- avoids Chrome-only APIs like `chrome.scripting.executeScript`

Use `tabs.executeScript` or static content scripts instead.

**Step 4: Run test to verify it passes**

Run: `cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile && node --test tests/manifest_contract.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
cd /Users/he-su/Desktop/chrome_extension
git add R20-JSONExporter-firefox-mobile
git commit -m "feat: scaffold firefox mobile extension shell"
```

### Task 9: Add Firefox mobile export UX and release staging

**Files:**
- Create: `R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`
- Modify: `R20-JSONExporter-firefox-mobile/js/popup/popup.js`
- Modify: `R20-JSONExporter-firefox-mobile/js/content/core/content.js`
- Modify: `R20-JSONExporter-firefox-mobile/js/background/background.js`
- Modify: `R20-JSONExporter/scripts/build.mjs`
- Modify: `R20-JSONExporter/scripts/zip.mjs`

**Step 1: Write the failing test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const { getFirefoxExportAction } = require("../js/popup/popup.js");

test("firefox mobile export prefers file download", () => {
  const action = getFirefoxExportAction({ canDownload: true, canShare: true });
  assert.equal(action.primary, "download");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile
node --test tests/export_flow.test.js
```

Expected: FAIL because the export helper does not exist yet.

**Step 3: Write minimal implementation**

- add a Firefox popup action that requests JSON generation from the content script
- save JSON with `Blob` + object URL when downloads are available
- fall back to share or copy only if download is blocked
- extend the Chrome build scripts so they also stage `release/firefox-mobile` and zip it separately

**Step 4: Run test and build verification**

Run:

```bash
cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile
node --test tests/export_flow.test.js
cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter
npm run build
```

Expected:

- Firefox test PASS
- `release/firefox-mobile/manifest.json` exists
- `release/firefox-mobile/js/vendor/roll20-json-core.js` exists

**Step 5: Commit**

```bash
cd /Users/he-su/Desktop/chrome_extension
git add R20-JSONExporter-firefox-mobile R20-JSONExporter/scripts
git commit -m "build: stage firefox mobile release artifacts"
```

### Task 10: Lock in cross-target regression coverage and iOS handoff seams

**Files:**
- Create: `roll20-json-core/tests/regression_fixture_roll20_chat.test.js`
- Create: `R20-JSONExporter-firefox-mobile/README.md`
- Modify: `R20-JSONExporter/README.md` or create `R20-JSONExporter/docs/targets.md`
- Modify: `R20-JSONExporter/release/ios-safari/README.md`

**Step 1: Write the failing regression test**

```js
test("shared fixture produces the same JSON document shape across targets", () => {
  const doc = buildChatJsonDocument({ scenarioTitle: "fixture", lines: fixtureLines });
  assert.equal(doc.schemaVersion, 1);
  assert.equal(Array.isArray(doc.lines), true);
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/he-su/Desktop/chrome_extension && node --test roll20-json-core/tests/regression_fixture_roll20_chat.test.js`

Expected: FAIL because the fixture harness is not in place.

**Step 3: Write minimal implementation**

- add one representative Roll20 fixture covering hidden text, avatar replacement, and dice payloads
- document that `release/ios-safari` is a reserved staging folder for the future Safari Web Extension inside the Flutter app
- document the iOS inbox contract: extension writes JSON into App Group inbox, Flutter imports it, then deletes the source file on success

**Step 4: Run the full verification set**

Run:

```bash
cd /Users/he-su/Desktop/chrome_extension
node --test roll20-json-core/tests/*.test.js
cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter
node --test tests/*.test.js
npm run build
npm run zip
```

Expected:

- all shared-core tests PASS
- all Chrome-source tests PASS
- `release/chrome` and `release/firefox-mobile` both stage successfully
- zip artifacts are created from release folders, not from source folders

**Step 5: Commit**

```bash
cd /Users/he-su/Desktop/chrome_extension
git add roll20-json-core R20-JSONExporter R20-JSONExporter-firefox-mobile
git commit -m "test: add cross-target regression coverage and release docs"
```

## Notes For Execution

- Execute this plan from a dedicated worktree rooted at `/Users/he-su/Desktop/chrome_extension`, not from the existing working tree.
- Keep `R20-JSONExporter` as Chrome source only after Task 6. Web Store uploads must come from `R20-JSONExporter/release/chrome`.
- Keep Firefox Android on Manifest V2 unless Mozilla Android service-worker support is verified during implementation.
- Do not implement iOS in this pass. Only reserve `release/ios-safari` and document the handoff contract for the future Flutter + Safari Web Extension work.
