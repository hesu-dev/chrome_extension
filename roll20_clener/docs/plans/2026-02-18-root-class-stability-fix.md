# Roll20 Root Class Stability Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 대형 채팅 아카이브/SPA DOM 변경 상황에서도 `사담 감춤` 토글 상태가 일관되게 유지되도록 루트 클래스 적용 신뢰성을 높인다.

**Architecture:** `content.js` 내 루트 클래스 적용 책임을 전용 헬퍼로 분리하고, `MutationObserver`가 루트 class 변경을 감지해 원하는 상태를 재동기화하도록 만든다. 필터 적용 로직은 그대로 재사용해 기존 기능 회귀를 방지한다.

**Tech Stack:** Chrome Extension (MV3), vanilla JavaScript, Node.js `node:test`

---

### Task 1: Root Class Sync Unit Tests

**Files:**
- Create: `test/content_root_state.test.js`
- Test: `test/content_root_state.test.js`

**Step 1: Write the failing test**

```javascript
test("computeRootClassDesired returns true when any filter is enabled", () => {
  assert.equal(computeRootClassDesired({ colorFilterEnabled: true, hiddenTextEnabled: false }), true);
  assert.equal(computeRootClassDesired({ colorFilterEnabled: false, hiddenTextEnabled: true }), true);
});

test("syncRootClass re-adds class when removed unexpectedly", () => {
  const classList = makeMockClassList();
  syncRootClass(classList, "roll20-cleaner-enabled", true);
  classList.remove("roll20-cleaner-enabled");
  syncRootClass(classList, "roll20-cleaner-enabled", true);
  assert.equal(classList.contains("roll20-cleaner-enabled"), true);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/content_root_state.test.js`
Expected: FAIL with module/function not found

**Step 3: Write minimal implementation**

```javascript
function computeRootClassDesired(settings) {
  return !!(settings?.colorFilterEnabled || settings?.hiddenTextEnabled);
}
```

**Step 4: Run test to verify it passes**

Run: `node --test test/content_root_state.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add test/content_root_state.test.js content.js
git commit -m "fix: stabilize root class sync for chat filters"
```

### Task 2: Integrate Root Class Guard Into content.js

**Files:**
- Modify: `content.js`
- Test: `test/content_root_state.test.js`

**Step 1: Write the failing integration-style test**

```javascript
test("onRootClassMutation schedules class resync only when needed", () => {
  // mutation payload with class attribute change
  // expected: sync invoked once, no infinite loop
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/content_root_state.test.js`
Expected: FAIL due to missing scheduler/guard behavior

**Step 3: Write minimal implementation**

```javascript
// content.js
// - add root-state helper functions
// - add coalesced resync scheduler
// - extend MutationObserver options with attributes/class
```

**Step 4: Run test to verify it passes**

Run: `node --test test/content_root_state.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add content.js test/content_root_state.test.js
git commit -m "fix: recover root class when roll20 rewrites html class"
```

### Task 3: Regression and Safety Verification

**Files:**
- Modify (if needed): `content.js`
- Test: `test/content_root_state.test.js`
- Test: `test/html_chunk_serializer.test.js`
- Test: `test/avatar_rules.test.js`

**Step 1: Write failing regression test for no-op behavior**

```javascript
test("syncRootClass is no-op when class already matches desired state", () => {
  // ensures unnecessary DOM writes are avoided
});
```

**Step 2: Run tests to verify RED/GREEN cycle**

Run: `node --test test/content_root_state.test.js`
Expected: FAIL then PASS after minimal change

**Step 3: Verify full suite**

Run: `node --test`
Expected: PASS (all tests green)

**Step 4: Manual code safety checks**

Run:
- `rg -n "roll20-cleaner-enabled|MutationObserver|attributeFilter" content.js`
- `git diff -- content.js test/content_root_state.test.js`

Expected:
- 루트 클래스 관리 로직이 단일 경로로 수렴
- 기존 메시지 필터/다운로드 로직 비침범

**Step 5: Commit**

```bash
git add content.js test/content_root_state.test.js docs/plans/2026-02-18-root-class-stability-fix.md
git commit -m "test: add regression coverage for root class stability"
```
