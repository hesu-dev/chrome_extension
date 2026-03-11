# Standalone Safari Export App and ReadingLog Integration Detailed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone iOS Flutter app with a Safari Web Extension for Roll20 export first, then add an explicit export/import handoff into ReadingLog after the standalone flow is stable.

**Architecture:** Keep Roll20 parsing in the existing sibling `roll20-json-core`. Build a new standalone Flutter app that owns its own App Group, Safari extension, pending export storage, retry/delete UI, and local import path. After that stabilizes, add a file-based export/share path from the standalone app into ReadingLog, and only then add the ReadingLog-side receive/import flow.

**Tech Stack:** Flutter, Dart, Swift, Safari Web Extensions, iOS App Groups, MethodChannel, Xcode targets, `roll20-json-core`, file-based app-to-app sharing.

---

### Task 1: Create the standalone app repo skeleton

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/pubspec.yaml`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/main.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/widget_smoke_test.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/README.md`

**Step 1: Write the failing widget smoke test**

Create `test/widget_smoke_test.dart` with a single expectation that the home screen renders a standalone app title such as `Roll20 Safari Export`.

**Step 2: Run test to verify it fails**

Run: `flutter test test/widget_smoke_test.dart`

Expected: FAIL because the app scaffold does not exist yet.

**Step 3: Write minimal implementation**

- Create a minimal Flutter app shell.
- Keep the app independent from ReadingLog.
- Render one home scaffold with placeholder sections:
  - Safari export status
  - Pending exports
  - Help

**Step 4: Run test to verify it passes**

Run: `flutter test test/widget_smoke_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add pubspec.yaml lib/main.dart test/widget_smoke_test.dart README.md
git commit -m "chore: create standalone safari export app shell"
```

---

### Task 2: Add iOS build baseline and verify the app boots on iOS

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/Info.plist`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/Runner.entitlements`
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner.xcodeproj/project.pbxproj`

**Step 1: Verify current iOS build fails or is missing**

Run: `flutter build ios --debug`

Expected: FAIL or missing project files if the repo is not yet fully bootstrapped.

**Step 2: Write minimal implementation**

- Ensure the standalone app has a valid iOS Runner target.
- Add a dedicated App Group placeholder entitlement:
  - `group.com.reha.roll20safariexport`

**Step 3: Run build to verify it works**

Run: `flutter build ios --debug`

Expected: PASS.

**Step 4: Commit**

```bash
git add ios/Runner/Info.plist ios/Runner/Runner.entitlements ios/Runner.xcodeproj/project.pbxproj
git commit -m "ios: add standalone app iOS baseline"
```

---

### Task 3: Define the standalone Safari bridge contract

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/docs/safari_bridge_contract.md`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/sync/safari/safari_bridge_contract.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/sync/safari/safari_bridge_contract_test.dart`

**Step 1: Write the failing Dart test**

Assert:

- app group id is stable
- inbox relative path is `roll20/inbox`
- file extension is `.json`
- progress stage list matches expected order

**Step 2: Run test to verify it fails**

Run: `flutter test test/sync/safari/safari_bridge_contract_test.dart`

Expected: FAIL with missing contract file.

**Step 3: Write minimal implementation**

Add constants for:

- app group id
- inbox path
- pending path
- progress stages
- initial storage limits

**Step 4: Run test to verify it passes**

Run: `flutter test test/sync/safari/safari_bridge_contract_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add docs/safari_bridge_contract.md lib/sync/safari/safari_bridge_contract.dart test/sync/safari/safari_bridge_contract_test.dart
git commit -m "docs: define standalone safari bridge contract"
```

---

### Task 4: Port the web filename rule into a reusable helper

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/sync/safari/export_file_name.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/sync/safari/export_file_name_test.dart`

**Step 1: Write the failing test**

Cover:

- campaign href title wins first
- `document.title` is fallback
- `roll20-chat` is final fallback
- duplicate suffix logic is separate and not baked into the raw title resolution

**Step 2: Run test to verify it fails**

Run: `flutter test test/sync/safari/export_file_name_test.dart`

Expected: FAIL with missing helper.

**Step 3: Write minimal implementation**

Mirror the current web behavior from:

- `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/js/content/core/content.js`

**Step 4: Run test to verify it passes**

Run: `flutter test test/sync/safari/export_file_name_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/sync/safari/export_file_name.dart test/sync/safari/export_file_name_test.dart
git commit -m "flutter: add safari export file name helper"
```

---

### Task 5: Add the Safari extension target shell to the standalone app

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Info.plist`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Roll20SafariExtension.entitlements`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/SafariWebExtensionHandler.swift`
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner.xcodeproj/project.pbxproj`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/RunnerTests/SafariExtensionTargetTests.swift`

**Step 1: Write the failing iOS test**

Assert the Safari extension target resources exist and share the same App Group.

**Step 2: Run test to verify it fails**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: FAIL because the extension target does not exist.

**Step 3: Write minimal implementation**

- Add the new target
- wire entitlements
- embed the extension product

**Step 4: Run test to verify it passes**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: PASS.

**Step 5: Commit**

```bash
git add ios/Roll20SafariExtension ios/Runner.xcodeproj/project.pbxproj ios/RunnerTests/SafariExtensionTargetTests.swift
git commit -m "ios: add standalone safari extension target shell"
```

---

### Task 6: Add a minimal Safari popup resource set

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/manifest.json`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/popup.html`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/js/popup.js`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/js/content.js`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/RunnerTests/SafariManifestTests.swift`

**Step 1: Write the failing iOS test**

Assert:

- Roll20 host permissions exist
- popup exists
- content script exists

**Step 2: Run test to verify it fails**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: FAIL.

**Step 3: Write minimal implementation**

- no export logic yet
- just popup skeleton + content script placeholder

**Step 4: Run test to verify it passes**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: PASS.

**Step 5: Commit**

```bash
git add ios/Roll20SafariExtension/Resources ios/RunnerTests/SafariManifestTests.swift
git commit -m "ios: add safari popup and content shell"
```

---

### Task 7: Add the shared-core asset sync script

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/tool/sync_roll20_safari_assets.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/tool/sync_roll20_safari_assets_test.dart`

**Step 1: Write the failing test**

Assert the script stages:

- `roll20-json-core` browser bundle
- popup helper scripts
- content helper scripts

**Step 2: Run test to verify it fails**

Run: `flutter test test/tool/sync_roll20_safari_assets_test.dart`

Expected: FAIL.

**Step 3: Write minimal implementation**

- read from sibling `/Users/he-su/Desktop/chrome_extension/roll20-json-core`
- emit browser bundle to `ios/Roll20SafariExtension/Resources/js/vendor/`

**Step 4: Run test to verify it passes**

Run: `flutter test test/tool/sync_roll20_safari_assets_test.dart`

Expected: PASS.

**Step 5: Run the sync script**

Run: `dart run tool/sync_roll20_safari_assets.dart`

Expected: staged files created successfully.

**Step 6: Commit**

```bash
git add tool/sync_roll20_safari_assets.dart test/tool/sync_roll20_safari_assets_test.dart ios/Roll20SafariExtension/Resources/js/vendor
git commit -m "build: add standalone safari asset sync"
```

---

### Task 8: Add the popup progress model

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/js/export_progress_model.js`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/safari/export_progress_model.test.js`

**Step 1: Write the failing test**

Assert stage transitions:

- idle -> measuring_dom -> estimating_payload -> building_json -> checking_storage -> writing_inbox -> done

**Step 2: Run test to verify it fails**

Run: `node --test test/safari/export_progress_model.test.js`

Expected: FAIL.

**Step 3: Write minimal implementation**

- simple reducer/state object
- error state support
- pending count support

**Step 4: Run test to verify it passes**

Run: `node --test test/safari/export_progress_model.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add ios/Roll20SafariExtension/Resources/js/export_progress_model.js test/safari/export_progress_model.test.js
git commit -m "ios: add safari popup progress model"
```

---

### Task 9: Implement DOM measurement in the content script

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/js/content.js`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/safari/content_measurement.test.js`

**Step 1: Write the failing test**

Assert the content script can report:

- message count
- DOM node estimate
- resolved title candidate

**Step 2: Run test to verify it fails**

Run: `node --test test/safari/content_measurement.test.js`

Expected: FAIL.

**Step 3: Write minimal implementation**

- query `div.message`
- compute node count estimate
- derive title via helper

**Step 4: Run test to verify it passes**

Run: `node --test test/safari/content_measurement.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add ios/Roll20SafariExtension/Resources/js/content.js test/safari/content_measurement.test.js
git commit -m "ios: add safari content measurement"
```

---

### Task 10: Build raw portable JSON in the content script

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/js/content.js`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/safari/content_export_json.test.js`

**Step 1: Write the failing test**

Assert the export result contains:

- `schemaVersion`
- `ebookView.titlePage.scenarioTitle`
- `lines`

**Step 2: Run test to verify it fails**

Run: `node --test test/safari/content_export_json.test.js`

Expected: FAIL.

**Step 3: Write minimal implementation**

- call staged `roll20-json-core`
- serialize a raw portable JSON string

**Step 4: Run test to verify it passes**

Run: `node --test test/safari/content_export_json.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add ios/Roll20SafariExtension/Resources/js/content.js test/safari/content_export_json.test.js
git commit -m "ios: add safari raw json export builder"
```

---

### Task 11: Add the native inbox path resolver

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/SafariBridge/SafariInboxPaths.swift`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/RunnerTests/SafariInboxPathsTests.swift`

**Step 1: Write the failing iOS test**

Assert:

- App Group container resolves
- `roll20/inbox` exists under the group container

**Step 2: Run test to verify it fails**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: FAIL.

**Step 3: Write minimal implementation**

- return the App Group root
- return inbox directory URL
- create directory lazily

**Step 4: Run test to verify it passes**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: PASS.

**Step 5: Commit**

```bash
git add ios/Runner/SafariBridge/SafariInboxPaths.swift ios/RunnerTests/SafariInboxPathsTests.swift
git commit -m "ios: add standalone inbox path resolver"
```

---

### Task 12: Add the native inbox writer

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/SafariBridge/SafariInboxWriter.swift`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/RunnerTests/SafariInboxWriterTests.swift`

**Step 1: Write the failing iOS test**

Assert:

- atomic temp write
- final `.json` file created
- file contains raw portable JSON
- empty payload rejected

**Step 2: Run test to verify it fails**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: FAIL.

**Step 3: Write minimal implementation**

- write temp file
- move into final file
- do not wrap payload in metadata envelope

**Step 4: Run test to verify it passes**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: PASS.

**Step 5: Commit**

```bash
git add ios/Runner/SafariBridge/SafariInboxWriter.swift ios/RunnerTests/SafariInboxWriterTests.swift
git commit -m "ios: add standalone inbox writer"
```

---

### Task 13: Add storage preflight and budget checks before write

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/SafariBridge/SafariInboxWriter.swift`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/RunnerTests/SafariStorageBudgetTests.swift`

**Step 1: Write the failing iOS test**

Assert:

- payload above max single size is rejected
- low free space is rejected
- pending total above cap is rejected

**Step 2: Run test to verify it fails**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: FAIL.

**Step 3: Write minimal implementation**

Initial limits:

- max single file `8 MB`
- max total pending `64 MB`
- max pending files `20`
- min free space `256 MB`

**Step 4: Run test to verify it passes**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: PASS.

**Step 5: Commit**

```bash
git add ios/Runner/SafariBridge/SafariInboxWriter.swift ios/RunnerTests/SafariStorageBudgetTests.swift
git commit -m "ios: add standalone storage preflight checks"
```

---

### Task 14: Add the native MethodChannel inbox bridge

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/AppDelegate.swift`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/SafariBridge/SafariInboxBridgePlugin.swift`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/RunnerTests/SafariInboxBridgePluginTests.swift`

**Step 1: Write the failing iOS test**

Assert methods:

- list
- read
- delete one
- delete all
- prune

**Step 2: Run test to verify it fails**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: FAIL.

**Step 3: Write minimal implementation**

- add `readinglog/safari_inbox_bridge` equivalent channel for the standalone app
- keep `AppDelegate` thin

**Step 4: Run test to verify it passes**

Run: `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

Expected: PASS.

**Step 5: Commit**

```bash
git add ios/Runner/AppDelegate.swift ios/Runner/SafariBridge/SafariInboxBridgePlugin.swift ios/RunnerTests/SafariInboxBridgePluginTests.swift
git commit -m "ios: add standalone native inbox bridge"
```

---

### Task 15: Add the Dart inbox bridge wrappers

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/sync/safari/safari_inbox_bridge.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/sync/safari/safari_inbox_bridge_io.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/sync/safari/safari_inbox_bridge_stub.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/sync/safari/safari_inbox_bridge_test.dart`

**Step 1: Write the failing Dart test**

Assert typed wrappers for:

- list entries
- read one
- delete one
- delete all

**Step 2: Run test to verify it fails**

Run: `flutter test test/sync/safari/safari_inbox_bridge_test.dart`

Expected: FAIL.

**Step 3: Write minimal implementation**

- expose typed models
- hide `MethodChannel` maps from UI

**Step 4: Run test to verify it passes**

Run: `flutter test test/sync/safari/safari_inbox_bridge_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/sync/safari/safari_inbox_bridge.dart lib/sync/safari/safari_inbox_bridge_io.dart lib/sync/safari/safari_inbox_bridge_stub.dart test/sync/safari/safari_inbox_bridge_test.dart
git commit -m "flutter: add standalone safari inbox bridge wrappers"
```

---

### Task 16: Add a repository for pending exports

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/pending/pending_export_repository.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/pending/pending_export_repository_test.dart`

**Step 1: Write the failing test**

Assert the repository can:

- list pending items
- read details
- delete one
- clear all

**Step 2: Run test to verify it fails**

Run: `flutter test test/pending/pending_export_repository_test.dart`

Expected: FAIL.

**Step 3: Write minimal implementation**

- use the Dart inbox bridge
- keep repository UI-agnostic

**Step 4: Run test to verify it passes**

Run: `flutter test test/pending/pending_export_repository_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/pending/pending_export_repository.dart test/pending/pending_export_repository_test.dart
git commit -m "flutter: add pending export repository"
```

---

### Task 17: Add the standalone local import service

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/import/portable_json_import_service.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/import/portable_json_import_service_test.dart`

**Step 1: Write the failing test**

Assert raw portable JSON can be imported into standalone local storage.

**Step 2: Run test to verify it fails**

Run: `flutter test test/import/portable_json_import_service_test.dart`

Expected: FAIL.

**Step 3: Write minimal implementation**

- validate `.json`
- decode portable JSON
- save into standalone app local storage

**Step 4: Run test to verify it passes**

Run: `flutter test test/import/portable_json_import_service_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/import/portable_json_import_service.dart test/import/portable_json_import_service_test.dart
git commit -m "flutter: add standalone portable json import service"
```

---

### Task 18: Add the second preflight before local import

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/import/pending_import_coordinator.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/import/pending_import_coordinator_test.dart`

**Step 1: Write the failing test**

Assert:

- import from an existing inbox file succeeds without Safari re-parse
- second preflight can block local save
- blocked imports leave inbox file intact
- successful imports delete inbox file after local save

**Step 2: Run test to verify it fails**

Run: `flutter test test/import/pending_import_coordinator_test.dart`

Expected: FAIL.

**Step 3: Write minimal implementation**

- use stricter headroom:
  - `max(256 MB, inboxFileBytes * 2 + 4 MB)`

**Step 4: Run test to verify it passes**

Run: `flutter test test/import/pending_import_coordinator_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/import/pending_import_coordinator.dart test/import/pending_import_coordinator_test.dart
git commit -m "flutter: add standalone pending import coordinator"
```

---

### Task 19: Add the user-facing pending exports section

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/ui/home/pending_exports_section.dart`
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/main.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/ui/home/pending_exports_section_test.dart`

**Step 1: Write the failing widget test**

Assert the section renders:

- pending file list
- import button
- import all button
- delete button
- clear all button

**Step 2: Run test to verify it fails**

Run: `flutter test test/ui/home/pending_exports_section_test.dart`

Expected: FAIL.

**Step 3: Write minimal implementation**

- show user-visible pending items
- no debug gating
- no Safari re-parse required

**Step 4: Run test to verify it passes**

Run: `flutter test test/ui/home/pending_exports_section_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/ui/home/pending_exports_section.dart lib/main.dart test/ui/home/pending_exports_section_test.dart
git commit -m "ui: add standalone pending exports section"
```

---

### Task 20: Wire the popup cleanup actions to the native bridge

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/js/popup.js`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/safari/popup_cleanup_actions.test.js`

**Step 1: Write the failing test**

Assert:

- delete-last asks confirmation
- clear-all asks confirmation
- refresh shows pending count

**Step 2: Run test to verify it fails**

Run: `node --test test/safari/popup_cleanup_actions.test.js`

Expected: FAIL.

**Step 3: Write minimal implementation**

- connect popup buttons to native bridge methods
- show deleted count

**Step 4: Run test to verify it passes**

Run: `node --test test/safari/popup_cleanup_actions.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add ios/Roll20SafariExtension/Resources/js/popup.js test/safari/popup_cleanup_actions.test.js
git commit -m "ios: wire popup cleanup actions"
```

---

### Task 21: Define the standalone-to-ReadingLog handoff contract

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/docs/export_to_readinglog_contract.md`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/docs/import_from_safari_export_contract.md`

**Step 1: Write the contract docs**

Document:

- raw portable JSON file
- filename from scenario title
- no wrapper required
- fallback manual import path

**Step 2: Verify docs are coherent**

Review both docs side-by-side for matching assumptions.

**Step 3: Commit**

```bash
git add /Users/he-su/Documents/GitHub/roll20-safari-export-app/docs/export_to_readinglog_contract.md /Users/he-su/Documents/GitHub/readinglog/front/docs/import_from_safari_export_contract.md
git commit -m "docs: define standalone to readinglog handoff contract"
```

---

### Task 22: Add `Export to ReadingLog` service in the standalone app

**Files:**
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/export/export_to_readinglog_service.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/export/export_to_readinglog_service_test.dart`

**Step 1: Write the failing test**

Assert an already saved standalone export can be passed to a share/export flow.

**Step 2: Run test to verify it fails**

Run: `flutter test test/export/export_to_readinglog_service_test.dart`

Expected: FAIL.

**Step 3: Write minimal implementation**

- use `UIActivityViewController` or Flutter share wrapper
- export the raw JSON file as-is

**Step 4: Run test to verify it passes**

Run: `flutter test test/export/export_to_readinglog_service_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/export/export_to_readinglog_service.dart test/export/export_to_readinglog_service_test.dart
git commit -m "flutter: add export to readinglog service"
```

---

### Task 23: Add the `Export to ReadingLog` button to the standalone UI

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/ui/home/pending_exports_section.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/ui/home/pending_exports_export_button_test.dart`

**Step 1: Write the failing widget test**

Assert the export button appears for saved standalone exports and triggers the export service.

**Step 2: Run test to verify it fails**

Run: `flutter test test/ui/home/pending_exports_export_button_test.dart`

Expected: FAIL.

**Step 3: Write minimal implementation**

- add button per item
- add optional export-all later only if needed

**Step 4: Run test to verify it passes**

Run: `flutter test test/ui/home/pending_exports_export_button_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/ui/home/pending_exports_section.dart test/ui/home/pending_exports_export_button_test.dart
git commit -m "ui: add export to readinglog action"
```

---

### Task 24: Extract ReadingLog reusable JSON import logic

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_import_support.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_json_import_service.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/ui/book/book_json_import_service_test.dart`

**Step 1: Write the failing Flutter test**

Assert a raw portable JSON file can be imported without going through BookScreen UI.

**Step 2: Run test to verify it fails**

Run: `flutter test test/ui/book/book_json_import_service_test.dart`

Expected: FAIL.

**Step 3: Write minimal implementation**

- extract existing import logic out of BookScreen
- preserve duplicate suffix behavior

**Step 4: Run test to verify it passes**

Run: `flutter test test/ui/book/book_json_import_service_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/ui/book/book_screen.dart lib/ui/book/book_import_support.dart lib/ui/book/book_json_import_service.dart test/ui/book/book_json_import_service_test.dart
git commit -m "refactor: extract readinglog json import service"
```

---

### Task 25: Add a ReadingLog external receive service

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/import/external_json_receive_service.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/import/external_json_receive_service_test.dart`

**Step 1: Write the failing Flutter test**

Assert ReadingLog can receive a portable JSON file from outside the app and pass it into `BookJsonImportService`.

**Step 2: Run test to verify it fails**

Run: `flutter test test/import/external_json_receive_service_test.dart`

Expected: FAIL.

**Step 3: Write minimal implementation**

- accept file bytes/path
- call reusable import service
- return typed result

**Step 4: Run test to verify it passes**

Run: `flutter test test/import/external_json_receive_service_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/import/external_json_receive_service.dart test/import/external_json_receive_service_test.dart
git commit -m "flutter: add readinglog external receive service"
```

---

### Task 26: Add ReadingLog UI for externally received pending imports

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/widgets/my_page_external_imports_section.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/my_page_screen.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/ui/mypage/my_page_external_imports_section_test.dart`

**Step 1: Write the failing widget test**

Assert ReadingLog can show externally received files and let the user:

- import
- retry
- delete

**Step 2: Run test to verify it fails**

Run: `flutter test test/ui/mypage/my_page_external_imports_section_test.dart`

Expected: FAIL.

**Step 3: Write minimal implementation**

- user-facing section
- no debug gating

**Step 4: Run test to verify it passes**

Run: `flutter test test/ui/mypage/my_page_external_imports_section_test.dart`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/ui/mypage/widgets/my_page_external_imports_section.dart lib/ui/mypage/my_page_screen.dart test/ui/mypage/my_page_external_imports_section_test.dart
git commit -m "ui: add readinglog external imports section"
```

---

### Task 27: Add end-to-end integration verification notes

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/README.md`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/README.md`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/docs/manual_verification.md`

**Step 1: Document the full manual path**

Cover:

1. Safari export into standalone app
2. retry from pending without Safari re-parse
3. export to ReadingLog
4. ReadingLog import
5. duplicate filename handling

**Step 2: Verify docs are present**

Open and review the docs for consistency.

**Step 3: Commit**

```bash
git add README.md docs/manual_verification.md /Users/he-su/Documents/GitHub/readinglog/front/README.md
git commit -m "docs: add standalone safari to readinglog verification guide"
```

---

### Task 28: Run final verification set before claiming completion

**Files:**
- No code changes required unless fixes are needed

**Step 1: Run standalone app tests**

Run:

- `flutter test`
- `node --test test/safari/*.test.js`
- `flutter build ios --debug`

Expected: PASS.

**Step 2: Run ReadingLog-side tests**

Run:

- `flutter test test/ui/book/book_json_import_service_test.dart`
- `flutter test test/import/external_json_receive_service_test.dart`
- `flutter test test/ui/mypage/my_page_external_imports_section_test.dart`

Expected: PASS.

**Step 3: Run manual device verification checklist**

Verify:

1. export from Safari into standalone app
2. pending file remains if auto import fails
3. retry import works without Safari re-parse
4. export to ReadingLog works
5. ReadingLog imports with correct file naming

**Step 4: Commit any final fixups**

```bash
git add -A
git commit -m "test: finalize standalone safari and readinglog integration"
```

