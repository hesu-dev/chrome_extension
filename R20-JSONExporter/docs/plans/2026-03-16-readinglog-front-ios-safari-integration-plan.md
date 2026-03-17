# ReadingLog Front iOS Safari Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Embed the Safari Roll20 export flow into `readinglog/front` so the iOS app can receive Safari exports through the existing App Group, import them into the library on startup/resume, and expose enough status and retry controls to make real-device testing practical.

**Architecture:** Keep `R20-JSONExporter` as the source repo for browser-side parsing/export logic and the Safari scaffold resources, but move the shippable iOS integration into `readinglog/front`. Reuse the existing App Group `group.com.reha.readinglog.sync`, add a dedicated Safari inbox bridge instead of overloading the current single-file `shared_json_import` path, and import inbox files through the already extracted `book_json_import_service.dart` path. Treat release versioning as two layers: app version is owned by `front/pubspec.yaml`, while exporter compatibility is owned by a separate bridge-contract/source-metadata file generated during Safari asset sync.

**Tech Stack:** Flutter, Dart, Swift, Xcode iOS extension targets, Safari Web Extensions, Node `node:test`, Flutter test, bash release scripts.

---

### Task 1: Freeze the Safari bridge contract and version ownership

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-safari-app/ios/Shared/Roll20SafariBridgeContract.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_bridge_contract.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_bridge_contract_test.dart`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/safari_inbox_writer_contract.test.js`

**Steps:**
1. Add one explicit compatibility constant such as `bridgeContractVersion = 1` next to the existing App Group, inbox path, pending path, storage-budget, and message-type constants.
2. Keep `schemaVersion = 1` for exported JSON and document that importer compatibility is enforced by `schemaVersion + bridgeContractVersion`, not by browser-extension semver.
3. In the Dart contract file, mirror only the values the app actually needs: App Group ID, inbox path, pending path, file extension, contract version, and supported schema versions.
4. Add tests in both repos that fail if the contract values drift.

**Verification:**
- `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/safari_inbox_writer_contract.test.js`
- `flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_bridge_contract_test.dart`

### Task 2: Add a sync step that copies Safari resources into `front`

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/tool/sync_roll20_safari_assets.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/tool/sync_roll20_safari_assets_test.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/readinglog_safari_build_meta.json`
- Reuse source: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter-safari-app/ios/Roll20SafariExtension/Resources/**`
- Reuse source: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/package.json`

**Steps:**
1. Write a small sync tool in `front` that copies Safari popup/content/resource files from `R20-JSONExporter-safari-app` into `front/ios/ReadingLogSafariExtension/Resources`.
2. During sync, rewrite the embedded Safari `manifest.json` version to the app version from `front/pubspec.yaml` so the shipped iOS extension does not report stale browser-extension semver like `0.8.1`.
3. Emit `readinglog_safari_build_meta.json` with at least: `appVersion`, `appBuildNumber`, `safariSourceVersion`, `bridgeContractVersion`, and `supportedSchemaVersions`.
4. Add a test that fails if the copied manifest version, source version, or contract version does not match the generated metadata.

**Verification:**
- `flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/tool/sync_roll20_safari_assets_test.dart`
- `dart run /Users/he-su/Documents/GitHub/readinglog/front/tool/sync_roll20_safari_assets.dart`

### Task 3: Create the embedded Safari extension target inside `front`

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/Runner.entitlements`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner.xcodeproj/project.pbxproj`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Info.plist`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/ReadingLogSafariExtension.entitlements`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/SafariWebExtensionHandler.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/ios/ios_safari_extension_config_test.dart`

**Steps:**
1. Model the new target after the existing widget target in `Runner.xcodeproj`, but use the same App Group `group.com.reha.readinglog.sync`.
2. Embed the Safari extension in the Runner app and point its resources at the synced `ios/ReadingLogSafariExtension/Resources` tree.
3. Set the extension target build settings so `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` resolve from Flutter build variables, not hard-coded `1.0.0`.
4. Add a config test that asserts the target exists, uses the shared App Group, and inherits the app build/version values.

**Verification:**
- `flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/ios/ios_safari_extension_config_test.dart`
- `xcodebuild -workspace /Users/he-su/Documents/GitHub/readinglog/front/ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' build`

### Task 4: Add a dedicated native Safari inbox bridge in `front`

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/AppDelegate.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/SafariBridge/SafariInboxPaths.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/SafariBridge/SafariInboxSnapshot.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/SafariBridge/SafariInboxClaimCoordinator.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/ios/ios_safari_inbox_bridge_test.dart`

**Steps:**
1. Add a new `MethodChannel` such as `readinglog/safari_bridge` instead of extending `readinglog/shared_json_import`, because Safari will manage directory-based inbox and pending states rather than one staged file in `UserDefaults`.
2. Expose methods for: resolving inbox paths, listing inbox/pending counts, atomically claiming one inbox file into `pending`, and deleting or restoring claimed files.
3. Keep `AppDelegate.swift` thin by delegating path and claim logic into small Swift helpers under `ios/Runner/SafariBridge`.
4. Reuse the existing App Group lookup pattern already present in `AppDelegate.swift`.

**Verification:**
- `flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/ios/ios_safari_inbox_bridge_test.dart`
- `xcodebuild -workspace /Users/he-su/Documents/GitHub/readinglog/front/ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

### Task 5: Reuse the existing JSON import service for Safari pending files

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_bridge.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_bridge_io.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_bridge_stub.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_pending_import_service.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_pending_import_service_test.dart`
- Reuse: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_json_import_service.dart`
- Reuse: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_import_support.dart`

**Steps:**
1. Wrap the new native channel with a Dart bridge that can query counts, claim one file, and clean up a claimed file after import.
2. Implement `SafariPendingImportService` so it:
   - retries the oldest existing `pending` file first on startup/resume
   - claims one inbox file into `pending` only when there is no retained pending work
   - runs storage preflight using the existing helpers in `book_import_support.dart`
   - imports via `importBookJsonPlatformFile(...)`
   - deletes the `pending` file only after a successful import
   - leaves the file in `pending` on failure
3. Guard the whole import run with a service-level mutex so repeated `resumed` events cannot double-import the same file.
4. On failure, keep the file in `pending` for later diagnostics, but do not expose a user-facing retry button in the first product UI.
5. Add tests for success, malformed JSON, low-storage block, duplicate resume calls, and failure retention.

**Verification:**
- `flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_pending_import_service_test.dart`

### Task 6: Hook startup/resume and add a testing-first UI surface

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/main.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/widgets/my_page_debug_section.dart`
- Optionally create later: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/widgets/my_page_safari_import_section.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_lifecycle_consumer_test.dart`

**Steps:**
1. Extend `_SyncLifecycleBridge` in `main.dart` so startup and `resumed` both trigger Safari pending import consumption after widget-open consumption.
2. Keep the existing `shared_json_import` flow in `book_screen.dart` unchanged for file-share entry points; Safari should use the new service, not replace this path.
3. In the existing import action sheet opened from `파일 불러오기`, add a third action: `사파리에서 가져오기 (New)`.
4. Show that third action only on iOS and macOS.
5. Tapping `사파리에서 가져오기 (New)` should open an app-side guidance flow, not try to programmatically open the Safari extension popup. The guidance flow may offer `Roll20 열기` and `Safari 확장 켜는 방법`.
6. On automatic import failure, show only a toast such as `파일 이식에 실패했습니다.` and keep the retained `pending` file out of the primary user-facing UI.
7. Only after real-device validation should any detailed Safari status move into a polished user-facing section.

**Verification:**
- `flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_lifecycle_consumer_test.dart`

### Task 7: Define the expected end-to-end behavior for testing

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/docs/testing/ios_safari_roll20_manual_test.md`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/docs/targets.md`

**Steps:**
1. Document the manual device loop exactly:
   - in ReadingLog, open `파일 불러오기`
   - select `사파리에서 가져오기 (New)`
   - follow the app guidance to open Roll20 in Safari
   - trigger Safari popup export from Safari
   - popup runs DOM measure -> JSON build -> storage preflight -> inbox write
   - switch to ReadingLog
   - app startup/resume claims one inbox file into `pending`
   - import succeeds into local library
   - pending file is deleted on success
2. Document failure behavior:
   - malformed JSON stays in `pending`
   - user sees only a failure toast in the app
   - the app automatically retries retained `pending` work on the next startup/resume before claiming new inbox files
   - no silent deletion on failure
3. Add one explicit note that Safari export does not auto-open a project after import during the testing phase.
4. Add one explicit note that the app cannot directly open the Safari extension popup; the user opens it inside Safari.

**Verification:**
- Manual real-device execution using the checklist document

### Task 8: Attach release version management to the integration

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/package.json`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/manifest.json`
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/safari_manifest_contract.test.js`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/pubspec.yaml`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner.xcodeproj/project.pbxproj`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/ios/ios_safari_release_version_test.dart`

**Steps:**
1. Keep browser-extension release semver owned by `R20-JSONExporter/package.json` and `manifest.json`, with tests that they always match.
2. Keep App Store/TestFlight version owned by `front/pubspec.yaml`; the embedded Safari extension target must inherit that app version/build during iOS builds.
3. Do not use browser-extension semver as a runtime compatibility gate for the app; use `bridgeContractVersion` instead.
4. Surface both values in generated metadata so a debug screen can report `app version`, `embedded safari build version`, and `source exporter version`.
5. Add a failing test if the embedded extension target drifts back to hard-coded `MARKETING_VERSION = 1.0.0`.
6. Until real-device testing proves a larger safe limit, enforce a conservative Safari transport payload cap at or below 1 MB for the popup-to-native handoff, even though Apple does not publish a fixed App Group container quota.

**Verification:**
- `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/safari_manifest_contract.test.js`
- `flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/ios/ios_safari_release_version_test.dart`

### Task 9: Run focused verification before device QA

**Files:**
- No new files required

**Steps:**
1. Run Safari scaffold tests in the extension repo.
2. Run focused Flutter tests for the new Safari bridge/import code in `front`.
3. Run the existing iOS config tests in `front`.
4. Build the iOS Runner app with the embedded Safari extension target.
5. Perform one real-device smoke test on iPhone or iPad Safari.

**Verification:**
- `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/safari_content_export.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/safari_popup_controller.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/safari_manifest_contract.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/safari_inbox_writer_contract.test.js`
- `flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/ios/ios_shared_json_import_config_test.dart`
- `flutter test /Users/he-su/Documents/GitHub/readinglog/front/test/release/release_smoke_test.dart`
- `xcodebuild -workspace /Users/he-su/Documents/GitHub/readinglog/front/ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' build`

---

## Recommended rollout order

1. Contract + asset sync
2. Embedded Safari extension target
3. Native inbox bridge
4. Dart pending import service
5. Debug-only UI and lifecycle hookup
6. Device smoke test
7. Release version hardening
8. Productized MyPage UI
