# Large HTML Stall Mitigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 대용량 HTML에서도 다운로드/복사가 멈추지 않도록 메인 스레드 블로킹과 과도한 스타일 직렬화 비용을 줄인다.

**Architecture:** 현재 병목은 `processVisibleNodes`의 전 노드 동기 순회와 `copyComputedStyle`의 full computed property 덤프다. 이를 (1) 스타일 복사 전략 경량화, (2) 비동기 청크 처리, (3) 출력 크기 가드 및 사용자 플로우 분기로 해결한다. 기존 파이프라인(`buildVisibleHtmlWithoutHeadAssets`)은 유지하고 내부 구현만 단계적으로 치환한다.

**Tech Stack:** Chrome Extension MV3, vanilla JavaScript, existing content/dom/style modules

---

### Task 1: 병목 계측 추가 (원인 확증)

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20_clener/content.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20_clener/dom_processor.js`

**Step 1: 단계별 시간 측정 추가**
- `clone`, `processVisibleNodes`, `absolutizeResourceUrls`, `serialize` 각각 `performance.now()`로 측정

**Step 2: 노드 수/직렬화 크기 측정 추가**
- 처리 노드 수 카운터, 최종 HTML byte length 기록

**Step 3: 팝업에 진단 상태 노출(개발 모드)**
- 진행률 메시지에 `DOM n개 처리`, `xxMB 생성` 표시

### Task 2: 스타일 복사 비용 절감 (핵심)

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20_clener/style_processor.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20_clener/dom_processor.js`

**Step 1: 기본값/불필요 속성 제외 allowlist 모드 도입**
- 현행 `for (const prop of computed)` 전량 복사를 중지
- 텍스트/레이아웃 핵심 속성만 복사하는 경량 allowlist 사용

**Step 2: 큰 비용 속성 조건부 제외**
- `background-image`, `box-shadow`, `filter`, `animation*`, `transition*`는 필요시에만 복사

**Step 3: fallback 옵션 유지**
- 설정으로 "고품질(느림)" 모드에서만 full-copy 허용

### Task 3: 순회 로직 청크화로 UI 정지 방지

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20_clener/dom_processor.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20_clener/content.js`

**Step 1: 재귀 순회를 iterative + batched async로 변경**
- N개 노드 처리마다 `await new Promise(requestAnimationFrame)` 또는 `setTimeout(0)`으로 yielding

**Step 2: 진행률 콜백 연결**
- 콘텐츠 스크립트에서 `BUNDLE_PROGRESS`에 실제 처리 진척 반영

**Step 3: 취소 토큰 도입(선택)**
- 팝업 닫힘/재시도 시 이전 작업 취소

### Task 4: 출력 크기 기반 사용자 흐름 분리

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20_clener/content.js`
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20_clener/popup.js`

**Step 1: 클립보드 최대 크기 가드**
- HTML이 임계치(예: 8MB) 초과 시 복사 대신 다운로드 권장 메시지 반환

**Step 2: 다운로드 안전장치**
- 매우 큰 문서에서 단계별 상태 메시지 제공, 타임아웃 완화

**Step 3: 실패 메시지 구체화**
- `errorCode`를 성능/메모리/권한으로 구분

### Task 5: 검증 및 회귀 점검

**Files:**
- Modify: `/Users/he-su/Desktop/chrome_extension/roll20_clener/docs/plans/2026-02-16-large-html-stall-mitigation-plan.md` (결과 append)

**Step 1: 소형/중형/대형 페이지 3구간 테스트**
- 성공률, 평균 처리시간, 최대 메모리(관찰치) 기록

**Step 2: 기존 기능 회귀 확인**
- 필터 적용, 아바타 치환 다운로드, 일반 다운로드

**Step 3: 부작용/품질 리뷰**
- 스타일 누락 허용범위 확인, 심각한 렌더링 깨짐 여부 점검
