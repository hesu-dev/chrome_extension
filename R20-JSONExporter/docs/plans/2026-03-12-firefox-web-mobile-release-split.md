# Firefox Web/Mobile Release Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split Firefox release artifacts into `firefox-web` and `firefox-mobile` while keeping shared parser/exporter logic and making `./deploy.sh` output `chrome`, `firefox-web`, `firefox-mobile`, and `ios-safari` together.

**Architecture:** Keep one shared codebase for parser/exporter logic. Generate a Firefox desktop release from the Chrome web source with a Firefox-compatible manifest, and keep the existing Android-specific Firefox source as the mobile release shell. The build/zip pipeline will stage and package both Firefox targets independently.

**Tech Stack:** Node build scripts, WebExtension staging, CommonJS shared-core bundle injection, existing deploy pipeline.

---

### Task 1: Define Firefox web release contract

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/scripts/lib/release_layout.js`
- Test: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_release_layout.test.js`
- Test: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_script_output.test.js`
- Test: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/zip_script_contract.test.js`

**Step 1: Write the failing tests**

Add checks for:
- `release/firefox-web`
- `firefox-web.zip`
- Firefox web manifest staging helper
- build output strings mentioning `Firefox web`

**Step 2: Run tests to verify they fail**

Run:
`node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_release_layout.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_script_output.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/zip_script_contract.test.js`

Expected: FAIL because `firefox-web` target does not exist yet.

**Step 3: Write minimal implementation**

Add:
- `FIREFOX_WEB_RELEASE_ROOT`
- `getFirefoxWebStageManifest()`
- `stageFirefoxWebRelease()`

Use Chrome web source as the Firefox web source of truth.

**Step 4: Run tests to verify they pass**

Run the same test command.

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/scripts/lib/release_layout.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_release_layout.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_script_output.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/zip_script_contract.test.js
git commit -m "build: add firefox web release target"
```

### Task 2: Create Firefox web manifest transformation

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/scripts/lib/release_layout.js`
- Test: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_release_layout.test.js`

**Step 1: Write the failing test**

Assert Firefox web staged manifest:
- keeps Chrome web popup/background/content scripts
- injects bundled shared core first
- adds `browser_specific_settings.gecko`
- sets Firefox desktop minimum version to `140.0`
- keeps the mobile-only `gecko_android` block out of the web package

**Step 2: Run test to verify it fails**

Run:
`node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_release_layout.test.js`

**Step 3: Write minimal implementation**

Transform the Chrome manifest into a Firefox desktop manifest by:
- preserving `action.default_popup`
- adding `browser_specific_settings.gecko.id`
- adding `browser_specific_settings.gecko.strict_min_version = "140.0"`
- adding `browser_specific_settings.gecko.data_collection_permissions.required = ["none"]`

**Step 4: Run test to verify it passes**

Run the same test command.

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/scripts/lib/release_layout.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_release_layout.test.js
git commit -m "build: stage firefox web manifest from chrome source"
```

### Task 3: Update build and zip pipeline to emit four targets

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/scripts/build.mjs`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/scripts/zip.mjs`
- Test: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_script_output.test.js`
- Test: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/zip_script_contract.test.js`

**Step 1: Write the failing tests**

Expect:
- build output mentions `Firefox web release staged at ...`
- zip output mentions `firefox-web.zip`
- Safari still remains folder-only

**Step 2: Run test to verify it fails**

Run:
`node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_script_output.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/zip_script_contract.test.js`

**Step 3: Write minimal implementation**

Update build pipeline to stage:
- Chrome
- Firefox web
- Firefox mobile
- Safari

Update zip pipeline to zip:
- `chrome.zip`
- `firefox-web.zip`
- `firefox-mobile.zip`

**Step 4: Run test to verify it passes**

Run the same test command.

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/scripts/build.mjs /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/scripts/zip.mjs /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_script_output.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/zip_script_contract.test.js
git commit -m "build: emit firefox web and mobile release artifacts"
```

### Task 4: Verify Firefox mobile Android shell still stages correctly

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_release_layout.test.js`
- Test: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/manifest_contract.test.js`

**Step 1: Add focused regression coverage**

Assert:
- mobile package still omits `default_popup`
- mobile package still keeps Android minimum `142.0`
- web package and mobile package have different browser action shells

**Step 2: Run tests**

Run:
`node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_release_layout.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/manifest_contract.test.js`

**Step 3: Fix any shell regressions**

Only touch staging logic if tests reveal mobile/web overlap.

**Step 4: Re-run tests**

Run the same test command.

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_release_layout.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/manifest_contract.test.js
git commit -m "test: lock firefox web and mobile release split"
```

### Task 5: Full verification and release smoke check

**Files:**
- Verify only

**Step 1: Run targeted release tests**

Run:
`node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_release_layout.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/build_script_output.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/zip_script_contract.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/manifest_contract.test.js`

**Step 2: Run deploy**

Run:
`cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter && ./deploy.sh`

Expected outputs:
- `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/chrome`
- `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-web`
- `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-mobile`
- `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/ios-safari`
- corresponding zip files for Chrome / Firefox web / Firefox mobile

**Step 3: Inspect staged manifests**

Check:
- Firefox web manifest has desktop popup shell
- Firefox mobile manifest has Android shell

**Step 4: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter
git commit -m "build: split firefox web and mobile release outputs"
```
