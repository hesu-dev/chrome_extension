# Standalone Safari Export App and ReadingLog Integration Plan

> Execution roots:
>
> - Standalone Safari export app repo (proposed): `/Users/he-su/Documents/GitHub/roll20-safari-export-app`
> - ReadingLog repo (existing): `/Users/he-su/Documents/GitHub/readinglog/front`
>
> This plan supersedes the earlier direct-to-ReadingLog iOS bridge as the primary implementation direction.

## Goal

Build a standalone iOS app with a Safari Web Extension that can export Roll20 chat into a self-contained app first, then later hand that saved export off to ReadingLog through an explicit export/import path.

## Revised architecture

- Phase 1: Build a separate Safari-capable Flutter iOS app first.
- Phase 2: Make that app stable on its own:
  - Safari extension parses Roll20
  - standalone app receives the export
  - user can retry failed imports from the standalone app
  - user can manage pending exports without ReadingLog
- Phase 3: After ReadingLog import logic is ready, add an explicit `Export to ReadingLog` flow from the standalone app.
- Phase 4: Add the ReadingLog-side receive/import logic.

## Key decisions

- Do not couple first implementation to ReadingLog's App Group.
- Do not require Safari re-parse when a saved export already exists.
- Do not use WebView.
- Preserve the current web filename rule:
  - Roll20 campaign name from href
  - `document.title`
  - `roll20-chat`
- Keep the exported file itself as raw ReadingLog-compatible portable JSON.
- Use app-owned pending storage first, then later app-to-app export into ReadingLog.

## Product split

### Standalone Safari export app

Responsibilities:

- host the Safari extension
- receive raw Roll20 JSON into its own App Group inbox
- show export progress
- keep a user-visible pending exports list
- allow retry import into its own local app storage
- allow delete / clear / retry without going back to Safari
- later provide `Export to ReadingLog`

### ReadingLog

Responsibilities:

- provide a reusable JSON import service
- later receive exported JSON from the standalone app
- import into ReadingLog project storage
- keep ReadingLog naming and duplicate suffix rules

---

## Phase 1: Standalone Safari export app

### Task 1: Create the standalone Flutter app shell

**Files**

- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/pubspec.yaml`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/main.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/Info.plist`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/widget_smoke_test.dart`

**Goal**

Bootstrap a separate Flutter app that is not ReadingLog.

**Requirements**

- app title should clearly indicate it is a Roll20 export companion
- no ReadingLog dependency in Phase 1
- basic navigation shell only

**Verification**

- `flutter test test/widget_smoke_test.dart`
- `flutter build ios --debug`

**Commit**

- `chore: create standalone safari export app shell`

---

### Task 2: Define a dedicated App Group and bridge contract for the standalone app

**Files**

- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/docs/safari_bridge_contract.md`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/sync/safari/safari_bridge_contract.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/sync/safari/safari_bridge_contract_test.dart`

**Contract**

- App Group example: `group.com.reha.roll20safariexport`
- Inbox path: `roll20/inbox`
- Local pending path: `roll20/pending`
- export file type: raw portable JSON
- file name rule: same as web
- progress stages:
  - `measuring_dom`
  - `estimating_payload`
  - `building_json`
  - `checking_storage`
  - `writing_inbox`
  - `done`

**Verification**

- `flutter test test/sync/safari/safari_bridge_contract_test.dart`

**Commit**

- `docs: define standalone safari bridge contract`

---

### Task 3: Add the iOS Safari extension target to the standalone app

**Files**

- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Info.plist`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/SafariWebExtensionHandler.swift`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/manifest.json`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/popup.html`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/js/popup.js`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/js/content.js`

**Requirements**

- no WebView
- Roll20 host permissions only
- same DOM scope as web extension: currently loaded full DOM

**Verification**

- `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

**Commit**

- `ios: add safari extension target to standalone app`

---

### Task 4: Stage shared Roll20 parser assets into the standalone app

**Files**

- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/tool/sync_roll20_safari_assets.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/tool/sync_roll20_safari_assets_test.dart`

**Requirements**

- pull from sibling `roll20-json-core`
- output browser bundle into Safari extension resources
- no manual parser copy-paste

**Verification**

- `flutter test test/tool/sync_roll20_safari_assets_test.dart`
- `dart run tool/sync_roll20_safari_assets.dart`

**Commit**

- `build: add standalone safari asset sync`

---

### Task 5: Implement Safari popup progress UX

**Files**

- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/popup.html`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/popup.css`
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/js/popup.js`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Roll20SafariExtension/Resources/js/export_progress_model.js`

**User-visible UX**

- session title
- DOM/message count
- estimated JSON size
- storage preflight status
- final resolved file name
- success/failure message

**Additional user actions**

- `Delete last pending export`
- `Clear all pending exports`
- `Refresh pending inbox status`

**Verification**

- popup unit tests if possible
- manual iPhone/iPad Safari run

**Commit**

- `ios: add safari popup export progress and cleanup actions`

---

### Task 6: Write raw JSON into the standalone app inbox

**Files**

- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/SafariBridge/SafariInboxWriter.swift`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/SafariBridge/SafariInboxPaths.swift`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/RunnerTests/SafariInboxWriterTests.swift`

**Behavior**

- save raw portable JSON only
- atomic write via temp file
- no wrapper envelope
- preserve title-derived filename

**Verification**

- `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

**Commit**

- `ios: add standalone inbox writer`

---

### Task 7: Add native bridge methods for pending file management

**Files**

- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/AppDelegate.swift`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/SafariBridge/SafariInboxBridgePlugin.swift`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/RunnerTests/SafariInboxBridgePluginTests.swift`

**Methods**

- `listPendingRoll20InboxFiles`
- `readPendingRoll20InboxFile`
- `deletePendingRoll20InboxFile`
- `deleteAllPendingRoll20InboxFiles`
- `prunePendingRoll20InboxFiles`

**Verification**

- `xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -destination 'platform=iOS Simulator,name=iPhone 16' test`

**Commit**

- `ios: add pending inbox native bridge`

---

### Task 8: Add Dart bridge wrappers and standalone pending storage UI

**Files**

- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/sync/safari/safari_inbox_bridge.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/sync/safari/safari_inbox_bridge_io.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/ui/home/pending_exports_section.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/ui/home/pending_exports_section_test.dart`

**User actions**

- view pending files
- import into standalone app local storage
- retry failed pending file
- delete one
- clear all

**Verification**

- `flutter test test/ui/home/pending_exports_section_test.dart`

**Commit**

- `flutter: add standalone pending exports section`

---

### Task 9: Add standalone local import and second preflight

**Files**

- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/import/portable_json_import_service.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/import/pending_import_coordinator.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/import/pending_import_coordinator_test.dart`

**Behavior**

- import from existing inbox file without re-running Safari export
- second storage preflight before local save
- keep inbox original if local import fails
- delete inbox original only after successful local save

**Verification**

- `flutter test test/import/pending_import_coordinator_test.dart`

**Commit**

- `flutter: add standalone local import coordinator`

---

### Task 10: Add storage budget and measurement logging

**Files**

- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/sync/safari/safari_bridge_contract.dart`
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/ios/Runner/SafariBridge/SafariInboxWriter.swift`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/import/storage_budget_test.dart`

**Initial guardrails**

- max single inbox file: `8 MB`
- max pending total: `64 MB`
- max pending files: `20`
- min free space before write: `256 MB`
- second import preflight: `max(256 MB, inboxFileBytes * 2 + 4 MB)`

**Measurements to capture**

- resolved title
- DOM node count estimate
- message count
- final JSON bytes

**Verification**

- `flutter test test/import/storage_budget_test.dart`

**Commit**

- `ios: add standalone storage guardrails`

---

## Phase 2: Export from standalone app to ReadingLog

### Task 11: Define the app-to-app handoff contract

**Files**

- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/docs/export_to_readinglog_contract.md`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/docs/import_from_safari_export_contract.md`

**Handoff format**

- raw portable JSON file
- file name derived from scenario title
- optional metadata for UI only, not required for payload validity

**Recommended delivery mechanism**

- `UIActivityViewController` share/export from the standalone app

**Fallback**

- save to Files, then import manually in ReadingLog

**Commit**

- `docs: define standalone-to-readinglog handoff`

---

### Task 12: Add `Export to ReadingLog` action in the standalone app

**Files**

- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/export/export_to_readinglog_service.dart`
- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/lib/ui/home/pending_exports_section.dart`
- Create: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/test/export/export_to_readinglog_service_test.dart`

**Behavior**

- user picks an already saved standalone export
- app launches export/share flow
- user can target ReadingLog once ReadingLog import support exists

**Verification**

- `flutter test test/export/export_to_readinglog_service_test.dart`

**Commit**

- `flutter: add export to readinglog action`

---

## Phase 3: ReadingLog-side import logic

### Task 13: Extract reusable ReadingLog JSON import logic

**Files**

- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_import_support.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_json_import_service.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/ui/book/book_json_import_service_test.dart`

**Purpose**

Make ReadingLog able to import a raw portable JSON file from outside the app without duplicating UI code.

**Verification**

- `flutter test test/ui/book/book_json_import_service_test.dart`

**Commit**

- `refactor: extract readinglog json import service`

---

### Task 14: Add ReadingLog receive/import entrypoint

**Files**

- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/import/external_json_receive_service.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/main.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/import/external_json_receive_service_test.dart`

**Behavior**

- receive a portable JSON file from an external export flow
- validate format
- import into ReadingLog local project storage
- apply normal duplicate suffix naming

**Verification**

- `flutter test test/import/external_json_receive_service_test.dart`

**Commit**

- `flutter: add readinglog external json receive entrypoint`

---

### Task 15: Add ReadingLog UI for externally received pending imports

**Files**

- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/widgets/my_page_external_imports_section.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/my_page_screen.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/test/ui/mypage/my_page_external_imports_section_test.dart`

**Behavior**

- show external files waiting for import if needed
- allow import / retry / delete

**Verification**

- `flutter test test/ui/mypage/my_page_external_imports_section_test.dart`

**Commit**

- `ui: add readinglog external imports section`

---

## Phase 4: Integration and release

### Task 16: End-to-end integration between standalone app and ReadingLog

**Checklist**

1. Export from Roll20 in Safari into the standalone app.
2. Confirm the standalone app can retry import from inbox without Safari re-parse.
3. Trigger `Export to ReadingLog`.
4. Confirm ReadingLog receives the JSON.
5. Confirm ReadingLog imports the project.
6. Confirm filename matches scenario title with duplicate suffix behavior.

**Commit**

- `test: verify standalone-to-readinglog integration`

---

### Task 17: Release documentation

**Files**

- Modify: `/Users/he-su/Documents/GitHub/roll20-safari-export-app/README.md`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/README.md`

**Docs should explain**

- standalone app first-run setup
- Safari extension enable flow
- how pending exports work
- how retry import works
- how `Export to ReadingLog` works
- fallback manual import path

**Commit**

- `docs: document standalone safari export and readinglog integration`

---

## Execution order

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

## Notes

- The standalone app owns Safari-first UX.
- ReadingLog remains a consumer/import target until its own direct embedding logic is intentionally added later.
- If you later decide to merge the standalone Safari logic into ReadingLog, do it after Task 13-15 stabilize. Do not couple the first implementation prematurely.
