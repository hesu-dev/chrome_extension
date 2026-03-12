# Firefox Android Localhost Bridge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken Firefox Android download/share flow with a localhost bridge that posts Roll20 JSON directly into the running ReadingLog Android app.

**Architecture:** Firefox Android will stop using `downloads.download()` and `navigator.share({ files })` for the ReadingLog path. Instead, the popup will probe a localhost receiver exposed by the ReadingLog Android app, then post JSON bytes over `127.0.0.1` only when the app is in the foreground. ReadingLog will validate, import, and save to internal storage using the existing JSON import path, and the receiver will close as soon as the app backgrounds.

**Tech Stack:** Firefox Android WebExtension (popup/content/background), Flutter Android app, Kotlin `MainActivity`, Dart `dart:io` `HttpServer`, existing ReadingLog JSON import utilities.

---

### Task 1: Freeze the Firefox Android localhost contract in tests

**Files:**
- Modify: `../R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`
- Modify: `../R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js`

**Step 1: Write the failing tests**

Add tests for these behaviors:
- the Firefox popup chooses `localhost-post` as the primary ReadingLog action
- the popup no longer requires `navigator.share` or `downloads`
- the UI exposes only the localhost-oriented ReadingLog button and the Korean hint text

Example assertions:

```js
test("firefox mobile localhost flow prefers localhost post", () => {
  const action = getFirefoxExportAction({
    canDownload: false,
    canShare: false,
    canPostToLocalhost: true,
    preferredAction: "localhost-post",
  });
  assert.equal(action.primary, "localhost-post");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js
```

Expected: FAIL because `localhost-post` is not implemented.

**Step 3: Write minimal implementation**

In plan terms only:
- extend action selection to accept `canPostToLocalhost`
- keep the existing image-check button
- make the ReadingLog path point at localhost instead of share/download

**Step 4: Run test to verify it passes**

Run the same command and expect PASS for the new localhost cases.

**Step 5: Commit**

```bash
git add ../R20-JSONExporter-firefox-mobile/tests/export_flow.test.js ../R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js
git commit -m "test: lock firefox localhost export contract"
```

### Task 2: Add failing Firefox popup tests for localhost probe and POST

**Files:**
- Modify: `../R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`
- Modify: `../R20-JSONExporter-firefox-mobile/js/popup/popup.js`

**Step 1: Write the failing tests**

Add tests for:
- `GET /health` success leads to `POST /imports/json`
- probe failure shows `ReadingLog 앱이 준비되지 않았습니다.`
- POST failure shows a Korean import failure message
- the popup sends compact JSON and filename base to localhost without going through background download

Use injected `fetch` doubles.

**Step 2: Run test to verify it fails**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js
```

Expected: FAIL because localhost fetch helpers do not exist.

**Step 3: Write minimal implementation**

Implement popup helpers for:
- `probeReadingLogLocalhost()`
- `postReadingLogJsonToLocalhost()`
- timeout handling
- Korean status messages for probe and POST stages

**Step 4: Run test to verify it passes**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add ../R20-JSONExporter-firefox-mobile/tests/export_flow.test.js ../R20-JSONExporter-firefox-mobile/js/popup/popup.js
git commit -m "feat: add firefox localhost probe and post flow"
```

### Task 3: Replace the Firefox popup ReadingLog UX with localhost-only messaging

**Files:**
- Modify: `../R20-JSONExporter-firefox-mobile/popup.html`
- Modify: `../R20-JSONExporter-firefox-mobile/js/popup/popup.js`

**Step 1: Write the failing test**

Extend popup contract tests to assert:
- no download button
- no share-specific success copy
- visible Korean hint such as `ReadingLog 앱이 준비되지 않았습니다.` on localhost probe failure

**Step 2: Run test to verify it fails**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js
```

Expected: FAIL because old copy still refers to share/open.

**Step 3: Write minimal implementation**

Update popup copy to:
- keep the image-check editor path
- make the ReadingLog button clearly about app transfer
- describe only the localhost-prepared state, not app installation guesses

**Step 4: Run test to verify it passes**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add ../R20-JSONExporter-firefox-mobile/popup.html ../R20-JSONExporter-firefox-mobile/js/popup/popup.js ../R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js
git commit -m "feat: update firefox popup to localhost transfer messaging"
```

### Task 4: Add failing Dart tests for the ReadingLog localhost receiver lifecycle

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_bridge_test.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart`

**Step 1: Write the failing test**

Test these rules:
- the server binds only to `127.0.0.1`
- `/health` returns `200`
- non-`POST /imports/json` requests are rejected
- wrong `Content-Type` is rejected
- invalid JSON is rejected

Prefer pure Dart `HttpServer.bind` tests.

**Step 2: Run test to verify it fails**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_bridge_test.dart
```

Expected: FAIL because the localhost server does not exist.

**Step 3: Write minimal implementation**

Create a small Dart service that:
- binds only to `InternetAddress.loopbackIPv4`
- exposes `/health`
- exposes `POST /imports/json`
- applies request method/content-type/schema checks

**Step 4: Run test to verify it passes**

Run the same Flutter test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_bridge_test.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart
git commit -m "feat: add localhost receiver contract for android imports"
```

### Task 5: Add a ReadingLog app-state controller that opens the localhost server only in the foreground

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/main.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_controller.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_controller_test.dart`

**Step 1: Write the failing test**

Test:
- server starts on `resumed`
- server stops on `paused`/`inactive`/`detached`
- app code never leaves the receiver open in background

**Step 2: Run test to verify it fails**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_controller_test.dart
```

Expected: FAIL because lifecycle controller does not exist.

**Step 3: Write minimal implementation**

Create a controller that:
- observes lifecycle
- starts the localhost server only when app is in foreground
- stops it immediately when app leaves foreground

**Step 4: Run test to verify it passes**

Run the same Flutter test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/lib/main.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_controller.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_controller_test.dart
git commit -m "feat: scope localhost receiver to readinglog foreground lifecycle"
```

### Task 6: Reuse the existing ReadingLog import path from localhost POST bodies

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_import_bridge.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart`

**Step 1: Write the failing test**

Test:
- valid localhost JSON is written to an internal temp file
- the existing `_registerImportedJsonFile` path (or extracted equivalent) imports it
- success deletes the temp file
- invalid JSON is discarded immediately

**Step 2: Run test to verify it fails**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart
```

Expected: FAIL because localhost import handoff is not wired in.

**Step 3: Write minimal implementation**

Wire the localhost receiver to the existing import path by:
- storing the received JSON in app cache/internal storage
- exposing the pending import via the same bridge used by file-share import
- reusing `_registerImportedJsonFile` until a cleaner shared import service is extracted later

**Step 4: Run test to verify it passes**

Run the same Flutter test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_import_bridge.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart
git commit -m "feat: import localhost json into readinglog library"
```

### Task 7: Remove the stale Android share-intent bridge or downgrade it to fallback-only status

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/AndroidManifest.xml`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/kotlin/com/example/readinglog/MainActivity.kt`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_import_bridge.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart`

**Step 1: Write the failing test**

Add/extend tests to assert that:
- localhost import remains primary
- stale pending share-intent payloads do not interfere with localhost imports

**Step 2: Run test to verify it fails**

Run the relevant Flutter test files from Tasks 5 and 6.

Expected: FAIL if localhost and share-intent state conflict.

**Step 3: Write minimal implementation**

Choose one of these and implement only one:
- remove the Android share-intent bridge entirely for now, or
- keep it but ensure localhost imports have priority and share-intent state is isolated

Recommendation: keep the share-intent code dormant but non-primary, to reduce churn while preserving prior work.

**Step 4: Run test to verify it passes**

Run the same tests and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/AndroidManifest.xml /Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/kotlin/com/example/readinglog/MainActivity.kt /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_import_bridge.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart
git commit -m "refactor: isolate localhost import path from legacy share intents"
```

### Task 8: Add Firefox Android localhost integration tests against the new API contract

**Files:**
- Modify: `../R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`
- Modify: `../R20-JSONExporter-firefox-mobile/js/popup/popup.js`

**Step 1: Write the failing test**

Test:
- popup sends `GET /health`
- popup then sends `POST /imports/json`
- request body includes compact JSON and normalized filename base
- probe failure and POST failure produce Korean messages

**Step 2: Run test to verify it fails**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js
```

Expected: FAIL until the localhost contract is fully wired.

**Step 3: Write minimal implementation**

Finish the popup integration:
- remove share-file fallback logic from the ReadingLog path
- add fetch timeout helpers
- move progress messages to probe / transfer / import-request wording

**Step 4: Run test to verify it passes**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add ../R20-JSONExporter-firefox-mobile/tests/export_flow.test.js ../R20-JSONExporter-firefox-mobile/js/popup/popup.js
git commit -m "feat: send firefox exports to readinglog localhost bridge"
```

### Task 9: Verify the full Android localhost flow on-device

**Files:**
- Modify: `docs/firefox-android-release-signing-and-testing.md`
- Modify: `docs/plans/2026-03-12-firefox-android-localhost-bridge.md`

**Step 1: Run automated checks**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/background_download.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js
```

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_bridge_test.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_controller_test.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart
```

Run:

```bash
dart analyze /Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_controller.dart
```

**Step 2: Build app and extension artifacts**

Run:

```bash
cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter && ./deploy.sh
```

Run:

```bash
cd /Users/he-su/Documents/GitHub/readinglog/front && flutter build apk --debug
```

**Step 3: Manual device verification**

On the connected Android device:
- open ReadingLog and leave it in foreground
- switch to Firefox Android and trigger `ReadingLog` transfer
- confirm localhost probe success
- confirm POST success
- confirm ReadingLog adds the file to library without opening it automatically
- confirm backgrounding ReadingLog makes Firefox show `ReadingLog 앱이 준비되지 않았습니다.`

**Step 4: Document the result**

Add the exact reproduction and observed behavior to `docs/firefox-android-release-signing-and-testing.md`.

**Step 5: Commit**

```bash
git add docs/firefox-android-release-signing-and-testing.md docs/plans/2026-03-12-firefox-android-localhost-bridge.md
git commit -m "docs: record android localhost bridge verification"
```
