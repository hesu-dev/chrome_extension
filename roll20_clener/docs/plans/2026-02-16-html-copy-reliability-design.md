# HTML Copy Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 버튼 클릭 시 전체 HTML(필터 적용/보이는 요소 기준)을 안정적으로 생성하고 클립보드에 복사되도록 하며, 실패 원인을 사용자에게 명확히 안내한다.

**Architecture:** 기존 `content.js`의 HTML 빌드 파이프라인을 재사용하고, 복사 책임은 DOM 접근 권한이 있는 콘텐츠 스크립트 측에서 수행한다. 팝업은 메시지 요청/상태 표시 전담으로 유지해 결합도를 낮춘다. 에러는 코드/메시지로 정규화해 `오류 코드: 5` 같은 모호한 실패를 디버깅 가능한 형태로 바꾼다.

**Tech Stack:** Chrome Extension MV3, vanilla JavaScript, existing content/popup modules

---

### Task 1: 복사 기능을 위한 최소 API 경계 정의

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`
- Modify: `content.js`

**Step 1: 복사 버튼 UI 추가 (다운로드 버튼과 분리)**
- `popup.html`에 `copyBundlePage` 버튼 추가
- 사용자 흐름: 복사 버튼은 다운로드와 동일한 데이터 파이프라인을 사용하되 최종 출력만 클립보드

**Step 2: 팝업 메시지 타입 추가**
- `popup.js`에 `COPY_BUNDLED_HTML_DIRECT` 요청 경로 추가
- 상태 메시지: 준비 중, 복사 성공, 복사 실패(원인 포함)

**Step 3: 콘텐츠 스크립트 메시지 핸들러 확장**
- `content.js`에 `COPY_BUNDLED_HTML_DIRECT` 처리 분기 추가
- 기존 `buildVisibleHtmlWithoutHeadAssets` 재사용

### Task 2: 클립보드 복사 로직을 재사용 가능한 유틸로 분리

**Files:**
- Modify: `dom_processor.js`
- Modify: `content.js`

**Step 1: 실패 가능한 복사 경로를 함수로 분리**
- `dom_processor.js`에 `copyTextToClipboard(text)` 추가
- 우선순위: `navigator.clipboard.writeText` → 실패 시 `textarea + document.execCommand('copy')`

**Step 2: 콘텐츠 스크립트에서 유틸 재사용**
- `content.js`에서 `downloadHtmlInPage`처럼 `copyTextToClipboard`를 꺼내 사용
- 성공/실패를 `sendResponse({ ok, errorCode, errorMessage })`로 표준화

### Task 3: 오류 코드 정규화와 사용자 메시지 개선

**Files:**
- Modify: `popup.js`

**Step 1: 런타임 에러 코드 파서 추가**
- `chrome.runtime.lastError` 메시지에서 코드/핵심 원인을 추출
- `Could not establish connection...` 계열을 안내 문구로 매핑

**Step 2: 제한 페이지 가드 추가**
- 활성 탭 URL이 `chrome://`, `edge://`, `about:`, `chrome-extension://`면 즉시 사용자 안내

**Step 3: 상태 표시 일관성 유지**
- 복사/다운로드 모두 동일한 예외 경로 처리
- 팝업 콘솔에 원본 에러 로깅, UI에는 정제 메시지 표시

### Task 4: 함수/파일 크기와 중복 점검 및 정리

**Files:**
- Modify: `popup.js`
- Modify: `content.js`

**Step 1: 중복 코드 최소화**
- 복사/다운로드 공통 처리(탭 확인, 요청, 응답 검사)를 작은 헬퍼 함수로 분리

**Step 2: 과도한 분할 방지(YAGNI)**
- 대규모 파일 분할은 이번 변경 범위에서 보류
- 대신 새 기능은 기존 모듈 경계를 따르며 함수 단위 분리만 적용

### Task 5: 검증 및 리스크 리뷰

**Files:**
- Modify: `docs/plans/2026-02-16-html-copy-reliability-design.md` (검증 기록 append)

**Step 1: 수동 검증 시나리오 실행**
- Roll20 탭에서 복사 성공 여부
- 비대상 탭(예: `chrome://extensions`)에서 안내 메시지 확인
- 다운로드 기능 회귀 여부 확인

**Step 2: 잠재 이슈 점검**
- 보안: 클립보드 접근이 사용자 제스처 내부에서만 수행되는지 확인
- 사이드이펙트: 필터/아바타 기능에 영향 없는지 확인

**Step 3: 불필요 코드 정리**
- 신규 헬퍼 도입으로 대체된 중복 분기 제거
- 미사용 변수/함수 정리
