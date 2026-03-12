# Firefox Android Deeplink Localhost Bridge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Firefox Android hand off large Roll20 JSON exports to ReadingLog by waking the app once with a deeplink, streaming JSON over localhost, importing into app storage, showing a completion toast, and shutting the receiver down immediately after the transfer.

**Architecture:** Firefox Android stops treating `downloads.download()` or `navigator.share({ files })` as the ReadingLog path. Instead, the popup first prepares export metadata, wakes ReadingLog through an Android deeplink/intent, polls a localhost health endpoint until the app receiver becomes ready, then streams compact JSON chunks over `127.0.0.1` to the app. ReadingLog starts a short-lived localhost receiver when opened by the deeplink, keeps it alive only while a transfer is active, saves the received JSON to internal storage through the existing import path, shows a completion toast, and closes the receiver as soon as import is complete or the transfer aborts.

**Tech Stack:** Firefox Android WebExtension popup/content/background, Flutter Android app, Android deeplink intent filter, Dart `HttpServer`, existing ReadingLog JSON import code.

---

### Task 1: Freeze the deeplink-wake Firefox contract in popup tests

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js`

**Step 1: Write the failing tests**

Add tests for:
- the ReadingLog action chooses `deeplink-localhost` as its primary action
- the popup no longer depends on download or share for the ReadingLog path
- the Korean hint explains that Firefox will open ReadingLog briefly and then continue sending

Example assertion:

```js
test("firefox mobile uses deeplink localhost transfer for readinglog", () => {
  const action = getFirefoxExportAction({
    canDownload: false,
    canShare: false,
    canPostToLocalhost: true,
    canOpenReadingLogApp: true,
    preferredAction: "deeplink-localhost",
  });
  assert.equal(action.primary, "deeplink-localhost");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js
```

Expected: FAIL because `deeplink-localhost` is not implemented.

**Step 3: Write minimal implementation**

In plan terms only:
- add a new `deeplink-localhost` action
- remove ReadingLog download/share wording from the popup contract
- keep image-check flow untouched

**Step 4: Run test to verify it passes**

Run the same command and expect PASS for the new contract cases.

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js
git commit -m "test: lock firefox deeplink localhost transfer contract"
```

### Task 2: Add popup tests for deeplink wake and localhost readiness polling

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/popup/popup.js`

**Step 1: Write the failing tests**

Add tests for:
- Firefox opens a ReadingLog deeplink before probing localhost
- the popup polls `/health` until the app reports ready
- probe timeout shows `ReadingLog 앱이 준비되지 않았습니다.`
- wake success but readiness timeout shows a separate Korean message

Use injected doubles for:
- app-opening call
- `fetch`
- wait/sleep helper

**Step 2: Run test to verify it fails**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js
```

Expected: FAIL because deeplink wake/poll helpers do not exist.

**Step 3: Write minimal implementation**

Implement popup helpers for:
- building the ReadingLog deeplink URL
- opening the app once
- polling localhost readiness with timeout
- Korean status messages for `앱 열기`, `앱 준비 확인`, `앱 준비 실패`

**Step 4: Run test to verify it passes**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/popup/popup.js
git commit -m "feat: wake readinglog app before localhost transfer"
```

### Task 3: Stream compact JSON chunks from Firefox popup/content to localhost

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/popup/popup.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/content/core/content.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js`

**Step 1: Write the failing tests**

Add tests for:
- popup sends metadata first, then chunked JSON POST requests to localhost
- progress stays in Korean and maps `1-50` to export preparation, `50-99` to chunk upload completion
- chunk upload failure stops the transfer and surfaces a Korean message
- Firefox no longer calls `downloads.download()` or `navigator.share()` for the ReadingLog path

**Step 2: Run test to verify it fails**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js
```

Expected: FAIL because localhost chunk streaming is not implemented.

**Step 3: Write minimal implementation**

Implement:
- a compact JSON export path for the ReadingLog action
- a chunker that splits large JSON into sequential POST payloads
- request shapes:
  - `POST /imports/json/start`
  - `POST /imports/json/chunk`
  - `POST /imports/json/finish`
- Korean progress labels that align with actual chunk completion

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/popup/popup.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/content/core/content.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js
git commit -m "feat: stream firefox exports to readinglog localhost"
```

### Task 4: Replace ReadingLog Android share-intent entry with a deeplink wake contract

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/AndroidManifest.xml`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/kotlin/com/example/readinglog/MainActivity.kt`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/readinglog_localhost_wake_contract_test.dart`

**Step 1: Write the failing test**

Add contract coverage for:
- a new deeplink route such as `readinglog://imports/json`
- `MainActivity` caching a pending localhost wake state instead of file-share state
- legacy `application/json` share filters staying intact only if still needed for manual import

**Step 2: Run test to verify it fails**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/readinglog_localhost_wake_contract_test.dart
```

Expected: FAIL because the deeplink wake contract does not exist.

**Step 3: Write minimal implementation**

Implement:
- an intent filter for the ReadingLog localhost wake deeplink
- `MainActivity` handling that deeplink
- a pending wake signal exposed to Flutter

**Step 4: Run test to verify it passes**

Run the same Flutter test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/AndroidManifest.xml /Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/kotlin/com/example/readinglog/MainActivity.kt /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/readinglog_localhost_wake_contract_test.dart
git commit -m "feat: add readinglog localhost wake deeplink"
```

### Task 5: Add a short-lived localhost receiver with strict request validation

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_server_test.dart`

**Step 1: Write the failing test**

Test:
- bind only to `127.0.0.1`
- `GET /health` returns ready state
- only `POST` is accepted for import routes
- only `application/json` is accepted
- invalid JSON, invalid phase, or oversized payload is rejected

**Step 2: Run test to verify it fails**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_server_test.dart
```

Expected: FAIL because the localhost server does not exist.

**Step 3: Write minimal implementation**

Implement a Dart server that:
- binds to `InternetAddress.loopbackIPv4`
- exposes:
  - `GET /health`
  - `POST /imports/json/start`
  - `POST /imports/json/chunk`
  - `POST /imports/json/finish`
- validates method, content type, JSON payload, transfer phase, and size limits

**Step 4: Run test to verify it passes**

Run the same Flutter test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_server_test.dart
git commit -m "feat: add strict localhost json receiver"
```

### Task 6: Keep the receiver alive only for the active transfer, then shut it down

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_controller.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/main.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_controller_test.dart`

**Step 1: Write the failing test**

Test:
- the receiver starts when the app is woken by the localhost deeplink
- idle timeout closes it if Firefox never connects
- an active transfer keeps it alive beyond idle timeout
- no-progress timeout aborts a stalled transfer
- finish/abort closes the receiver immediately

**Step 2: Run test to verify it fails**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_controller_test.dart
```

Expected: FAIL because controller lifecycle logic does not exist.

**Step 3: Write minimal implementation**

Implement:
- idle timeout (for example 60s)
- no-progress timeout during transfer (for example 30s)
- absolute transfer timeout (for example 5 min)
- automatic shutdown after success or abort

**Step 4: Run test to verify it passes**

Run the same Flutter test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_controller.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/main.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_controller_test.dart
git commit -m "feat: scope localhost receiver to active transfer only"
```

### Task 7: Reuse the existing ReadingLog JSON import path from the localhost transfer

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_import_bridge.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart`

**Step 1: Write the failing test**

Test:
- a completed localhost transfer is written to a temp file
- the existing import path consumes that temp file
- success deletes the temp file
- invalid or partial transfers are discarded without import

**Step 2: Run test to verify it fails**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart
```

Expected: FAIL because localhost transfer completion is not wired into the existing import path.

**Step 3: Write minimal implementation**

Refactor only as much as needed so both:
- manual file picker import
- localhost completed transfer

can call the same import/save path.

**Step 4: Run test to verify it passes**

Run the same Flutter test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_import_bridge.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart
git commit -m "feat: import localhost transfers through existing readinglog path"
```

### Task 8: Show completion toast and close the receiver immediately

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_controller.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart`

**Step 1: Write the failing test**

Test:
- successful localhost import shows a short success toast
- failed import shows a short error toast
- the localhost receiver is closed after success

**Step 2: Run test to verify it fails**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart
```

Expected: FAIL because toast/close behavior is not implemented.

**Step 3: Write minimal implementation**

Use the existing toast system to show a short message such as:
- success: `ReadingLog로 전송을 완료했습니다.`
- failure: `ReadingLog 가져오기에 실패했습니다.`

Close the receiver immediately after success or terminal failure.

**Step 4: Run test to verify it passes**

Run the same Flutter test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_controller.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart
git commit -m "feat: close localhost receiver after import completion"
```

### Task 9: Verify the Android device flow and regenerate release artifacts

**Files:**
- Verify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile`
- Verify: `/Users/he-su/Documents/GitHub/readinglog/front`
- Regenerate: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-mobile`
- Regenerate: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-mobile.zip`

**Step 1: Run Firefox mobile tests**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/*.test.js
```

Expected: PASS.

**Step 2: Run ReadingLog tests**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_server_test.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_controller_test.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/readinglog_localhost_wake_contract_test.dart
```

Expected: PASS.

**Step 3: Run static verification**

Run:

```bash
dart analyze /Users/he-su/Documents/GitHub/readinglog/front/lib
node --check /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/popup/popup.js
node --check /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/content/core/content.js
```

Expected: PASS.

**Step 4: Run on device**

Run:

```bash
flutter run -d R3CR304X4HF --debug
cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter && ./node_modules/.bin/web-ext run --target=firefox-android --source-dir /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-mobile --android-device=R3CR304X4HF --firefox-apk org.mozilla.firefox
```

Expected manual flow:
- Firefox opens ReadingLog once
- ReadingLog wakes the receiver
- Firefox regains focus and streams JSON
- ReadingLog shows success toast
- imported library item appears

**Step 5: Regenerate release**

Run:

```bash
cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter && ./deploy.sh
```

Expected:
- `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-mobile`
- `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-mobile.zip`
are refreshed with the deeplink/localhost build.

**Step 6: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/docs/plans/2026-03-12-firefox-android-deeplink-localhost-bridge.md
git commit -m "feat: hand off firefox android exports through readinglog localhost bridge"
```
