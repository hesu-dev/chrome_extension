# ReadingLog Front Safari Import and Direct Download Hardening Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Safari inbox import flow in `readinglog/front` and the Chrome direct-download split without introducing duplicate imports, schema regressions, quota leaks, or oversized controller files.

**Architecture:** Keep Safari export generation in the standalone Safari scaffold, but harden the handoff by using `roll20/inbox -> roll20/pending` claim semantics inside `readinglog/front`. Reuse the existing ReadingLog JSON import/save path by extracting a service from `book_screen.dart`. For Chrome, split the new direct-download path from the existing avatar-mapped path so `popup.js` and `content.js` do not absorb more branching than necessary.

**Tech Stack:** Flutter, Dart, Swift, Safari Web Extensions, App Groups, `MethodChannel`, Chrome extension popup/content scripts, Node test runner, Flutter test, Xcode build tooling.

---

### Task 1: Promote the UX design into executable constraints

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/docs/plans/2026-03-11-readinglog-front-safari-import-ux-design.md`

**Steps:**
1. Confirm the design document includes:
   - `inbox -> pending` claim flow
   - second storage preflight
   - aggregate `MyPage` status
   - no auto-open after import
   - schema compatibility rule for avatar URLs
2. Treat this document as the acceptance baseline for implementation.

### Task 2: Make the Safari scaffold compile-verifiable before device testing

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app/ios/Shared/SafariInboxPaths.swift`
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app/ios/Shared/SafariInboxWriter.swift`
- Create or modify: actual iOS project files once the standalone Safari app gets a real Xcode target

**Steps:**
1. Fix Swift API usage issues before any device claim.
2. Add an explicit compile step:
   - `xcodebuild` for the standalone Safari app shell
3. Do not mark App Group inbox write as verified until Swift compiles.

### Task 3: Harden Safari inbox counting against orphan temp files

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app/ios/Shared/SafariInboxPaths.swift`
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter-safari-app/ios/Shared/SafariInboxWriter.swift`
- Test: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/tests/safari_inbox_writer_contract.test.js`

**Steps:**
1. Count only `.json` exports as pending inbox files.
2. Keep temp files outside the counted inbox set or ignore them explicitly.
3. Add a test that leaves a fake `.tmp` file next to real exports and verifies pending counts stay correct.

### Task 4: Add `readinglog/front` Safari bridge contract and path resolver

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_bridge_contract.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_bridge_io.dart`
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_bridge_stub.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/ios/Runner/AppDelegate.swift`
- Test: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_bridge_contract_test.dart`

**Steps:**
1. Add a dedicated MethodChannel for Safari inbox paths.
2. Reuse the existing App Group `group.com.reha.readinglog.sync`.
3. Return both `roll20/inbox` and `roll20/pending` paths.
4. Keep `AppDelegate` limited to path resolution and directory creation.

### Task 5: Extract ReadingLog JSON import into a reusable service

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_project_import_service.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_screen.dart`
- Reuse: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/book/book_import_support.dart`
- Test: `/Users/he-su/Documents/GitHub/readinglog/front/test/ui/book/book_project_import_service_test.dart`

**Steps:**
1. Move `_registerImportedJson(...)` logic out of `book_screen.dart`.
2. Keep file-name resolution, validation, and `saveProjectLines(...)` behavior unchanged.
3. Reuse existing toast/error helpers rather than inventing a second import path.

### Task 6: Implement claim-based Safari import service with mutex

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/sync/safari/safari_pending_import_service.dart`
- Test: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_pending_import_service_test.dart`

**Steps:**
1. Read candidate files from `roll20/inbox`.
2. Atomically claim one file into `roll20/pending`.
3. Run second storage preflight before local save.
4. Call the extracted book import service.
5. Delete the claimed pending file only on success.
6. Keep the claimed file in `pending` on failure.
7. Guard the whole flow with a service-level mutex so startup/resume cannot double-import.

### Task 7: Add aggregate Safari import state to `MyPage`

**Files:**
- Create: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/widgets/my_page_safari_import_section.dart`
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/ui/mypage/my_page_screen.dart`
- Test: `/Users/he-su/Documents/GitHub/readinglog/front/test/ui/mypage/my_page_safari_import_section_test.dart`

**Steps:**
1. Render `Safari에서 가져오기` under `동기화 상태`.
2. Show aggregate counts from both `inbox` and `pending`.
3. Provide:
   - `Open Roll20`
   - `Safari 확장 켜는 방법`
   - `보류 중 가져오기 다시 시도`
   - `보류 파일 비우기`
4. Do not add a per-file browser in V1.

### Task 8: Hook startup/resume into the Safari import service

**Files:**
- Modify: `/Users/he-su/Documents/GitHub/readinglog/front/lib/main.dart`
- Test: `/Users/he-su/Documents/GitHub/readinglog/front/test/sync/safari/safari_lifecycle_consumer_test.dart`

**Steps:**
1. Keep widget-open consumption behavior intact.
2. Add Safari import consumption as a second flow.
3. Do not inline file IO inside `_SyncLifecycleBridge`.
4. Ensure duplicate `resumed` events cannot start overlapping imports.

### Task 9: Add explicit schema-compatibility coverage for direct download

**Files:**
- Create: `/Users/he-su/Desktop/chrome_extension/R20-JSONExporter/tests/direct_download_schema_contract.test.js`
- Reuse: `/Users/he-su/Desktop/chrome_extension/roll20-json-core/src/chat_json_export.js`
- Reuse: `/Users/he-su/Documents/GitHub/readinglog/front/lib/model/parsed_line.dart`

**Steps:**
1. Keep `input.speakerImages.avatar.url` as the single effective avatar URL.
2. If original and redirected URLs are both exported, store them under a separate optional metadata object.
3. Add a compatibility test that confirms ReadingLog still imports the generated JSON without schema changes.

### Task 10: Split Chrome direct-download and mapped-download controllers

**Files:**
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/js/popup/avatar_download_controller.js`
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/js/content/export/direct_readinglog_download.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/js/popup/popup.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/js/content/core/content.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/popup.html`

**Steps:**
1. Rename:
   - `프로필 이미지 교체` -> `다운로드전 이미지 링크 확인`
   - `Reading용 다운로드(.json)` -> `ReadingLog 파일 다운로드`
2. Add a new direct-download button under the image-link check button.
3. Keep mapped-download behavior intact when the editor has user overrides.
4. Allow direct download without opening the editor first.
5. Do not expand `popup.js` with another large inline branch; move shared logic into the new controller module.

### Task 11: Add tests for direct-download vs mapped-download behavior

**Files:**
- Create: `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/tests/avatar_download_controller.test.js`
- Modify: existing popup/content tests under `/Users/he-su/Desktop/chrome_extension/.worktrees/codex-safari-release/R20-JSONExporter/tests/`

**Steps:**
1. Cover direct download with no editor state.
2. Cover mapped download with edited avatar URLs.
3. Cover schema compatibility for exported JSON.
4. Cover UI label changes.

### Task 12: Verify on real toolchains before completion

**Files:**
- No new files required

**Steps:**
1. Run ReadingLog Flutter tests.
2. Run Chrome extension Node tests.
3. Run `npm run build` and `./deploy.sh` for the extension repo.
4. Run iOS compile/build for the standalone Safari app shell.
5. Run the ReadingLog iOS build.
6. Perform one real end-to-end manual check:
   - Safari export writes into App Group storage
   - ReadingLog startup/resume imports it
   - imported project appears in the library
   - no auto-open
   - claimed pending file is deleted on success
