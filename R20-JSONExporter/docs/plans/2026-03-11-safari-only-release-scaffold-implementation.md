# Safari-Only Release Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the existing `R20-JSONExporter` release pipeline so `./deploy.sh` stages a Safari standalone app scaffold into `release/ios-safari` alongside the existing Chrome and Firefox outputs, without coupling any ReadingLog integration yet.

**Architecture:** Keep Chrome and Firefox behavior unchanged. Add a new sibling source folder for Safari standalone app scaffolding, stage its app/extension resources into `release/ios-safari`, inject the shared `roll20-json-core` browser bundle there too, and leave Safari as a folder-based Xcode handoff artifact rather than a misleading zip/ipa. ReadingLog handoff stays out of scope for this plan.

**Tech Stack:** Node.js build scripts, `roll20-json-core`, Safari Web Extension resource staging, shell deploy script, Node test runner.

---

### Task 1: Add a failing Safari release layout contract test

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/tests/build_release_layout.test.js`
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/tests/safari_release_layout_contract.test.js`

**Step 1: Write the failing test**

Assert that the release layout library exposes:

- `SAFARI_PROJECT_ROOT`
- `SAFARI_RELEASE_ROOT`
- `getSafariStageManifest()` or equivalent stage metadata helper
- staged Safari resources include the shared vendor bundle path `js/vendor/roll20-json-core.js`

**Step 2: Run test to verify it fails**

Run: `node --test tests/build_release_layout.test.js tests/safari_release_layout_contract.test.js`

Expected: FAIL because Safari release staging is not implemented.

**Step 3: Write minimal implementation**

Do not implement the whole staging yet. Only add the test coverage first.

**Step 4: Commit**

```bash
git add tests/build_release_layout.test.js tests/safari_release_layout_contract.test.js
git commit -m "test: define safari release layout contract"
```

---

### Task 2: Create the Safari standalone source scaffold as a sibling project

**Files:**
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app/README.md`
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app/app.json`
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app/ios/Roll20SafariExtension/Resources/manifest.json`
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app/ios/Roll20SafariExtension/Resources/popup.html`
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app/ios/Roll20SafariExtension/Resources/js/popup.js`
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app/ios/Roll20SafariExtension/Resources/js/content.js`
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app/ios/Runner/Info.plist`

**Step 1: Write the failing test**

Extend `tests/safari_release_layout_contract.test.js` to assert these source files exist.

**Step 2: Run test to verify it fails**

Run: `node --test tests/safari_release_layout_contract.test.js`

Expected: FAIL because the Safari source scaffold does not exist.

**Step 3: Write minimal implementation**

Create only a source scaffold:

- a top-level README explaining this is a standalone Safari app source root
- a small `app.json` metadata file describing the artifact label/version/source type
- minimal Safari extension resources with placeholder export UI text
- no ReadingLog references

**Step 4: Run test to verify it passes**

Run: `node --test tests/safari_release_layout_contract.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app
git commit -m "feat: add safari standalone source scaffold"
```

---

### Task 3: Extend the release layout library with Safari staging

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/scripts/lib/release_layout.js`

**Step 1: Run failing tests**

Run: `node --test tests/build_release_layout.test.js tests/safari_release_layout_contract.test.js`

Expected: FAIL because Safari constants and staging helpers are missing.

**Step 2: Write minimal implementation**

Add:

- `SAFARI_PROJECT_ROOT`
- `SAFARI_RELEASE_ROOT`
- `getSafariSourceManifest()` or lightweight app metadata reader
- `stageSafariRelease()`

Stage only these items initially:

- `README.md`
- `app.json`
- `ios/`

Also inject the shared vendor bundle into the staged Safari extension resources under:

- `ios/Roll20SafariExtension/Resources/js/vendor/roll20-json-core.js`

**Step 3: Run tests to verify they pass**

Run: `node --test tests/build_release_layout.test.js tests/safari_release_layout_contract.test.js`

Expected: PASS.

**Step 4: Commit**

```bash
git add scripts/lib/release_layout.js tests/build_release_layout.test.js tests/safari_release_layout_contract.test.js
git commit -m "build: add safari release staging"
```

---

### Task 4: Update the build script to stage Safari output

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/scripts/build.mjs`
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/tests/build_script_output.test.js`

**Step 1: Write the failing test**

Assert the build script reports:

- Safari release staged path
- Safari app metadata path
- Safari shared core bundle path

**Step 2: Run test to verify it fails**

Run: `node --test tests/build_script_output.test.js`

Expected: FAIL because the build script only logs Chrome and Firefox.

**Step 3: Write minimal implementation**

Call `stageSafariRelease()` and print:

- `Safari release staged at ...`
- `Safari app metadata: ...`
- `Safari shared core bundle: ...`

**Step 4: Run test to verify it passes**

Run: `node --test tests/build_script_output.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/build.mjs tests/build_script_output.test.js
git commit -m "build: report safari release staging"
```

---

### Task 5: Keep zip behavior explicit and non-misleading for Safari

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/scripts/zip.mjs`
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/tests/zip_script_contract.test.js`

**Step 1: Write the failing test**

Assert the zip script:

- still zips Chrome and Firefox
- does not produce a fake Safari extension zip/ipa
- logs that Safari is a staged folder artifact only

**Step 2: Run test to verify it fails**

Run: `node --test tests/zip_script_contract.test.js`

Expected: FAIL because the zip script has no Safari awareness.

**Step 3: Write minimal implementation**

Keep current Chrome/Firefox zip behavior unchanged and add one explicit log line such as:

- `Safari release is staged as a folder at ... (no zip generated)`

**Step 4: Run test to verify it passes**

Run: `node --test tests/zip_script_contract.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/zip.mjs tests/zip_script_contract.test.js
git commit -m "build: document safari release zip behavior"
```

---

### Task 6: Update deploy contract and iOS Safari release docs

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/tests/deploy_script_contract.test.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/release/ios-safari/README.md`
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/tests/ios_safari_release_readme.test.js`

**Step 1: Write the failing tests**

Assert the docs mention:

- `./deploy.sh` now stages Safari output too
- Safari artifact lives at `release/ios-safari`
- ReadingLog integration is explicitly deferred

**Step 2: Run tests to verify they fail**

Run: `node --test tests/deploy_script_contract.test.js tests/ios_safari_release_readme.test.js`

Expected: FAIL because the docs still describe Safari as a placeholder.

**Step 3: Write minimal implementation**

Update README to describe:

- standalone Safari scaffold only
- Xcode handoff artifact
- no ReadingLog coupling yet

**Step 4: Run tests to verify they pass**

Run: `node --test tests/deploy_script_contract.test.js tests/ios_safari_release_readme.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/deploy_script_contract.test.js tests/ios_safari_release_readme.test.js release/ios-safari/README.md
git commit -m "docs: describe safari release scaffold output"
```

---

### Task 7: Verify staged Safari output from the real build

**Files:**
- No new source files unless fixes are needed

**Step 1: Run the full test suite**

Run: `node --test tests/*.test.js`

Expected: PASS.

**Step 2: Run the real build**

Run: `npm run build`

Expected: PASS and logs for Chrome, Firefox, and Safari.

**Step 3: Inspect the staged Safari artifact**

Verify these paths exist:

- `release/ios-safari/README.md`
- `release/ios-safari/app.json`
- `release/ios-safari/ios/Roll20SafariExtension/Resources/manifest.json`
- `release/ios-safari/ios/Roll20SafariExtension/Resources/js/vendor/roll20-json-core.js`

**Step 4: Run release build**

Run: `./deploy.sh`

Expected: PASS, Chrome and Firefox zip files generated, Safari staged folder generated.

**Step 5: Commit any final fixups**

```bash
git add -A
git commit -m "build: enable safari release scaffold in deploy"
```

