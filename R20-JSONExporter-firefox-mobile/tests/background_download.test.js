const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
  FIREFOX_EXPORT_JSON_MESSAGE,
  buildDownloadFilename,
  buildPopupPageUrl,
  buildReadingLogWakeUrl,
  createReadingLogProgressReporter,
  createBackgroundMessageHandler,
  downloadJsonPayload,
  createStreamProgressReporter,
  FIREFOX_EXPORT_PROGRESS_MESSAGE,
  normalizeFirefoxMobileErrorMessage,
  scheduleObjectUrlRevoke,
  cleanupReadingLogWakeTabs,
  openPopupPageInTab,
  openReadingLogAppInBackground,
  registerBrowserActionClickHandler,
  startReadingLogTransferInBackground,
} = require("../js/background/background.js");

test("buildDownloadFilename normalizes unsafe characters and appends .json", () => {
  assert.equal(buildDownloadFilename('  session:/a?*  '), "session a.json");
});

test("buildDownloadFilename strips emoji and unsupported title characters", () => {
  assert.equal(buildDownloadFilename("  세션😺漢字 제목  "), "세션 제목.json");
});

test("buildDownloadFilename removes bracket and punctuation restricted by Firefox Android", () => {
  assert.equal(
    buildDownloadFilename("[CoC] 혼세기행 「混世奇行」: 본편 1장 서랑여국편"),
    "CoC 혼세기행 본편 1장 서랑여국편.json"
  );
});

test("downloadJsonPayload uses a blob URL and revokes it after download", async () => {
  const calls = [];
  const progressEvents = [];

  class FakeBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  }

  const result = await downloadJsonPayload(
    {
      jsonText: '{"schemaVersion":1}',
      filenameBase: "session-a",
    },
    {
      BlobCtor: FakeBlob,
      createObjectURL(blob) {
        calls.push({ kind: "blob", blob });
        return "blob:firefox-mobile";
      },
      revokeObjectURL(url) {
        calls.push({ kind: "revoke", url });
      },
      scheduleRevoke(url) {
        calls.push({ kind: "revoke", url });
      },
      reportProgress(detail) {
        progressEvents.push(detail);
        return Promise.resolve();
      },
      download(options) {
        calls.push({ kind: "download", options });
        return Promise.resolve(1);
      },
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.filename, "session-a.json");
  assert.equal(calls[0].kind, "blob");
  assert.deepEqual(calls[1], {
    kind: "download",
    options: {
      url: "blob:firefox-mobile",
      filename: "session-a.json",
      saveAs: false,
      conflictAction: "uniquify",
    },
  });
  assert.equal(calls[2].kind, "revoke");
  assert.equal(calls[2].url, "blob:firefox-mobile");
  assert.deepEqual(progressEvents, [
    "파일 조각을 하나로 합치는 중입니다.",
    "저장할 JSON 파일을 준비하고 있습니다.",
    "브라우저에 파일 저장을 요청하고 있습니다.",
  ]);
});

test("scheduleObjectUrlRevoke revokes later without throwing", async () => {
  const revoked = [];
  await new Promise((resolve) => {
    scheduleObjectUrlRevoke("blob:later", {
      revokeObjectURL(url) {
        revoked.push(url);
        resolve();
      },
      delayMs: 1,
    });
  });
  assert.deepEqual(revoked, ["blob:later"]);
});

test("normalizeFirefoxMobileErrorMessage translates filename errors to Korean", () => {
  const message = normalizeFirefoxMobileErrorMessage(
    new Error("filename must not contain illegal characters"),
    "다운로드를 시작하지 못했습니다."
  );

  assert.equal(message, "파일 이름에 사용할 수 없는 문자가 포함되어 있습니다.");
});

test("createStreamProgressReporter forwards 99% status updates to the popup session", async () => {
  const sentMessages = [];
  const reportProgress = createStreamProgressReporter({
    sessionId: "session-1",
    runtimeApi: {
      sendMessage(message) {
        sentMessages.push(message);
        return Promise.resolve();
      },
    },
  });

  await reportProgress("브라우저에 파일 저장을 요청하고 있습니다.");

  assert.deepEqual(sentMessages, [
    {
      type: FIREFOX_EXPORT_PROGRESS_MESSAGE,
      sessionId: "session-1",
      percent: 99,
      detail: "브라우저에 파일 저장을 요청하고 있습니다.",
    },
  ]);
});

test("buildReadingLogWakeUrl targets the android custom deeplink", () => {
  assert.equal(
    buildReadingLogWakeUrl(),
    "readinglog://imports/json"
  );
});

test("buildPopupPageUrl preserves the originating Roll20 tab id", () => {
  assert.equal(
    buildPopupPageUrl(17, {
      runtimeApi: {
        getURL(pathname) {
          return `moz-extension://unit-test/${pathname}`;
        },
      },
    }),
    "moz-extension://unit-test/popup.html?sourceTabId=17"
  );
});

test("openPopupPageInTab opens popup.html in a foreground tab", async () => {
  const calls = [];
  const created = await openPopupPageInTab(22, {
    runtimeApi: {
      getURL(pathname) {
        return `moz-extension://unit-test/${pathname}`;
      },
    },
    tabsApi: {
      async create(options) {
        calls.push(options);
        return { id: 55, ...options };
      },
    },
  });

  assert.equal(created.id, 55);
  assert.deepEqual(calls, [
    {
      url: "moz-extension://unit-test/popup.html?sourceTabId=22",
      active: true,
    },
  ]);
});

test("registerBrowserActionClickHandler opens the popup page for the clicked tab", async () => {
  let clickHandler = null;
  const opened = [];
  registerBrowserActionClickHandler({
    browserActionApi: {
      onClicked: {
        addListener(handler) {
          clickHandler = handler;
        },
      },
    },
    runtimeApi: {
      getURL(pathname) {
        return `moz-extension://unit-test/${pathname}`;
      },
    },
    tabsApi: {
      async create(options) {
        opened.push(options);
        return { id: 99, ...options };
      },
    },
  });

  assert.equal(typeof clickHandler, "function");
  await clickHandler({ id: 44 });

  assert.deepEqual(opened, [
    {
      url: "moz-extension://unit-test/popup.html?sourceTabId=44",
      active: true,
    },
  ]);
});

test("openReadingLogAppInBackground returns the temporary wake tab id", async () => {
  const calls = [];

  const result = await openReadingLogAppInBackground(buildReadingLogWakeUrl(), {
    tabsApi: {
      async create(options) {
        calls.push({ kind: "create", options });
        return { id: 91 };
      },
    },
  });

  assert.deepEqual(result, {
    wakeUrl: buildReadingLogWakeUrl(),
    wakeTabId: 91,
  });
  assert.deepEqual(calls, [
    {
      kind: "create",
      options: {
        url: "readinglog://imports/json",
        active: true,
      },
    },
  ]);
});

test("cleanupReadingLogWakeTabs removes stale readinglog intent tabs", async () => {
  const calls = [];

  await cleanupReadingLogWakeTabs({
    tabsApi: {
      async query() {
        return [
          { id: 10, url: "https://app.roll20.net/editor/" },
          {
            id: 11,
            url: "readinglog://imports/json",
          },
        ];
      },
      async remove(tabIds) {
        calls.push(tabIds);
      },
    },
  });

  assert.deepEqual(calls, [[11]]);
});

test("cleanupReadingLogWakeTabs removes stale legacy readinglog intent tabs too", async () => {
  const calls = [];

  await cleanupReadingLogWakeTabs({
    tabsApi: {
      async query() {
        return [
          { id: 10, url: "https://app.roll20.net/editor/" },
          {
            id: 11,
            url: "intent://imports/json#Intent;scheme=readinglog;package=com.reha.readinglog;end",
          },
        ];
      },
      async remove(tabIds) {
        calls.push(tabIds);
      },
    },
  });

  assert.deepEqual(calls, [[11]]);
});

test("createReadingLogProgressReporter forwards staged progress updates", async () => {
  const sentMessages = [];
  const reportProgress = createReadingLogProgressReporter({
    sessionId: "session-readinglog-1",
    runtimeApi: {
      sendMessage(message) {
        sentMessages.push(message);
        return Promise.resolve();
      },
    },
  });

  await reportProgress(42, "ReadingLog 앱을 열고 있습니다.");

  assert.deepEqual(sentMessages, [
    {
      type: FIREFOX_EXPORT_PROGRESS_MESSAGE,
      sessionId: "session-readinglog-1",
      percent: 42,
      detail: "ReadingLog 앱을 열고 있습니다.",
    },
  ]);
});

test("background message handler can accept a background-owned ReadingLog transfer request", async () => {
  const calls = [];
  const handler = createBackgroundMessageHandler({
    handleReadingLogTransferStart: async (message) => {
      calls.push(message);
      return {
        ok: true,
        accepted: true,
        sessionId: "session-bg-1",
      };
    },
  });

  const result = await handler({
    type: FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
    exportMessage: {
      type: "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON",
    },
  });

  assert.deepEqual(calls, [
    {
      type: FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
      exportMessage: {
        type: "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON",
      },
    },
  ]);
  assert.deepEqual(result, {
    ok: true,
    accepted: true,
    sessionId: "session-bg-1",
  });
});

test("background locks the active Roll20 tab, wakes ReadingLog, then requests json after the app is ready", async () => {
  const calls = [];
  const result = await startReadingLogTransferInBackground({
    exportMessage: {
      type: FIREFOX_EXPORT_JSON_MESSAGE,
    },
    createSessionId: () => "session-bg-2",
    reportProgress: async (percent, detail) => {
      calls.push({ kind: "progress", percent, detail });
    },
    cleanupReadingLogWakeTabs: async () => {
      calls.push({ kind: "cleanup-wake-tabs" });
    },
    openReadingLogApp: async (url) => {
      calls.push({ kind: "open", url });
      return {
        wakeUrl: url,
        wakeTabId: 99,
      };
    },
    closeReadingLogWakeTab: async (tabId) => {
      calls.push({ kind: "close-wake", tabId });
    },
    waitForReadingLogReady: async () => {
      calls.push({ kind: "ready" });
    },
    tabsApi: {
      query: async () => [{ id: 7 }],
      sendMessage: async (tabId, message) => {
        calls.push({ kind: "content", tabId, message });
        return {
          ok: true,
          jsonText: '{"schemaVersion":1}',
          filenameBase: 'session-a',
          jsonByteLength: 19,
          lineCount: 1,
        };
      },
    },
    streamToReadingLog: async (payload) => {
      calls.push({ kind: "stream", payload });
      return { ok: true, transferId: 'transfer-1' };
    },
  });

  assert.deepEqual(result, {
    ok: true,
    accepted: true,
    sessionId: "session-bg-2",
    transferId: "transfer-1",
    filenameBase: "session-a",
    jsonByteLength: 19,
    lineCount: 1,
  });
  assert.deepEqual(calls[0], {
    kind: "progress",
    percent: 5,
    detail: "현재 열려 있는 Roll20 탭을 확인하고 있습니다.",
  });
  assert.deepEqual(calls[1], {
    kind: "cleanup-wake-tabs",
  });
  assert.deepEqual(calls[2], {
    kind: "progress",
    percent: 15,
    detail: "ReadingLog 앱을 열고 있습니다.",
  });
  assert.deepEqual(calls[3], {
    kind: "open",
    url: "readinglog://imports/json",
  });
  assert.deepEqual(calls[4], {
    kind: "progress",
    percent: 25,
    detail: "ReadingLog 앱 준비를 확인하고 있습니다.",
  });
  assert.deepEqual(calls[5], { kind: "ready" });
  assert.deepEqual(calls[6], {
    kind: "close-wake",
    tabId: 99,
  });
  assert.deepEqual(calls[7], {
    kind: "progress",
    percent: 35,
    detail: "Roll20 페이지에 JSON 생성을 요청하고 있습니다.",
  });
  const contentCall = calls.find((entry) => entry.kind === "content");
  assert.ok(contentCall);
  assert.equal(contentCall.tabId, 7);
  assert.equal(contentCall.message.type, FIREFOX_EXPORT_JSON_MESSAGE);
  assert.equal(contentCall.message.delivery, "background-readinglog-transfer");
  assert.equal(contentCall.message.sessionId, "session-bg-2");
  assert.ok(calls.indexOf(contentCall) > calls.findIndex((entry) => entry.kind === "close-wake"));
  const streamCall = calls.find((entry) => entry.kind === "stream");
  assert.ok(calls.indexOf(streamCall) > calls.indexOf(contentCall));
  assert.deepEqual(streamCall, {
    kind: "stream",
    payload: {
      jsonText: '{"schemaVersion":1}',
      filenameBase: "session-a",
      lineCount: 1,
      jsonByteLength: 19,
    },
  });
});

test("background message handler reports readinglog transfer failures with readinglog wording", async () => {
  const handler = createBackgroundMessageHandler({
    handleReadingLogTransferStart: async () => {
      throw new Error("현재 열려 있는 Roll20 탭을 찾지 못했습니다.");
    },
  });

  const result = await handler({
    type: FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
    exportMessage: {
      type: FIREFOX_EXPORT_JSON_MESSAGE,
    },
  });

  assert.deepEqual(result, {
    ok: false,
    errorMessage: "현재 열려 있는 Roll20 탭을 찾지 못했습니다.",
  });
});

test("background readinglog transfer fails clearly when no active Roll20 tab exists", async () => {
  await assert.rejects(
    () =>
      startReadingLogTransferInBackground({
        exportMessage: {
          type: FIREFOX_EXPORT_JSON_MESSAGE,
        },
        createSessionId: () => "session-bg-3",
        reportProgress: async () => undefined,
        openReadingLogApp: async () => undefined,
        waitForReadingLogReady: async () => undefined,
        tabsApi: {
          query: async () => [],
          sendMessage: async () => undefined,
        },
        streamToReadingLog: async () => ({ ok: true }),
      }),
    /현재 열려 있는 Roll20 탭을 찾지 못했습니다/
  );
});

test("background can wait for ReadingLog readiness without opening the app itself", async () => {
  const calls = [];

  const result = await startReadingLogTransferInBackground({
    exportMessage: {
      type: FIREFOX_EXPORT_JSON_MESSAGE,
    },
    skipWakeApp: true,
    createSessionId: () => "session-bg-4",
    reportProgress: async (percent, detail) => {
      calls.push({ kind: "progress", percent, detail });
    },
    cleanupReadingLogWakeTabs: async () => {
      calls.push({ kind: "cleanup-wake-tabs" });
    },
    openReadingLogApp: async () => {
      calls.push({ kind: "open" });
      return {
        wakeUrl: buildReadingLogWakeUrl(),
        wakeTabId: 777,
      };
    },
    waitForReadingLogReady: async () => {
      calls.push({ kind: "ready" });
    },
    tabsApi: {
      query: async () => [{ id: 8 }],
      sendMessage: async () => ({
        ok: true,
        jsonText: '{"schemaVersion":1}',
        filenameBase: 'session-b',
        jsonByteLength: 19,
        lineCount: 1,
      }),
    },
    streamToReadingLog: async () => ({ ok: true, transferId: 'transfer-2' }),
  });

  assert.equal(result.ok, true);
  assert.equal(calls.some((entry) => entry.kind === "open"), false);
  assert.deepEqual(calls[0], {
    kind: "progress",
    percent: 5,
    detail: "현재 열려 있는 Roll20 탭을 확인하고 있습니다.",
  });
  assert.deepEqual(calls[1], {
    kind: "cleanup-wake-tabs",
  });
  assert.deepEqual(calls[2], {
    kind: "progress",
    percent: 25,
    detail: "ReadingLog 앱 준비를 확인하고 있습니다.",
  });
});
