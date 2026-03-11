# ReadingLog iOS Safari Bridge Implementation Plan

> Execution target repo: `/Users/he-su/Documents/GitHub/readinglog/front`
>
> This plan replaces the earlier generic Flutter layout assumptions. It is aligned to the actual `readinglog/front` structure as inspected on March 10, 2026.

## Goal

Add a Safari Web Extension bridge to the existing ReadingLog Flutter iOS app so that:

1. Safari on iPhone/iPad opens Roll20.
2. The extension parses the currently loaded Roll20 chat DOM with the shared `roll20-json-core`.
3. The extension writes one JSON payload into the existing ReadingLog App Group inbox.
4. The Flutter app imports that JSON into the existing project storage pipeline.
5. The App Group inbox file is deleted immediately after a confirmed successful import.
6. Failed imports remain recoverable and visible for retry/debug until pruned.

## Repo-specific constraints discovered

- Flutter package name is `readinglog`.
- The existing iOS host target is `ios/Runner`.
- There is already an extension target at `ios/ReadingLogWidgetExtension`.
- The existing App Group is `group.com.reha.readinglog.sync`.
- Apple documentation does not expose a fixed byte quota for an App Group shared container; the bridge must enforce its own inbox budget and low-space handling.
- Existing native bridge style lives in [AppDelegate.swift](/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/AppDelegate.swift).
- Existing lifecycle hook lives in [main.dart](/Users/he-su/Documents/GitHub/readinglog/front/lib/main.dart).
- Existing import pipeline lives in [book_screen.dart](/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart) and [book_import_support.dart](/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_import_support.dart).
- Existing project storage APIs live in [project_storage.dart](/Users/he-su/Documents/GitHub/readinglog/front/lib/util/project/project_storage.dart) and [project_storage_io.dart](/Users/he-su/Documents/GitHub/readinglog/front/lib/util/project/project_storage_io.dart).
- Existing debug surface already exists in [my_page_debug_section.dart](/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/widgets/my_page_debug_section.dart).
- Opening an `https` URL from iOS is not a reliable "force Safari" mechanism because the user may have another default browser; the product must treat Safari launch as a guided flow, not as a guaranteed one-tap redirect.

## Architecture

- Keep Roll20 parsing logic in sibling repo `roll20-json-core`.
- Create a new iOS extension target alongside `ReadingLogWidgetExtension`, for example `ReadingLogSafariExtension`.
- Reuse the current App Group `group.com.reha.readinglog.sync`.
- Store pending Safari exports under an inbox folder inside the App Group shared container, for example `roll20/inbox/`.
- Treat the App Group inbox as a transient buffer with a product-defined budget, not as permanent storage.
- Write each inbox file as a raw ReadingLog-compatible portable JSON document, not as a separate wrapper/envelope format.
- Reuse ReadingLog's existing JSON import/save pipeline instead of inventing a second storage format.
- Hook inbox consumption into the existing `_SyncLifecycleBridge` startup/resume flow.
- Delete inbox files only after ReadingLog confirms the project was imported into internal storage.
- If automatic import fails, the app must allow manual re-import directly from the existing inbox file without asking the user to re-export from Safari.
- Provide explicit Safari-only guidance from the app, with an optional "open Roll20" convenience action that is best-effort and not assumed to land in Safari on every device.
- Preserve web filename behavior by resolving the export title with the same precedence: Roll20 campaign name from href, then `document.title`, then `roll20-chat`.

## Delivery shape

The implementation should land in the Flutter repo, not in this extension repo. The changes should be grouped into the following work items.

---

## Task 1: Freeze the cross-platform bridge contract

**Purpose**

Define one contract shared by:

- Safari popup/content scripts
- iOS native inbox writer
- Flutter Dart importer

**Files**

- Create: `docs/roll20_ios_safari_bridge_contract.md`
- Create: `lib/sync/safari/safari_bridge_contract.dart`
- Create: `test/sync/safari/safari_bridge_contract_test.dart`

**Contract contents**

- App Group ID: `group.com.reha.readinglog.sync`
- Inbox relative path: `roll20/inbox`
- Temp suffix: `.tmp`
- JSON extension: `.json`
- Producer tag: `roll20_safari`
- File naming rule: `resolved title + duplicate suffix if needed + .json`
- Export title precedence:
  - Roll20 campaign name parsed from `/campaigns/details/...` href
  - `document.title`
  - `roll20-chat`
- Inbox file contents: raw ReadingLog-compatible portable JSON payload
- Popup progress stages:
  - `measuring_dom`
  - `estimating_payload`
  - `building_json`
  - `checking_storage`
  - `writing_inbox`
  - `done`

**Failing test first**

- Assert filename generation is deterministic.
- Assert filenames always end with `.json`.
- Assert the inbox relative path is stable.
- Assert title resolution follows the same precedence as the current web extension.

**Implementation notes**

- Keep this file small and dependency-light.
- Native Swift constants must mirror this contract exactly.

**Verification**

- `flutter test test/sync/safari/safari_bridge_contract_test.dart`

**Commit**

- `docs: define readinglog safari bridge contract`

---

## Task 2: Reuse the existing App Group instead of creating a new one

**Purpose**

Bring the future Safari extension into the same shared container already used by Runner and WidgetExtension.

**Files**

- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/Runner.entitlements`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/ReadingLogSafariExtension.entitlements`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner.xcodeproj/project.pbxproj`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/RunnerTests/SafariAppGroupConfigTests.swift`

**Failing test first**

- Assert native config resolves `group.com.reha.readinglog.sync`.
- Assert inbox relative path is `roll20/inbox`.

**Implementation notes**

- Do not introduce a second App Group.
- Match the same entitlement style already used by `ReadingLogWidgetExtension`.
- Add a small Swift config file such as:
  - `ios/Runner/SafariBridge/SafariAppGroupConfig.swift`

**Verification**

- `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

**Commit**

- `ios: add safari bridge app group config`

---

## Task 3: Scaffold the Safari extension target next to the widget extension

**Purpose**

Create the iOS-side container for Safari Web Extension resources and bridge scripts.

**Files**

- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Info.plist`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/SafariWebExtensionHandler.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/manifest.json`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/popup.html`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/js/popup.js`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/js/content.js`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/RunnerTests/SafariExtensionManifestTests.swift`

**Failing test first**

- Assert the manifest contains Roll20 host permissions.
- Assert the popup resource exists.

**Implementation notes**

- Model the Xcode target wiring after the existing `ReadingLogWidgetExtension`.
- Keep the initial handler minimal.
- Target hosts should include:
  - `https://app.roll20.net/*`
  - any additional Roll20 host variants the web extension already supports

**Verification**

- `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

**Commit**

- `ios: scaffold readinglog safari extension target`

---

## Task 4: Add a staging script for shared Roll20 assets

**Purpose**

Prevent manual copy-paste of parser rules into the Flutter repo.

**Files**

- Create: `/Users/he-su/Documents/GitHub/readinglog/front/tool/sync_roll20_safari_assets.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/pubspec.yaml`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/tool/sync_roll20_safari_assets_test.dart`

**Failing test first**

- Assert the sync plan stages a browser bundle under:
  - `ios/ReadingLogSafariExtension/Resources/js/vendor/roll20-json-core.js`
- Assert the sync plan stages Safari shell files into the extension resource tree.

**Implementation notes**

- Input root should point at sibling `roll20-json-core`.
- Output should target `ios/ReadingLogSafariExtension/Resources/js/vendor/`.
- The script should be idempotent.
- This step should also stage any shared popup/content helpers needed by Safari.

**Verification**

- `flutter test test/tool/sync_roll20_safari_assets_test.dart`
- `dart run tool/sync_roll20_safari_assets.dart`

**Commit**

- `build: add safari asset sync script`

---

## Task 5: Extract the existing JSON import logic out of BookScreen

**Purpose**

Safari inbox import must reuse the same save/validation pipeline as manual `.json` import.

**Files**

- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_import_support.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_json_import_service.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/ui/book/book_json_import_service_test.dart`

**Why this extraction is required**

Today `_registerImportedJson()` inside `BookScreen` already does the right work:

- validates extension
- decodes bytes
- parses ReadingLog project JSON
- resolves a unique file name
- writes through `saveProjectLines()`

That logic should become reusable by:

- manual picker import
- Safari inbox import
- future Android share/import flow

**Failing test first**

- Assert raw bytes import produces a saved local project entry.
- Assert duplicate file names are renamed via `resolveUniqueProjectFileName()`.
- Assert malformed payloads return existing `BookImportException` types.

**Implementation notes**

- Move import orchestration into `BookJsonImportService`.
- Keep `BookScreen` as a UI client.
- Preserve existing user-facing toast/error semantics.

**Verification**

- `flutter test test/ui/book/book_json_import_service_test.dart`
- `flutter test test/ui/book/`

**Commit**

- `refactor: extract reusable book json import service`

---

## Task 6: Add a native Safari inbox writer inside Runner

**Purpose**

Allow the extension and the host app to agree on where inbox files live and how they are written atomically.

**Files**

- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/SafariBridge/SafariInboxPaths.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/SafariBridge/SafariInboxWriter.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/RunnerTests/SafariInboxWriterTests.swift`

**Failing test first**

- Assert inbox path resolves inside the existing App Group container.
- Assert atomic write creates `.tmp` then final `.json`.
- Assert invalid empty payloads are rejected.
- Assert the final inbox file contains raw portable project JSON, not a wrapper object.
- Assert the inbox filename preserves the web naming rule based on resolved scenario title.

**Implementation notes**

- Use `FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:)`.
- Create `roll20/inbox` lazily if missing.
- Write to temp file first, then `moveItem` into final path.
- Keep one file per export.
- Do not write directly into app documents storage.
- The writer input should be:
  - `fileName`
  - raw JSON text or bytes
  - lightweight metadata only for logging/debug, not for storage wrapping

**Verification**

- `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

**Commit**

- `ios: add safari inbox writer`

---

## Task 7: Add a Runner MethodChannel bridge for Safari inbox inspection and cleanup

**Purpose**

Flutter needs native access to:

- list pending inbox files
- read inbox file metadata/content
- delete inbox files after successful import
- prune stale failed files

**Files**

- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/AppDelegate.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/SafariBridge/SafariInboxBridgePlugin.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/RunnerTests/SafariInboxBridgePluginTests.swift`

**MethodChannel**

- Channel name: `readinglog/safari_inbox_bridge`

**Candidate methods**

- `listPendingRoll20InboxFiles`
- `readPendingRoll20InboxFile`
- `deletePendingRoll20InboxFile`
- `prunePendingRoll20InboxFiles`
- `deleteAllPendingRoll20InboxFiles`

**Failing test first**

- Assert unknown methods return not-implemented.
- Assert list returns deterministic row dictionaries.
- Assert delete removes a file only from the inbox path.
- Assert bulk delete removes only inbox-owned files and returns deleted count.

**Implementation notes**

- Follow the existing `widget_bridge` and `icloud_bridge` style in `AppDelegate.swift`.
- Keep AppDelegate thin; put logic into dedicated Swift files.

**Verification**

- `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

**Commit**

- `ios: expose safari inbox bridge channel`

---

## Task 8: Add Dart bridge wrappers under the existing sync namespace

**Purpose**

Match the current ReadingLog architecture instead of inventing a new feature tree.

**Files**

- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_inbox_bridge.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_inbox_bridge_io.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_inbox_bridge_stub.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_inbox_bridge_test.dart`

**Failing test first**

- Assert `isSupported` is false on unsupported platforms.
- Assert bridge rows map into typed Dart models.
- Assert platform exceptions degrade to null or empty results where appropriate.

**Implementation notes**

- Mirror the existing:
  - `lib/sync/widget/widget_bridge.dart`
  - `lib/sync/backends/icloud_container_bridge.dart`
- Keep the public API small and typed.

**Suggested models**

- `SafariInboxEntry`
- `SafariInboxReadResult`

**Verification**

- `flutter test test/sync/safari/safari_inbox_bridge_test.dart`

**Commit**

- `flutter: add safari inbox bridge wrapper`

---

## Task 9: Build a Dart inbox import coordinator on top of the extracted book importer

**Purpose**

This is the orchestration layer that converts a pending Safari inbox file into a saved ReadingLog project.

**Files**

- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_inbox_import_coordinator.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_inbox_import_coordinator_test.dart`

**Responsibilities**

- fetch inbox list
- read JSON payload
- run a second storage preflight immediately before importing into ReadingLog local storage
- pass bytes/content to `BookJsonImportService`
- delete inbox file only on confirmed success
- leave failed files in place
- prune stale failed files by age/count
- import from the raw inbox file directly without an extra envelope decode step
- support targeted re-import of an already saved inbox file without re-running Safari export

**Failing test first**

- Assert successful import deletes the inbox file.
- Assert failed import preserves the inbox file.
- Assert duplicate file names are renamed, not overwritten.
- Assert only `.json` inbox files are considered importable.
- Assert low free-space import preflight blocks the local save before `saveProjectLines()`.
- Assert an inbox file remains untouched when the second preflight fails.
- Assert a user-triggered retry can import an existing inbox file without requesting a new Safari parse.

**Implementation notes**

- Return an import summary object with:
  - imported count
  - renamed count
  - failed count
  - imported project titles
- Keep the coordinator UI-agnostic.
- Reuse ReadingLog's existing project naming rules so the final saved local file name still comes from `scenarioTitle` with duplicate suffix handling.
- The second preflight should use stricter headroom than the Safari-side write check because the system briefly holds:
  - inbox original
  - app-local destination file
  - temporary parsing buffers
- Recommended import headroom rule:
  - reject import if free space is below `max(256 MB, inboxFileBytes * 2 + 4 MB)`

**Verification**

- `flutter test test/sync/safari/safari_inbox_import_coordinator_test.dart`

**Commit**

- `flutter: add safari inbox import coordinator`

---

## Task 10: Hook Safari inbox consumption into the existing lifecycle bridge

**Purpose**

ReadingLog already performs startup/resume work in `_SyncLifecycleBridge`. Safari import should join that flow instead of adding a parallel bootstrap mechanism.

**Files**

- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/main.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/main_safari_inbox_lifecycle_test.dart`

**Current integration point**

Existing startup/resume flow already does:

- `syncManager.syncOnAppStart()`
- `syncWidgetStateFromPlayer(player)`
- `consumePendingWidgetOpenIfAny(...)`

**New behavior**

- After widget-open consumption, run Safari inbox import.
- Guard against duplicate concurrent imports.
- Keep startup resilient; import failures must not block app launch.

**Failing test first**

- Assert startup triggers inbox import once.
- Assert resume triggers inbox import again.
- Assert concurrent resume events do not start duplicate import runs.

**Implementation notes**

- Reuse the same `_isConsuming...` pattern already present in `_SyncLifecycleBridgeState`.
- Consider one additional boolean such as `_isConsumingSafariInbox`.

**Verification**

- `flutter test test/main_safari_inbox_lifecycle_test.dart`

**Commit**

- `flutter: wire safari inbox import into lifecycle bridge`

---

## Task 11: Add a user-facing pending Safari imports section

**Purpose**

If automatic import fails after the user returns from Safari, the user should be able to import the already saved inbox file directly from ReadingLog. They should not need to go back to Safari and re-parse Roll20 unless they choose to.

**Files**

- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/widgets/my_page_safari_inbox_section.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/my_page_screen.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/ui/mypage/my_page_safari_inbox_section_test.dart`

**User actions**

- `Import pending export`
- `Import all pending exports`
- `Delete pending export`
- `Clear all pending exports`
- view:
  - pending file name
  - created time
  - estimated size
  - last error if known

**Failing test first**

- Assert pending inbox files render in MyPage.
- Assert tapping `Import` imports the selected inbox file without re-running Safari export.
- Assert tapping `Import all` drains all importable inbox files.
- Assert tapping delete removes only the selected inbox file after confirmation.

**Implementation notes**

- This section must be user-visible, not debug-only.
- It should call the existing inbox coordinator and bridge methods.
- It should clearly tell the user that the data is already saved locally in ReadingLog's inbox buffer.

**Verification**

- `flutter test test/ui/mypage/my_page_safari_inbox_section_test.dart`

**Commit**

- `ui: add pending safari inbox import section`

---

## Task 12: Surface manual retry and debug visibility in the existing MyPage debug section

**Purpose**

If Safari import fails, the user needs a non-Xcode recovery path.

**Files**

- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/widgets/my_page_debug_section.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/ui/mypage/my_page_debug_section_safari_test.dart`

**UI additions**

- Show pending Safari inbox count in debug builds.
- Add button: `Debug: Safari inbox import retry`
- Add button: `Debug: Safari inbox prune stale files`
- Add button: `Debug: Safari inbox clear all`
- Optionally show last import result summary.

**Failing test first**

- Assert buttons render only in debug mode.
- Assert pressing retry calls the coordinator.
- Assert pressing prune calls the bridge cleanup path.
- Assert pressing clear-all removes all pending inbox files after confirmation.

**Implementation notes**

- Keep this debug-only first.
- Do not add a separate settings screen yet.

**Verification**

- `flutter test test/ui/mypage/my_page_debug_section_safari_test.dart`

**Commit**

- `ui: add safari inbox debug actions`

---

## Task 13: Add Safari popup progress UX for measure -> parse -> write

**Purpose**

The user asked for visible UX feedback during the full export path. The Safari popup should show progress from DOM measurement through JSON build and inbox save, instead of behaving like a blind fire-and-forget action.

**Files**

- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/popup.html`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/popup.css`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/js/popup.js`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/js/export_progress_model.js`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/RunnerTests/SafariPopupProgressModelTests.swift`

**User-visible stages**

1. Roll20 session title 확인
2. 현재 DOM 규모 계측
3. 예상 JSON 용량 계산
4. JSON 파싱/생성
5. App Group 저장 가능 여부 확인
6. inbox 저장
7. 완료 후 ReadingLog로 돌아가라는 안내

**User actions in Safari popup**

- `Export to ReadingLog`
- `Delete last pending export`
- `Clear all pending exports`
- `Refresh pending inbox status`

**Failing test first**

- Assert the popup renders an idle state before export.
- Assert stage transitions appear in the defined order.
- Assert measured counts and estimated byte size are shown to the user.
- Assert storage preflight failures render a recoverable error state.
- Assert delete actions show confirmation before destructive removal.
- Assert the popup shows pending inbox count when files remain.

**Implementation notes**

- The popup should remain minimal but explicit:
  - stage label
  - progress indicator
  - resolved file name
  - message count or DOM count summary
  - estimated payload bytes
  - success/failure guidance
- Safari itself does not expose a system UI for browsing or deleting App Group inbox files.
- Therefore the extension popup must expose the user-facing delete/clear actions through the native bridge.
- This is not import progress inside ReadingLog; it is export progress inside Safari.

**Verification**

- `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`
- Manual verification on iPhone/iPad Safari

**Commit**

- `ios: add safari popup export progress UX`

---

## Task 14: Build the Safari extension export path end to end

**Purpose**

Connect popup action to DOM parsing and native inbox write.

**Files**

- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/js/popup.js`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/js/content.js`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/ReadingLogSafariExtension/Resources/js/export_bridge.js`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/RunnerTests/SafariExtensionExportBridgeTests.swift`

**Flow**

1. User taps export in Safari popup.
2. Popup resolves the same filename base rule used on web.
3. Popup requests DOM measurement from the content script.
4. Popup shows measured node/message counts and estimated JSON size.
5. Content script runs `roll20-json-core` against the current Roll20 DOM.
6. Extension passes the raw ReadingLog-compatible JSON payload plus filename to native Swift bridge.
7. Native writer saves the inbox file.
8. Popup shows success or failure state and tells the user to return to ReadingLog.
9. The inbox original is not deleted at this stage; it remains until ReadingLog successfully imports it.

**Failing test first**

- Assert popup dispatches export request.
- Assert empty export result is rejected.
- Assert native handoff receives serialized JSON string plus metadata.
- Assert the native handoff receives the resolved filename based on Roll20 title rules.

**Implementation notes**

- Match the Chrome/Firefox export behavior semantically.
- The scope is the currently loaded full DOM, not "visible viewport only".
- Do not add auto-scroll/loading at this stage.
- Safari should save with the same title-derived base name as web whenever the same Roll20 title can be resolved.

**Verification**

- `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`
- Manual device verification in Safari on iPhone/iPad

**Commit**

- `ios: connect safari extension export flow`

---

## Task 15: Add delete-on-success retention rules and recovery tests

**Purpose**

Guarantee App Group storage stays bounded.

**Files**

- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_inbox_import_coordinator.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/SafariBridge/SafariInboxBridgePlugin.swift`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_inbox_retention_test.dart`

**Retention rules**

- Successful import: delete immediately.
- Failed import: retain for retry.
- Background prune: keep only recent failures, for example:
  - last 20 files, or
  - last 7 days
- Never delete outside the App Group inbox directory.

**Failing test first**

- Assert success deletes.
- Assert parse failure preserves.
- Assert prune respects max-age/max-count.

**Verification**

- `flutter test test/sync/safari/safari_inbox_retention_test.dart`

**Commit**

- `flutter: add safari inbox retention rules`

---

## Task 16: Add App Group storage budget and low-space guardrails

**Purpose**

App Group shared storage has no documented fixed per-group byte quota. The bridge therefore needs explicit product-level limits and graceful failure modes before the inbox can grow uncontrollably.

**Files**

- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_bridge_contract.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/SafariBridge/SafariInboxWriter.swift`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/SafariBridge/SafariInboxBridgePlugin.swift`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_inbox_import_coordinator.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_inbox_storage_budget_test.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/ios/RunnerTests/SafariInboxStorageBudgetTests.swift`

**Recommended initial budget**

- Max single inbox file: `8 MB`
- Max total pending inbox bytes: `64 MB`
- Max pending files: `20`
- Min device free space before accepting a new write: `256 MB`

These are product guardrails, not Apple-defined quotas. They can be tuned after real export sizes are measured.

**Failing test first**

- Assert oversized single payloads are rejected before write.
- Assert writes are rejected when pending inbox bytes exceed the soft cap.
- Assert low free-space preflight returns a user-visible storage error.
- Assert successful imports free budget immediately because the inbox file is deleted.
- Assert the app-side second preflight can fail even after Safari-side write succeeded, and in that case the inbox original remains for retry.

**Implementation notes**

- Use `URLResourceValues.volumeAvailableCapacityForImportantUsage` or equivalent native capacity checks where available.
- Return typed error codes for:
  - `storage_quota_exceeded`
  - `storage_low_space`
  - `storage_payload_too_large`
  - `storage_import_preflight_failed`
- Before final release tuning, record real export sizes from at least:
  - 10 small sessions
  - 10 medium sessions
  - 10 large sessions
- Record these metrics in the popup and test logs:
  - resolved title
  - message count
  - DOM node estimate
  - final JSON byte length
- If measured payloads regularly approach the soft cap, adjust the budget constants before App Store release instead of silently relying on the placeholder values above.
- Surface those codes through the Dart bridge so popup/app UI can show actionable messaging.

**Verification**

- `flutter test test/sync/safari/safari_inbox_storage_budget_test.dart`
- `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

**Commit**

- `ios: add safari inbox storage guardrails`

---

## Task 17: Add app-side Safari launch and onboarding flow

**Purpose**

The Safari extension runs only inside Safari. ReadingLog needs an explicit UX for "how to get from the app to Safari + Roll20" without using an embedded WebView.

**Files**

- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/widgets/roll20_safari_launch_card.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/my_page_screen.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/help/help_screen.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/ui/mypage/roll20_safari_launch_card_test.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/README.md`

**User flow**

1. ReadingLog explains that Roll20 export works only in Safari.
2. The app offers a best-effort `Open Roll20` action using a normal external URL open.
3. The app also shows fallback instructions:
   - if another default browser opens, switch to Safari manually
   - enable the ReadingLog Safari extension in iOS Settings if not already enabled
   - trigger export from Safari's extension UI on the Roll20 page
4. After export, return to ReadingLog to import and delete the inbox file.

**Failing test first**

- Assert the launch card renders Safari-only instructions.
- Assert tapping `Open Roll20` delegates to external URL launch.
- Assert the copy explains that the action is best-effort and may not open Safari if the default browser differs.

**Implementation notes**

- Do not use `WebView`.
- Do not rely on undocumented Safari-specific URL schemes.
- The baseline product flow must still work if the user opens Safari manually.
- Keep this launch/help card user-visible in MyPage or Help, not debug-only.

**Verification**

- `flutter test test/ui/mypage/roll20_safari_launch_card_test.dart`

**Commit**

- `ui: add safari launch guidance for roll20 export`

---

## Task 18: Add release/build integration for the Flutter iOS app

**Purpose**

Make Safari asset staging and iOS build repeatable for release work.

**Files**

- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/deploy.sh`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/release_store.sh`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/README.md`

**Build expectations**

- Safari asset sync runs before iOS archive.
- Build fails fast if `roll20-json-core` staging is missing.
- Documentation explains:
  - how to enable the Safari extension after install
  - where inbox files go
  - how ReadingLog imports/deletes them

**Verification**

- `flutter test`
- `flutter build ios --debug`
- release script dry-run if applicable

**Commit**

- `build: integrate safari bridge into ios release flow`

---

## Task 19: End-to-end manual verification checklist

**Purpose**

Confirm the bridge works on actual iPhone/iPad hardware, not only in tests.

**Checklist**

1. Install the ReadingLog iOS app with Safari extension included.
2. Enable extension in iOS Settings > Safari > Extensions.
3. Use the app's `Open Roll20` action and confirm whether Safari or another browser opens.
4. If another browser opens, manually switch to Safari and continue.
5. Open Roll20 in Safari and load a session with existing chat DOM.
6. Trigger export from the Safari extension popup.
7. Confirm the popup shows measure -> estimate -> build -> save progress stages.
8. Confirm the popup shows the resolved title-derived file name.
9. Confirm one raw portable JSON file appears under the App Group inbox.
10. Confirm the Safari popup shows pending inbox count and can delete the pending export on user request.
11. Confirm the inbox file is still present immediately after Safari reports save success if the user does not delete it manually.
12. Bring ReadingLog to foreground.
13. Confirm ReadingLog runs the second import preflight before local save.
14. Force one automatic import failure and confirm the pending inbox entry remains visible in ReadingLog.
15. Confirm the user can import the existing inbox entry from MyPage without going back to Safari.
16. Confirm ReadingLog imports the project into local storage.
17. Confirm the imported local file name matches the scenario title with duplicate suffix behavior matching existing app rules.
18. Confirm the App Group inbox file is deleted immediately after successful import.
19. Confirm duplicate imports get a unique filename instead of overwrite.
20. Confirm malformed JSON remains in inbox and is visible to user retry/prune.
21. Confirm oversized or low-space exports fail with an explicit storage message instead of silently leaving partial files behind.

**Recommended evidence**

- screen recording on iPhone
- screenshot of debug section pending inbox count
- one failing-file recovery test

---

## Suggested implementation order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9
10. Task 10
11. Task 11
12. Task 12
13. Task 13
14. Task 14
15. Task 15
16. Task 16
17. Task 17
18. Task 18
19. Task 19

## Notes for future Android alignment

- The extracted `BookJsonImportService` should become the shared import path for Android Firefox share/import as well.
- The inbox coordinator abstraction can later be mirrored by an Android `Intent` import coordinator.
- No iOS-only project schema should be introduced here.
