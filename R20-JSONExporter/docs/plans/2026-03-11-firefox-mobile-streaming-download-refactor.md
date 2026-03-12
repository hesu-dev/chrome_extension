# Firefox Mobile Streaming Download Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Firefox Android 대용량 JSON 다운로드를 전체 문자열 생성 방식에서 줄/청크 스트리밍 방식으로 바꾸고, 진행률을 준비 단계 1~50 / 스트리밍 완료율 50~100 구조로 재정의한다.

**Architecture:** 공유 경로는 기존 full-build JSON 경로를 유지하고, 다운로드 경로만 content script가 메시지를 두 번 순회해 background로 청크를 직접 전송한다. popup은 진행률 표시와 오류 노출만 담당하고, background는 세션별 청크를 합쳐 저장 요청만 수행한다.

**Tech Stack:** Firefox Android WebExtension, content script, background downloads API, popup UI, Node test runner

---

### Task 1: 새 진행률 계약을 테스트로 고정

**Files:**
- Modify: `R20-JSONExporter-firefox-mobile/tests/content_export.test.js`
- Modify: `R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`

**Step 1: Write the failing test**
- `buildFirefoxExportPayload()` progress 기대값을 10/20/30/40/50 구조로 갱신한다.
- direct download handler가 full JSON 반환 대신 `START -> CHUNK+ -> FINISH`를 보내고, 진행률이 50~99로 올라가는지를 검증한다.

**Step 2: Run test to verify it fails**

Run: `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`
Expected: FAIL because current content script still references removed streaming helper and old progress percentages.

**Step 3: Commit**

```bash
git add R20-JSONExporter-firefox-mobile/tests/content_export.test.js R20-JSONExporter-firefox-mobile/tests/export_flow.test.js
git commit -m "test: define firefox mobile streaming progress contract"
```

### Task 2: content script 다운로드 경로를 진짜 스트리밍으로 변경

**Files:**
- Modify: `R20-JSONExporter-firefox-mobile/js/content/core/content.js`
- Test: `R20-JSONExporter-firefox-mobile/tests/content_export.test.js`

**Step 1: Write minimal implementation**
- 메시지 분석 1회차에서 `lineCount`와 `ruleType`을 계산한다.
- background 세션을 시작하고 JSON prefix를 전송한다.
- 메시지 2회차에서 entry를 한 줄씩 만들고 chunk buffer를 일정 크기마다 전송한다.
- 진행률은 준비 단계 1~50, 스트리밍 단계 50~99로 계산한다.
- 공유 경로는 full-build JSON을 유지한다.

**Step 2: Run test to verify it passes**

Run: `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js`
Expected: PASS

**Step 3: Commit**

```bash
git add R20-JSONExporter-firefox-mobile/js/content/core/content.js R20-JSONExporter-firefox-mobile/tests/content_export.test.js
git commit -m "feat: stream firefox mobile downloads from content"
```

### Task 3: popup 진행률과 상태 문구를 새 구조에 맞게 정리

**Files:**
- Modify: `R20-JSONExporter-firefox-mobile/js/popup/popup.js`
- Modify: `R20-JSONExporter-firefox-mobile/popup.html`
- Test: `R20-JSONExporter-firefox-mobile/tests/export_flow.test.js`
- Test: `R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js`

**Step 1: Write minimal implementation**
- popup 초기 진행률을 1~50 체계로 맞춘다.
- 50 이상은 content가 보낸 스트리밍 완료율을 그대로 노출한다.
- 100% 문구는 저장 완료가 아니라 저장 요청 완료라는 현재 정책을 유지한다.

**Step 2: Run test to verify it passes**

Run: `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js`
Expected: PASS

**Step 3: Commit**

```bash
git add R20-JSONExporter-firefox-mobile/js/popup/popup.js R20-JSONExporter-firefox-mobile/popup.html R20-JSONExporter-firefox-mobile/tests/export_flow.test.js R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js
git commit -m "feat: align firefox mobile progress UI with streaming export"
```

### Task 4: background 저장 계약 유지 검증 및 릴리스 검증

**Files:**
- Modify: `R20-JSONExporter-firefox-mobile/tests/background_download.test.js`

**Step 1: Run full verification**

Run:
- `node --check /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/content/core/content.js`
- `node --check /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/js/popup/popup.js`
- `node --test /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/background_download.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/content_export.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/export_flow.test.js /Users/he-su/Desktop/chrome_extension/R20-JSONExporter-firefox-mobile/tests/popup_contract.test.js`
- `./deploy.sh`

Expected: PASS and `release/firefox-mobile` refreshed.

**Step 2: Commit**

```bash
git add R20-JSONExporter-firefox-mobile/tests/background_download.test.js
git commit -m "test: verify firefox mobile streaming download release path"
```
