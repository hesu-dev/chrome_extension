# ReadingLog Front Safari Import UX Design

**Goal:** Define exactly how Safari-exported Roll20 JSON appears and behaves inside `readinglog/front` before implementation starts.

**Scope:** `readinglog/front` only. This document covers UI placement, startup/resume behavior, retry/delete behavior, and the boundary between Safari export and ReadingLog import.

## Final Decisions

- The user-facing entry point lives in `MyPage`.
- The section name is `Safari에서 가져오기`.
- Successful import adds the project to the library only.
- The app does not auto-open the imported project.
- Startup/resume should automatically consume pending Safari inbox files.
- Failed imports must remain in inbox so the user can retry without re-parsing in Safari.

## UI Placement

Place the new section in `MyPage`, below `동기화 상태`.

The section contains:

- A short note that Roll20 extraction works in Safari.
- An `Open Roll20` button.
- A `Safari 확장 켜는 방법` button or help entry.
- A status row showing pending Safari inbox file count.
- A `보류 중 가져오기 다시 시도` button.
- A `보류 파일 비우기` button.

The first version should not include a per-file list. Keep it aggregate only:

- pending count
- last import result
- last error message if any

## Import Lifecycle

### Safari side

- Safari extension parses the current Roll20 DOM.
- Safari writes raw ReadingLog-compatible JSON into the shared App Group inbox.
- Safari does not delete inbox files after write success.
- Safari tells the user to return to ReadingLog.

### ReadingLog side

- On app startup, ReadingLog checks the Safari inbox.
- On app resume, ReadingLog checks the Safari inbox again.
- Before import, ReadingLog runs a second storage preflight.
- ReadingLog must not import directly from inbox in place.
- ReadingLog first claims a file by atomically moving it from `roll20/inbox` to `roll20/pending`.
- If import succeeds:
  - save to the normal ReadingLog local project storage
  - refresh the library state
  - delete the claimed pending file immediately
- If import fails:
  - keep the claimed pending file
  - surface the failure in the `Safari에서 가져오기` section
  - allow retry without requiring Safari re-export

## Concurrency Rules

- Startup and resume may fire close together, so import needs a dedicated Safari import mutex.
- The mutex lives in the Safari import service, not in UI code.
- Claiming a file into `roll20/pending` is the second protection against duplicate import.
- `MyPage` aggregate counts should include:
  - fresh files in `roll20/inbox`
  - retryable files in `roll20/pending`

## Storage Rules

- Safari write preflight remains the first guard.
- ReadingLog import runs a second preflight before local storage write.
- Inbox counting must include only `.json` export files.
- Temporary files must not live inside the counted inbox set.
- Orphan temp files must be ignored or cleaned before quota calculation.

## JSON Compatibility Rules

- The existing ReadingLog import schema remains the compatibility baseline.
- `input.speakerImages.avatar.url` stays as a single effective URL.
- If both original and redirected image links must be preserved, add them as optional extra metadata.
- The extra metadata must not replace or reshape existing `speakerImages` fields.
- ReadingLog V1 import ignores the extra metadata and continues to use the effective avatar URL only.

## Verification Rules

- JS tests alone are not enough for the Safari bridge.
- App Group inbox write is considered verified only after:
  - an actual Xcode target compiles
  - the Safari extension and host app install together
  - a real inbox file is written on device or simulator
  - ReadingLog successfully imports that file and deletes it on success

## Implementation Boundaries

- `ios/Runner/AppDelegate.swift`
  - expose a new Safari bridge `MethodChannel`
  - resolve the existing App Group `group.com.reha.readinglog.sync`
  - return shared container paths to Flutter
  - do not move import business logic into `AppDelegate`

- `lib/main.dart`
  - extend `_SyncLifecycleBridge`
  - consume pending Safari inbox files on startup/resume

- `lib/ui/book`
  - extract the existing import/save logic from `book_screen.dart` into a reusable import service
  - reuse the same validation and save path for Safari-delivered JSON

- `lib/ui/mypage`
  - render the new `Safari에서 가져오기` section
  - show aggregate pending/import state
  - expose retry/clear actions

- Chrome popup
  - avoid adding the new direct-download flow inline into the existing avatar editor block
  - keep direct download and mapped download in a dedicated helper/controller split

## Explicit Non-Goals For V1

- No automatic opening of imported projects
- No per-file inbox browser
- No WebView-based Roll20 flow
- No ReadingLog write-back to Safari

## Acceptance Criteria

- A Safari-exported JSON file placed in the shared inbox is detected by ReadingLog on startup/resume.
- A valid inbox file is imported into the normal ReadingLog library.
- The imported project appears in the library but does not auto-open.
- The claimed pending file is deleted only after successful import.
- A failed import leaves the pending file intact and retryable from `MyPage`.
- Startup and resume do not double-import the same file.
- Temporary files do not inflate pending counts or block quota.
- Optional original/redirected URL metadata does not break existing ReadingLog import.
