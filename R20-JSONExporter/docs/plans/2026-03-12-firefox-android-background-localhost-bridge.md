# Firefox Android Background Localhost Bridge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Firefox Android hand off Roll20 JSON exports to ReadingLog without showing a return-to-Firefox step, by moving transfer ownership into the Firefox background script and showing progress only inside the ReadingLog app.

**Architecture:** The Firefox popup becomes a thin trigger only. On user action, it tells `background.js` to start a ReadingLog transfer session. The background script wakes ReadingLog with a deeplink/intent, waits for the app’s localhost receiver to become ready, asks the active Roll20 tab to produce compact JSON chunks, and streams those chunks directly to ReadingLog over `127.0.0.1`. ReadingLog opens a foreground import screen, starts a short-lived foreground receiver/service, shows progress while data arrives, imports to internal storage through the existing JSON path, shows a completion toast, and immediately shuts the receiver down when the transfer finishes or aborts.

**Tech Stack:** Firefox Android WebExtension popup/background/content, Flutter Android app, Android deeplink intent filters, Flutter/Dart localhost server, existing ReadingLog import/save logic.

---

### Task 1: Lock the Firefox popup contract to “trigger only”

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`

**Step 1: Write the failing tests**

Add tests for:
- the ReadingLog button no longer claims it will complete transfer inside the popup
- popup action becomes `background-readinglog-transfer`
- popup only sends a start message to background and does not own localhost polling or chunk streaming

**Step 2: Run test to verify it fails**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js
```

Expected: FAIL because popup still owns localhost transfer helpers.

**Step 3: Write minimal implementation**

Implement:
- popup button wording for “ReadingLog 앱으로 보내기”
- popup sends a single runtime message such as `R20_JSON_EXPORTER_FIREFOX_START_READINGLOG_TRANSFER`
- popup status says transfer will continue in ReadingLog

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/popup/popup.js
git commit -m "feat: move firefox readinglog trigger to background"
```

### Task 2: Add failing background tests for app wake, readiness polling, and chunk streaming

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/background_download.test.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/background/background.js`

**Step 1: Write the failing tests**

Add tests for:
- background opens the ReadingLog deeplink/intent once
- background polls `GET /health` until app receiver is ready
- background requests chunked export from the active Roll20 tab
- background streams `start -> chunk -> finish` to localhost
- Korean stage messages are forwarded to popup/app observers

**Step 2: Run test to verify it fails**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/background_download.test.js
```

Expected: FAIL because background does not own ReadingLog transfer orchestration.

**Step 3: Write minimal implementation**

Implement in `background.js`:
- ReadingLog deeplink constant
- localhost polling helper
- transfer state machine
- `START_READINGLOG_TRANSFER` runtime handler
- streaming upload helpers

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/background_download.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/background/background.js
git commit -m "feat: orchestrate readinglog transfer in firefox background"
```

### Task 3: Make the content script provide compact JSON chunks to background

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/content/core/content.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js`

**Step 1: Write the failing tests**

Add tests for:
- content can respond to a background export request with compact JSON metadata
- content can split the generated JSON into deterministic chunks
- progress `1-50` still reflects export/build work before chunk upload begins

**Step 2: Run test to verify it fails**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js
```

Expected: FAIL because content is still tied to popup-driven transfer assumptions.

**Step 3: Write minimal implementation**

Implement:
- background-owned export delivery mode
- compact JSON chunk generation helpers
- progress payloads that background can relay

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/content/core/content.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js
git commit -m "feat: provide chunked compact exports for firefox background transfer"
```

### Task 4: Add a ReadingLog deeplink wake screen and background-capable receiver lifecycle

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/AndroidManifest.xml`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/kotlin/com/example/readinglog/MainActivity.kt`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/readinglog_import_session.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/readinglog_import_session_test.dart`

**Step 1: Write the failing tests**

Add tests for:
- app deeplink `readinglog://imports/json` opens an import session screen/state
- app can show progress immediately after wake
- app keeps the localhost receiver/service alive while a transfer is active even if Firefox is background

**Step 2: Run test to verify it fails**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/readinglog_import_session_test.dart
```

Expected: FAIL because the wake/import session flow does not exist.

**Step 3: Write minimal implementation**

Implement:
- deeplink parsing
- import session controller/state
- foreground-capable receiver lifecycle tied to active transfer instead of visible app-only lifetime

**Step 4: Run test to verify it passes**

Run the same Flutter test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/AndroidManifest.xml /Users/he-su/Documents/GitHub/readinglog/front/android/app/src/main/kotlin/com/example/readinglog/MainActivity.kt /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/readinglog_import_session.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/readinglog_import_session_test.dart
git commit -m "feat: wake readinglog into active import session"
```

### Task 5: Add localhost receiver endpoints and progress reporting in ReadingLog

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/main.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_server_test.dart`

**Step 1: Write the failing tests**

Add tests for:
- `GET /health`
- `POST /imports/json/start`
- `POST /imports/json/chunk`
- `POST /imports/json/finish`
- progress state updates after each accepted chunk
- strict validation for method, content type, phase, and malformed payload

**Step 2: Run test to verify it fails**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_server_test.dart
```

Expected: FAIL because receiver endpoints and progress state do not exist.

**Step 3: Write minimal implementation**

Implement:
- localhost `HttpServer.bind(InternetAddress.loopbackIPv4, port)`
- start/chunk/finish endpoint handling
- active transfer accumulator
- progress events for UI

**Step 4: Run test to verify it passes**

Run the same Flutter test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_localhost_server.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/main.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_server_test.dart
git commit -m "feat: add localhost receiver with readinglog progress updates"
```

### Task 6: Reuse the existing import path, save internally, toast, and close receiver

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_import_bridge.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/readinglog_import_session.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart`

**Step 1: Write the failing tests**

Add tests for:
- completed transfer writes a temp JSON file
- existing import/save path consumes that file
- success shows a short toast
- success closes receiver/service immediately
- failure shows a short error toast and also closes receiver/service

**Step 2: Run test to verify it fails**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart
```

Expected: FAIL because localhost completion is not wired into import/save and toast/close behavior does not exist.

**Step 3: Write minimal implementation**

Implement:
- temp file write
- call into existing import/save path
- success toast: `ReadingLog로 전송을 완료했습니다.`
- failure toast: `ReadingLog 가져오기에 실패했습니다.`
- immediate receiver shutdown after terminal state

**Step 4: Run test to verify it passes**

Run the same Flutter test command and expect PASS.

**Step 5: Commit**

```bash
git add /Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/shared_json_import_bridge.dart /Users/he-su/Documents/GitHub/readinglog/front/lib/sync/android/readinglog_import_session.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart
git commit -m "feat: save localhost imports and close receiver after completion"
```

### Task 7: Verify the device flow and refresh Firefox release artifacts

**Files:**
- Verify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile`
- Verify: `/Users/he-su/Documents/GitHub/readinglog/front`
- Regenerate: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-mobile`
- Regenerate: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-mobile.zip`

**Step 1: Run Firefox tests**

Run:

```bash
node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/*.test.js
```

Expected: PASS.

**Step 2: Run ReadingLog tests**

Run:

```bash
flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/readinglog_import_session_test.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_server_test.dart /Users/he-su/Documents/GitHub/readinglog/front/test/sync/android/shared_json_localhost_import_test.dart
```

Expected: PASS.

**Step 3: Run static verification**

Run:

```bash
dart analyze /Users/he-su/Documents/GitHub/readinglog/front/lib
node --check /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/background/background.js
node --check /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/content/core/content.js
node --check /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/popup/popup.js
```

Expected: PASS.

**Step 4: Run on device**

Run:

```bash
flutter run -d R3CR304X4HF --debug
cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter && ./node_modules/.bin/web-ext run --target=firefox-android --source-dir /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-mobile --android-device=R3CR304X4HF --firefox-apk org.mozilla.firefox
```

Expected manual flow:
- Firefox popup triggers ReadingLog transfer
- ReadingLog opens directly into import progress UI
- Firefox can background while background script keeps streaming
- app progress reaches 100%
- toast appears
- imported item is saved

**Step 5: Regenerate release**

Run:

```bash
cd /Users/he-su/Desktop/chrome_extension/R20-JSONExporter && ./deploy.sh
```

Expected:
- `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-mobile`
- `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/release/firefox-mobile.zip`
are refreshed with the background-owned bridge implementation.

**Step 6: Commit**

```bash
git add /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/docs/plans/2026-03-12-firefox-android-background-localhost-bridge.md
git commit -m "feat: hand off firefox android exports through background localhost bridge"
```
