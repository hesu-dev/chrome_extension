# Shared Exporter Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Chrome web and Firefox web/Android use the same exporter rules so avatar redirect handling, avatar editor overrides, hidden/display filtering, and JSON output stay in sync.

**Architecture:** Move the exporter core into `roll20-json-core` so the final ReadingLog JSON is produced by one shared pipeline. Keep only platform-specific DOM collection and delivery code in target projects. Firefox Android may keep a separate transfer path, but it must consume the same shared export document and the same avatar/hidden filtering rules as web.

**Tech Stack:** Node, WebExtension content scripts, shared CommonJS bundle staging, Flutter app only for downstream import verification.

---

### Task 1: Define the shared exporter contract

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20-json-core/src/index.js`
- Create: `/Users/he-su/Desktop/chrome_extension/roll20-json-core/src/exporter/export_document_builder.js`
- Test: `/Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/export_document_builder.test.js`

**Step 1: Write the failing test**

Add tests for a shared builder that receives normalized message snapshots and produces:
- hidden/display-none messages excluded
- redirected avatar URL chosen as final `input.speakerImages.avatar.url`
- avatar editor replacement URL preferred over redirected/original URL
- same `schemaVersion`, `ebookView.titlePage`, `lines[]` shape as current web output

**Step 2: Run test to verify it fails**

Run: `node --test /Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/export_document_builder.test.js`

Expected: FAIL because shared exporter builder does not exist yet.

**Step 3: Write minimal implementation**

Create a shared exporter builder that accepts:
- `scenarioTitle`
- `messages`
- `avatarResolutionContext`

Return:
- document payload
- compact JSON text
- line count
- inferred rule type

**Step 4: Run test to verify it passes**

Run: `node --test /Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/export_document_builder.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/roll20-json-core/src/index.js /Users/he-su/Desktop/chrome_extension/roll20-json-core/src/exporter/export_document_builder.js /Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/export_document_builder.test.js
git commit -m "feat: add shared export document builder"
```

### Task 2: Move message filtering rules into the shared exporter path

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20-json-core/src/chat_json_export.js`
- Create: `/Users/he-su/Desktop/chrome_extension/roll20-json-core/src/exporter/message_snapshot_builder.js`
- Test: `/Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/message_snapshot_builder.test.js`

**Step 1: Write the failing test**

Cover:
- `display:none` inline style exclusion
- computed `display:none` exclusion
- hidden placeholder exclusion
- inheritance of speaker/avatar/timestamp context across supported lines

**Step 2: Run test to verify it fails**

Run: `node --test /Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/message_snapshot_builder.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

Extract the message-to-snapshot logic from target content scripts into a shared builder that yields normalized snapshots:
- `speaker`
- `role`
- `timestamp`
- `text`
- `textColor`
- `inlineImageUrl`
- `currentAvatarOriginalUrl`
- `currentAvatarResolvedUrl`
- `dice`

**Step 4: Run test to verify it passes**

Run: `node --test /Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/message_snapshot_builder.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/roll20-json-core/src/chat_json_export.js /Users/he-su/Desktop/chrome_extension/roll20-json-core/src/exporter/message_snapshot_builder.js /Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/message_snapshot_builder.test.js
git commit -m "feat: share message snapshot filtering rules"
```

### Task 3: Move avatar resolution and editor override selection into shared core

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20-json-core/src/index.js`
- Create: `/Users/he-su/Desktop/chrome_extension/roll20-json-core/src/exporter/avatar_resolution_context.js`
- Test: `/Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/avatar_resolution_context.test.js`

**Step 1: Write the failing test**

Cover:
- Roll20 `/users/avatar/...` source resolves to redirected final URL
- if avatar editor replacement exists, replacement wins
- per-line avatar variants are preserved for same speaker
- no legacy `avatarLinkMeta` output

**Step 2: Run test to verify it fails**

Run: `node --test /Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/avatar_resolution_context.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

Move the current resolution selection logic into a shared helper that accepts:
- collected avatar mappings
- optional editor replacements
- current message avatar state

Return only the effective avatar URL for final export.

**Step 4: Run test to verify it passes**

Run: `node --test /Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/avatar_resolution_context.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/roll20-json-core/src/index.js /Users/he-su/Desktop/chrome_extension/roll20-json-core/src/exporter/avatar_resolution_context.js /Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/avatar_resolution_context.test.js
git commit -m "feat: share avatar export resolution rules"
```

### Task 4: Rewire Chrome web to use the shared exporter

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/js/content/core/content.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/content_export.test.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/avatar_export_resolution.test.js`

**Step 1: Write the failing test**

Add/adjust tests asserting Chrome export still:
- applies redirect avatars
- applies avatar editor overrides
- excludes hidden/display-none messages
- emits the same COC template names already standardized

**Step 2: Run test to verify it fails**

Run: `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/content_export.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/avatar_export_resolution.test.js`

Expected: FAIL once old target-local exporter calls are removed.

**Step 3: Write minimal implementation**

Replace Chrome target-local export assembly with:
- target DOM collection only
- shared `message_snapshot_builder`
- shared `avatar_resolution_context`
- shared `export_document_builder`

Leave download/save UX untouched.

**Step 4: Run test to verify it passes**

Run: `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/content_export.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/avatar_export_resolution.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/js/content/core/content.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/content_export.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/avatar_export_resolution.test.js
git commit -m "refactor: use shared exporter for chrome web"
```

### Task 5: Rewire Firefox target to use the same shared exporter output

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/content/core/content.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`

**Step 1: Write the failing test**

Cover both target modes:
- Firefox web-style export output matches Chrome web output
- Firefox Android transfer still uses Android-specific delivery, but the produced JSON matches Chrome web output

**Step 2: Run test to verify it fails**

Run: `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

Remove target-local export assembly (`buildFirefoxExportPayload` as unique business logic). Keep only:
- Firefox-specific message transport/progress updates
- Android text-share/transfer branching

Both web and Android must consume the same shared export document builder.

**Step 4: Run test to verify it passes**

Run: `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/content/core/content.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js
git commit -m "refactor: use shared exporter for firefox targets"
```

### Task 6: Separate platform shells from shared export logic

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/popup/popup.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/background/background.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/scripts/lib/release_layout.js`
- Test: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js`

**Step 1: Write the failing test**

Assert that only these remain platform-specific:
- browser API save/share
- Android transfer state/progress wording
- release staging per target

Assert exporter logic is not duplicated in popup/background/content shell files.

**Step 2: Run test to verify it fails**

Run: `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js`

Expected: FAIL or require fixture updates.

**Step 3: Write minimal implementation**

Keep shell-only responsibilities:
- popup: trigger action, show progress
- background: downloads/share/text transfer
- content: collect DOM and call shared exporter
- release layout: continue bundling shared core into both targets

**Step 4: Run test to verify it passes**

Run: `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/popup/popup.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/background/background.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/scripts/lib/release_layout.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js
git commit -m "refactor: isolate platform shell from shared exporter"
```

### Task 7: Full regression verification and release rebuild

**Files:**
- Verify only

**Step 1: Run shared core tests**

Run: `node --test /Users/he-su/Desktop/chrome_extension/roll20-json-core/tests/*.test.js`

Expected: PASS

**Step 2: Run Chrome tests**

Run: `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/*.test.js`

Expected: PASS

**Step 3: Run Firefox tests**

Run: `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/*.test.js`

Expected: PASS

**Step 4: Rebuild releases**

Run: `cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter && ./deploy.sh`

Expected: `release/chrome`, `release/firefox-mobile`, `chrome.zip`, `firefox-mobile.zip` regenerated

**Step 5: Manual smoke checklist**

Verify:
- Chrome web export uses redirected avatar URLs
- Chrome web avatar editor override is reflected in final JSON
- Firefox web output matches Chrome web JSON
- Firefox Android output uses the same JSON document shape/rules even if delivery differs

**Step 6: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/docs/plans/2026-03-12-shared-exporter-unification.md
git commit -m "test: verify shared exporter unification releases"
```
