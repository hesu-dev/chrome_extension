# Safari Inbox iOS Integration and Popup Direct Download Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the staged Safari inbox bridge into the real `readinglog/front` iOS Flutter app, verify the inbox write/import flow, and then align the Chrome popup UX by renaming the avatar-mapping buttons and adding a direct ReadingLog download path that bypasses image-link replacement.

**Architecture:** Keep Safari parsing/export logic in the existing `R20-JSONExporter-safari-app` scaffold and wire its App Group inbox into `readinglog/front` through a new iOS `MethodChannel` plus a Dart bridge/import service consumed from `_SyncLifecycleBridge`. Separately, update the Chrome popup labels and split JSON download into two paths: direct download with original/resolved links, and mapped download that preserves the current avatar editor overrides.

**Tech Stack:** Safari Web Extensions, Swift, Flutter `MethodChannel`, Dart import services, Chrome extension popup JS/HTML, Node test runner, Flutter test, iOS build tooling.

---

### Task 1: Add Safari inbox bridge contracts and tests in `readinglog/front`
### Task 2: Add iOS AppDelegate Safari bridge methods and App Group file readers
### Task 3: Add Dart Safari bridge/import service and lifecycle consumer
### Task 4: Verify Flutter tests and iOS build for the new Safari import path
### Task 5: Verify Safari staged source still passes tests and deploy after iOS bridge hookup
### Task 6: Rename Chrome popup buttons and add a direct ReadingLog download button
### Task 7: Split Chrome JSON download into direct-download and mapped-download paths with tests
### Task 8: Re-run Chrome tests/build/deploy and summarize residual device-only checks
