const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
  FIREFOX_EXPORT_JSON_MESSAGE,
  FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE,
  FIREFOX_EXPORT_PROGRESS_MESSAGE,
  READINGLOG_CLIPBOARD_SHARE_MARKER_TEXT,
  READINGLOG_DIRECT_TEXT_SHARE_MAX_BYTES,
  buildExportMetaText,
  buildSafeJsonFilename,
  buildReadingLogWakeUrl,
  buildJsonShareFile,
  buildClipboardSharePayload,
  openReadingLogApp,
  openReadingLogAppAndStartTransferFromPopup,
  createExportSessionId,
  exportJsonFromActiveTab,
  formatByteSize,
  getFirefoxExportAction,
  measureTextByteLength,
  normalizeFirefoxMobileErrorMessage,
  requestAvatarMappingsFromActiveTab,
  resolveFileStageTimeoutMs,
  startReadingLogTransferFromPopup,
  streamReadingLogJsonToLocalhost,
  subscribeToExportProgress,
  waitForReadingLogLocalhostReady,
  withTimeout,
} = require("../js/popup/popup.js");

test("firefox mobile clipboard-share flow requires clipboard write support", () => {
  assert.throws(
    () =>
      getFirefoxExportAction({
        canDownload: false,
        canShare: false,
        canPostToLocalhost: false,
        canOpenReadingLogApp: false,
        canWriteClipboard: false,
        preferredAction: "clipboard-share-marker",
      }),
    /클립보드 복사를 지원하지 않습니다/
  );
});

test("firefox mobile clipboard-share flow prefers clipboard-share-marker", () => {
  const action = getFirefoxExportAction({
    canDownload: false,
    canShare: false,
    canPostToLocalhost: false,
    canOpenReadingLogApp: false,
    canWriteClipboard: true,
    preferredAction: "clipboard-share-marker",
  });
  assert.equal(action.primary, "clipboard-share-marker");
  assert.deepEqual(action.fallbacks, []);
});

test("firefox mobile direct-text-share flow requires text share support", () => {
  assert.throws(
    () =>
      getFirefoxExportAction({
        canDownload: false,
        canShare: false,
        canPostToLocalhost: false,
        canOpenReadingLogApp: false,
        canWriteClipboard: false,
        canShareText: false,
        preferredAction: "share-text-direct",
      }),
    /텍스트 공유를 지원하지 않습니다/
  );
});

test("firefox mobile direct-text-share flow prefers direct text share", () => {
  const action = getFirefoxExportAction({
    canDownload: false,
    canShare: false,
    canPostToLocalhost: false,
    canOpenReadingLogApp: false,
    canWriteClipboard: false,
    canShareText: true,
    preferredAction: "share-text-direct",
  });
  assert.equal(action.primary, "share-text-direct");
  assert.deepEqual(action.fallbacks, []);
});

test("buildClipboardSharePayload creates a small text marker share payload", () => {
  assert.deepEqual(buildClipboardSharePayload(), {
    title: "ReadingLog 클립보드 가져오기",
    text: READINGLOG_CLIPBOARD_SHARE_MARKER_TEXT,
  });
});

test("firefox mobile deeplink localhost flow prefers deeplink-localhost", () => {
  const action = getFirefoxExportAction({
    canDownload: false,
    canShare: false,
    canPostToLocalhost: true,
    canOpenReadingLogApp: true,
    preferredAction: "deeplink-localhost",
  });
  assert.equal(action.primary, "deeplink-localhost");
  assert.deepEqual(action.fallbacks, []);
});

test("firefox mobile deeplink localhost flow does not require download or share support", () => {
  const action = getFirefoxExportAction({
    canDownload: false,
    canShare: false,
    canPostToLocalhost: true,
    canOpenReadingLogApp: true,
    preferredAction: "deeplink-localhost",
  });
  assert.equal(action.primary, "deeplink-localhost");
  assert.deepEqual(action.fallbacks, []);
});

test("firefox mobile deeplink localhost flow requires localhost probe support", () => {
  assert.throws(
    () =>
      getFirefoxExportAction({
        canDownload: false,
        canShare: false,
        canPostToLocalhost: false,
        canOpenReadingLogApp: true,
        preferredAction: "deeplink-localhost",
      }),
    /ReadingLog 앱 연결을 지원하지 않습니다/
  );
});

test("firefox mobile deeplink localhost flow requires app wake support", () => {
  assert.throws(
    () =>
      getFirefoxExportAction({
        canDownload: false,
        canShare: false,
        canPostToLocalhost: true,
        canOpenReadingLogApp: false,
        preferredAction: "deeplink-localhost",
      }),
    /ReadingLog 앱을 열 수 없습니다/
  );
});

test("buildJsonShareFile creates an application/json file", () => {
  class FakeFile {
    constructor(parts, name, options = {}) {
      this.parts = parts;
      this.name = name;
      this.type = options.type;
    }
  }

  const file = buildJsonShareFile(
    {
      jsonText: '{"schemaVersion":1}',
      filenameBase: "session:/z?*",
    },
    {
      FileCtor: FakeFile,
    }
  );

  assert.equal(file.name, "session z.json");
  assert.equal(file.type, "application/json");
  assert.deepEqual(file.parts, ['{"schemaVersion":1}']);
});

test("buildSafeJsonFilename normalizes unsafe characters for file share", () => {
  assert.equal(buildSafeJsonFilename("  scene:/alpha?*  "), "scene alpha.json");
});

test("buildSafeJsonFilename strips emoji and unsupported title characters", () => {
  assert.equal(buildSafeJsonFilename("세션😺漢字 제목"), "세션 제목.json");
});

test("buildSafeJsonFilename removes bracket and punctuation restricted by Firefox Android", () => {
  assert.equal(
    buildSafeJsonFilename("[CoC] 혼세기행 「混世奇行」: 본편 1장 서랑여국편"),
    "CoC 혼세기행 본편 1장 서랑여국편.json"
  );
});

test("formatByteSize renders readable file sizes", () => {
  assert.equal(formatByteSize(512), "512B");
  assert.equal(formatByteSize(2048), "2.0KB");
  assert.equal(formatByteSize(2 * 1024 * 1024), "2.00MB");
});

test("measureTextByteLength counts UTF-8 byte length", () => {
  assert.equal(measureTextByteLength("abc"), 3);
  assert.equal(measureTextByteLength("가"), 3);
});

test("buildExportMetaText includes file size and line count", () => {
  assert.equal(
    buildExportMetaText({ byteLength: 2048, lineCount: 12 }),
    "예상 파일 크기 2.0KB · 대사 12개"
  );
});

test("resolveFileStageTimeoutMs increases timeout for large files", () => {
  const small = resolveFileStageTimeoutMs({ byteLength: 32 * 1024, baseTimeoutMs: 15000 });
  const large = resolveFileStageTimeoutMs({
    byteLength: 3 * 1024 * 1024,
    baseTimeoutMs: 15000,
  });

  assert.equal(small, 25000);
  assert.equal(large, 50000);
});

test("firefox mobile export routes the generated JSON through background download", async () => {
  const events = [];
  const progressEvents = [];
  const result = await exportJsonFromActiveTab({
    browserApi: {
      downloads: {
        download: async () => 1,
      },
      tabs: {
        query: async () => [{ id: 7 }],
        sendMessage: async (tabId, message) => {
          events.push({ kind: "content", tabId, message });
          return {
            ok: true,
            method: "download",
            deliveredBy: "background-download",
            filename: "session-a.json",
            jsonByteLength: 19,
            lineCount: 1,
          };
        },
      },
      runtime: {
        sendMessage: async (message) => {
          events.push({ kind: "background", message });
          throw new Error("popup should not relay large JSON to background");
        },
      },
    },
    navigatorApi: {},
    setStatus() {},
    setProgress(percent, detail) {
      progressEvents.push({ percent, detail });
    },
  });

  assert.equal(result.method, "download");
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "content");
  assert.equal(events[0].tabId, 7);
  assert.equal(events[0].message.type, FIREFOX_EXPORT_JSON_MESSAGE);
  assert.equal(events[0].message.delivery, "background-download");
  assert.equal(typeof events[0].message.sessionId, "string");
  assert.ok(events[0].message.sessionId.length > 0);
  assert.equal(result.filename, "session-a.json");
  assert.deepEqual(progressEvents.slice(0, 2), [
    { percent: 1, detail: "현재 열려 있는 Roll20 탭을 확인하고 있습니다." },
    { percent: 5, detail: "Roll20 페이지와 연결하고 있습니다." },
  ]);
});

test("firefox mobile export can copy JSON to clipboard and open a text share marker", async () => {
  const clipboardWrites = [];
  const sharePayloads = [];

  const result = await exportJsonFromActiveTab({
    preferredAction: "clipboard-share-marker",
    browserApi: {
      tabs: {
        query: async () => [{ id: 7 }],
        sendMessage: async () => ({
          ok: true,
          jsonText: '{"schemaVersion":1}',
          filenameBase: "session-a",
          jsonByteLength: 19,
          lineCount: 1,
        }),
      },
      runtime: {
        onMessage: {
          addListener() {},
          removeListener() {},
        },
      },
    },
    navigatorApi: {
      clipboard: {
        writeText: async (value) => {
          clipboardWrites.push(value);
        },
      },
      share: async (payload) => {
        sharePayloads.push(payload);
      },
    },
    setStatus() {},
    setProgress() {},
    setMeta() {},
  });

  assert.equal(result.method, "clipboard-share-marker");
  assert.deepEqual(clipboardWrites, ['{"schemaVersion":1}']);
  assert.deepEqual(sharePayloads, [
    {
      title: "ReadingLog 클립보드 가져오기",
      text: READINGLOG_CLIPBOARD_SHARE_MARKER_TEXT,
    },
  ]);
});

test("firefox mobile export keeps clipboard copy even when text share is unavailable", async () => {
  const clipboardWrites = [];

  const result = await exportJsonFromActiveTab({
    preferredAction: "clipboard-share-marker",
    browserApi: {
      tabs: {
        query: async () => [{ id: 9 }],
        sendMessage: async () => ({
          ok: true,
          jsonText: '{"schemaVersion":1}',
          filenameBase: "session-b",
          jsonByteLength: 19,
          lineCount: 1,
        }),
      },
      runtime: {
        onMessage: {
          addListener() {},
          removeListener() {},
        },
      },
    },
    navigatorApi: {
      clipboard: {
        writeText: async (value) => {
          clipboardWrites.push(value);
        },
      },
    },
    setStatus() {},
    setProgress() {},
    setMeta() {},
  });

  assert.equal(result.method, "clipboard-copy");
  assert.deepEqual(clipboardWrites, ['{"schemaVersion":1}']);
});

test("firefox mobile export can share small json text directly to ReadingLog", async () => {
  const sharePayloads = [];

  const result = await exportJsonFromActiveTab({
    preferredAction: "share-text-direct",
    browserApi: {
      tabs: {
        query: async () => [{ id: 17 }],
        sendMessage: async () => ({
          ok: true,
          jsonText: '{"schemaVersion":1}',
          filenameBase: "session-direct",
          jsonByteLength: 19,
          lineCount: 1,
        }),
      },
      runtime: {
        onMessage: {
          addListener() {},
          removeListener() {},
        },
      },
    },
    navigatorApi: {
      share: async (payload) => {
        sharePayloads.push(payload);
      },
    },
    setStatus() {},
    setProgress() {},
    setMeta() {},
  });

  assert.equal(result.method, "share-text-direct");
  assert.deepEqual(sharePayloads, [
    {
      title: "ReadingLog JSON 가져오기",
      text: '{"schemaVersion":1}',
    },
  ]);
});

test("firefox mobile export rejects oversized direct text share payloads", async () => {
  const tooLargeJson = "a".repeat(READINGLOG_DIRECT_TEXT_SHARE_MAX_BYTES + 1);

  await assert.rejects(
    () =>
      exportJsonFromActiveTab({
        preferredAction: "share-text-direct",
        browserApi: {
          tabs: {
            query: async () => [{ id: 19 }],
            sendMessage: async () => ({
              ok: true,
              jsonText: tooLargeJson,
              filenameBase: "session-large",
              jsonByteLength: tooLargeJson.length,
              lineCount: 1,
            }),
          },
          runtime: {
            onMessage: {
              addListener() {},
              removeListener() {},
            },
          },
        },
        navigatorApi: {
          share: async () => {},
        },
        setStatus() {},
        setProgress() {},
        setMeta() {},
      }),
    /텍스트 공유로 보내기에는 JSON 크기가 너무 큽니다/
  );
});

test("firefox mobile export can request mapped json with avatar replacements", async () => {
  const events = [];

  await exportJsonFromActiveTab({
    exportMessage: {
      type: FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE,
      replacements: [{ id: "row-1", name: "KP" }],
    },
    browserApi: {
      downloads: {
        download: async () => 1,
      },
      tabs: {
        query: async () => [{ id: 11 }],
        sendMessage: async (tabId, message) => {
          events.push({ kind: "content", tabId, message });
          return {
            ok: true,
            method: "download",
            deliveredBy: "background-download",
            filename: "session-d.json",
            jsonByteLength: 19,
            lineCount: 1,
          };
        },
      },
      runtime: {
        sendMessage: async (message) => {
          events.push({ kind: "background", message });
          throw new Error("popup should not relay large JSON to background");
        },
      },
    },
    navigatorApi: {},
    setStatus() {},
  });

  assert.equal(events[0].kind, "content");
  assert.equal(events[0].tabId, 11);
  assert.equal(events[0].message.type, FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE);
  assert.equal(events[0].message.delivery, "background-download");
  assert.deepEqual(events[0].message.replacements, [{ id: "row-1", name: "KP" }]);
  assert.equal(typeof events[0].message.sessionId, "string");
  assert.ok(events[0].message.sessionId.length > 0);
});

test("firefox mobile export reports missing Roll20 content responses clearly", async () => {
  await assert.rejects(
    () =>
      exportJsonFromActiveTab({
        browserApi: {
          downloads: {
            download: async () => 1,
          },
          tabs: {
            query: async () => [{ id: 12 }],
            sendMessage: async () => undefined,
          },
          runtime: {
            sendMessage: async () => ({
              ok: true,
              filename: "unused.json",
            }),
          },
        },
        navigatorApi: {},
        setStatus() {},
      }),
    /Roll20 탭 응답이 없습니다/
  );
});

test("firefox mobile popup normalizes english browser errors to Korean", () => {
  assert.equal(
    normalizeFirefoxMobileErrorMessage(
      new Error("Could not establish connection. Receiving end does not exist."),
      "기본 메시지"
    ),
    "Roll20 탭 응답이 없습니다. 탭을 새로고침한 뒤 다시 시도하세요."
  );

  assert.equal(
    normalizeFirefoxMobileErrorMessage(
      new Error("filename must not contain illegal characters"),
      "기본 메시지"
    ),
    "파일 이름에 사용할 수 없는 문자가 포함되어 있습니다."
  );

  assert.equal(
    normalizeFirefoxMobileErrorMessage(
      new Error("다운로드를 시작하지 못했습니다."),
      "기본 메시지"
    ),
    "다운로드를 시작하지 못했습니다."
  );
});

test("withTimeout rejects when the step takes too long", async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 10, "너무 오래 걸립니다."),
    /너무 오래 걸립니다/
  );
});

test("subscribeToExportProgress forwards only matching export sessions", () => {
  const progressEvents = [];
  const statusEvents = [];
  let listener = null;
  const onMessage = {
    addListener(fn) {
      listener = fn;
    },
    removeListener(fn) {
      if (listener === fn) {
        listener = null;
      }
    },
  };
  const unsubscribe = subscribeToExportProgress({
    browserApi: {
      runtime: {
        onMessage,
      },
    },
    sessionId: "session-1",
    setProgress(percent, detail) {
      progressEvents.push({ percent, detail });
    },
    setStatus(text) {
      statusEvents.push(text);
    },
  });

  listener({
    type: FIREFOX_EXPORT_PROGRESS_MESSAGE,
    sessionId: "other-session",
    percent: 35,
    detail: "무시됨",
  });
  listener({
    type: FIREFOX_EXPORT_PROGRESS_MESSAGE,
    sessionId: "session-1",
    percent: 45,
    detail: "이미지 링크를 정리하는 중입니다.",
  });
  unsubscribe();

  assert.deepEqual(progressEvents, [
    { percent: 45, detail: "이미지 링크를 정리하는 중입니다." },
  ]);
  assert.deepEqual(statusEvents, ["이미지 링크를 정리하는 중입니다."]);
  assert.equal(listener, null);
});

test("firefox mobile export surfaces download errors instead of copying text", async () => {
  await assert.rejects(
    () =>
      exportJsonFromActiveTab({
        browserApi: {
          downloads: {
            download: async () => 1,
          },
          tabs: {
            query: async () => [{ id: 9 }],
            sendMessage: async () => ({
              ok: true,
              jsonText: '{"schemaVersion":1}',
              filenameBase: "session-b",
              jsonByteLength: 19,
              lineCount: 1,
            }),
          },
          runtime: {
            sendMessage: async () => ({
              ok: false,
              errorMessage: "downloads blocked",
            }),
          },
        },
        navigatorApi: {},
        setStatus() {},
      }),
    /JSON 생성은 완료되었지만 파일 저장에 실패했습니다.*파일 저장이 차단되었습니다/
  );
});

test("firefox mobile share flow prefers file share before download", async () => {
  let sharedPayload = null;

  class FakeFile {
    constructor(parts, name, options = {}) {
      this.parts = parts;
      this.name = name;
      this.type = options.type;
    }
  }

  const result = await exportJsonFromActiveTab({
    preferredAction: "share-file",
    browserApi: {
      downloads: {
        download: async (options) => {
          events.push({ kind: "download", options });
          return 1;
        },
      },
      tabs: {
        query: async () => [{ id: 21 }],
        sendMessage: async () => ({
          ok: true,
          jsonText: '{"schemaVersion":1}',
          filenameBase: "session-share",
          jsonByteLength: 19,
          lineCount: 1,
        }),
      },
      runtime: {
        sendMessage: async () => {
          throw new Error("download should not run");
        },
      },
    },
    navigatorApi: {
      canShare: ({ files }) => Array.isArray(files) && files.length === 1,
      share: async (payload) => {
        sharedPayload = payload;
      },
    },
    FileCtor: FakeFile,
    setStatus() {},
  });

  assert.equal(result.method, "share-file");
  assert.equal(sharedPayload.title, "session-share.json");
  assert.equal(sharedPayload.files.length, 1);
});

test("firefox mobile share flow requires file share support", async () => {
  await assert.rejects(
    () =>
      exportJsonFromActiveTab({
        preferredAction: "share-file",
        browserApi: {
          downloads: {
            download: async () => 1,
          },
          tabs: {
            query: async () => [{ id: 22 }],
            sendMessage: async () => ({
              ok: true,
              jsonText: '{"schemaVersion":1}',
              filenameBase: "session-share-fallback",
              jsonByteLength: 19,
              lineCount: 1,
            }),
          },
          runtime: {
            sendMessage: async () => ({
              ok: true,
              filename: "session-share-fallback.json",
            }),
          },
        },
        navigatorApi: {},
        setStatus() {},
      }),
    /파일 공유를 지원하지 않습니다/
  );
});

test("firefox mobile share flow reports file-share stage failures clearly", async () => {
  class FakeFile {
    constructor(parts, name, options = {}) {
      this.parts = parts;
      this.name = name;
      this.type = options.type;
    }
  }

  await assert.rejects(
    () =>
      exportJsonFromActiveTab({
        preferredAction: "share-file",
        browserApi: {
          downloads: {
            download: async () => 1,
          },
          tabs: {
            query: async () => [{ id: 31 }],
            sendMessage: async () => ({
              ok: true,
              jsonText: '{"schemaVersion":1}',
              filenameBase: "session-share-error",
              jsonByteLength: 19,
              lineCount: 1,
            }),
          },
          runtime: {
            sendMessage: async () => ({
              ok: true,
              filename: "unused.json",
            }),
          },
        },
        navigatorApi: {
          canShare: () => true,
          share: async () => {
            throw new Error("Share failed");
          },
        },
        FileCtor: FakeFile,
        setStatus() {},
      }),
    /JSON 생성은 완료되었지만 파일 공유에 실패했습니다.*파일 공유를 완료하지 못했습니다/
  );
});

test("firefox mobile localhost flow probes and posts json to ReadingLog", async () => {
  const fetchCalls = [];

  const result = await exportJsonFromActiveTab({
    preferredAction: "localhost-post",
    browserApi: {
      tabs: {
        query: async () => [{ id: 41 }],
        sendMessage: async () => ({
          ok: true,
          jsonText: '{"schemaVersion":1}',
          filenameBase: "session-localhost",
          jsonByteLength: 19,
          lineCount: 1,
        }),
      },
    },
    fetchApi: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (String(url).endsWith("/health")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    },
    setStatus() {},
  });

  assert.equal(result.method, "localhost-post");
  assert.equal(fetchCalls.length, 2);
  assert.match(fetchCalls[0].url, /\/health$/);
  assert.equal(fetchCalls[0].options.method, "GET");
  assert.match(fetchCalls[1].url, /\/imports\/json$/);
  assert.equal(fetchCalls[1].options.method, "POST");
  assert.equal(fetchCalls[1].options.headers["Content-Type"], "application/json");
  assert.equal(
    JSON.parse(fetchCalls[1].options.body).filename,
    "session-localhost"
  );
  assert.equal(
    JSON.parse(fetchCalls[1].options.body).jsonText,
    '{"schemaVersion":1}'
  );
});

test("firefox mobile localhost flow reports probe failures clearly", async () => {
  await assert.rejects(
    () =>
      exportJsonFromActiveTab({
        preferredAction: "localhost-post",
        browserApi: {
          tabs: {
            query: async () => [{ id: 42 }],
            sendMessage: async () => ({
              ok: true,
              jsonText: '{"schemaVersion":1}',
              filenameBase: "session-localhost-error",
              jsonByteLength: 19,
              lineCount: 1,
            }),
          },
        },
        fetchApi: async () => ({
          ok: false,
          status: 503,
          json: async () => ({ ok: false }),
        }),
        setStatus() {},
      }),
    /ReadingLog 앱이 준비되지 않았습니다/
  );
});

test("firefox mobile localhost flow reports post failures clearly", async () => {
  await assert.rejects(
    () =>
      exportJsonFromActiveTab({
        preferredAction: "localhost-post",
        browserApi: {
          tabs: {
            query: async () => [{ id: 43 }],
            sendMessage: async () => ({
              ok: true,
              jsonText: '{"schemaVersion":1}',
              filenameBase: "session-localhost-post-error",
              jsonByteLength: 19,
              lineCount: 1,
            }),
          },
        },
        fetchApi: async (url) => {
          if (String(url).endsWith("/health")) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ ok: true }),
            };
          }
          return {
            ok: false,
            status: 500,
            text: async () => "server error",
          };
        },
        setStatus() {},
      }),
    /JSON 생성은 완료되었지만 ReadingLog 앱으로 보내지 못했습니다/
  );
});

test("firefox mobile deeplink localhost flow reports app-open failures clearly", async () => {
  await assert.rejects(
    () =>
      exportJsonFromActiveTab({
        preferredAction: "deeplink-localhost",
        browserApi: {
          tabs: {
            query: async () => [{ id: 44 }],
            sendMessage: async () => ({
              ok: true,
              jsonText: '{"schemaVersion":1}',
              filenameBase: "session-deeplink-error",
              jsonByteLength: 19,
              lineCount: 1,
            }),
          },
        },
        fetchApi: async () => ({
          ok: false,
          status: 503,
          json: async () => ({ ok: false }),
        }),
        setStatus() {},
      }),
    /브라우저가 ReadingLog 앱 열기를 막고 있습니다/
  );
});

test("buildReadingLogWakeUrl targets the ReadingLog custom deeplink", () => {
  assert.equal(
    buildReadingLogWakeUrl(),
    "readinglog://imports/json"
  );
});

test("firefox mobile wakes ReadingLog before localhost readiness polling", async () => {
  const events = [];
  let attempts = 0;

  await waitForReadingLogLocalhostReady({
    openReadingLogApp: async (url) => {
      events.push({ kind: "open", url });
    },
    probeLocalhost: async () => {
      attempts += 1;
      events.push({ kind: "probe", attempts });
      return attempts >= 3;
    },
    wait: async () => {
      events.push({ kind: "wait" });
    },
    maxAttempts: 4,
  });

  assert.deepEqual(events, [
    {
      kind: "open",
      url: "readinglog://imports/json",
    },
    { kind: "probe", attempts: 1 },
    { kind: "wait" },
    { kind: "probe", attempts: 2 },
    { kind: "wait" },
    { kind: "probe", attempts: 3 },
  ]);
});

test("firefox mobile localhost readiness polling reports blocked app-open failures clearly", async () => {
  await assert.rejects(
    () =>
      waitForReadingLogLocalhostReady({
        openReadingLogApp: async () => undefined,
        probeLocalhost: async () => false,
        wait: async () => undefined,
        maxAttempts: 3,
      }),
    /브라우저가 ReadingLog 앱 열기를 막고 있습니다/
  );
});

test("firefox mobile streams localhost json through start chunk finish endpoints", async () => {
  const requests = [];
  const progress = [];
  const largeJsonText = JSON.stringify({
    schemaVersion: 1,
    lines: Array.from({ length: 4 }, (_, index) => ({
      id: `line-${index + 1}`,
      text: "x".repeat(40),
    })),
  });

  const response = await streamReadingLogJsonToLocalhost(
    {
      filenameBase: "session-a",
      jsonText: largeJsonText,
      lineCount: 4,
    },
    {
      chunkSize: 64,
      fetchApi: async (url, options = {}) => {
        requests.push({
          url,
          method: options.method,
          body: JSON.parse(options.body),
        });
        if (url.endsWith("/imports/json/start")) {
          return {
            ok: true,
            json: async () => ({ transferId: "transfer-1" }),
          };
        }
        if (url.endsWith("/imports/json/chunk")) {
          return {
            ok: true,
            json: async () => ({ ok: true }),
          };
        }
        if (url.endsWith("/imports/json/finish")) {
          return {
            ok: true,
            json: async () => ({ ok: true }),
          };
        }
        throw new Error(`unexpected url ${url}`);
      },
      onChunkProgress(percent, detail) {
        progress.push({ percent, detail });
      },
    }
  );

  assert.equal(response.transferId, "transfer-1");
  assert.equal(requests[0].url, "http://127.0.0.1:37845/imports/json/start");
  assert.equal(requests[0].body.filename, "session-a");
  assert.equal(requests[0].body.lineCount, 4);
  assert.ok(requests[0].body.chunkCount >= 2);
  assert.equal(requests.at(-1).url, "http://127.0.0.1:37845/imports/json/finish");
  assert.equal(requests.at(-1).body.transferId, "transfer-1");
  assert.ok(
    requests.filter((request) => request.url.endsWith("/imports/json/chunk")).length >= 2
  );
  assert.ok(progress.some((entry) => entry.percent >= 50 && entry.percent <= 99));
  assert.match(progress.at(-1).detail, /전송/);
});

test("firefox mobile localhost stream surfaces chunk upload failures clearly", async () => {
  await assert.rejects(
    () =>
      streamReadingLogJsonToLocalhost(
        {
          filenameBase: "session-b",
          jsonText: '{"schemaVersion":1}',
          lineCount: 1,
        },
        {
          chunkSize: 8,
          fetchApi: async (url) => {
            if (url.endsWith("/imports/json/start")) {
              return {
                ok: true,
                json: async () => ({ transferId: "transfer-2" }),
              };
            }
            if (url.endsWith("/imports/json/chunk")) {
              return {
                ok: false,
                json: async () => ({ ok: false }),
              };
            }
            return {
              ok: true,
              json: async () => ({ ok: true }),
            };
          },
        }
      ),
    /ReadingLog 앱으로 데이터를 보내는 중 오류가 발생했습니다/
  );
});

test("firefox mobile popup can request a background-owned readinglog transfer", async () => {
  const sentMessages = [];
  const result = await startReadingLogTransferFromPopup({
    browserApi: {
      runtime: {
        sendMessage(message) {
          sentMessages.push(message);
          return Promise.resolve({
            ok: true,
            sessionId: "session-1",
            accepted: true,
          });
        },
      },
    },
    exportMessage: {
      type: FIREFOX_EXPORT_JSON_MESSAGE,
    },
    sessionId: "session-popup-1",
  });

  assert.deepEqual(sentMessages, [
    {
      type: FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
      exportMessage: {
        type: FIREFOX_EXPORT_JSON_MESSAGE,
      },
      sessionId: "session-popup-1",
    },
  ]);
  assert.equal(result.accepted, true);
});

test("popup openReadingLogApp uses a hidden deeplink anchor before falling back", async () => {
  const calls = [];
  const result = await openReadingLogApp("readinglog://imports/json", {
    documentApi: {
      body: {
        appendChild(node) {
          calls.push({ kind: "appendChild", href: node.href });
        },
      },
      createElement(tag) {
        calls.push({ kind: "createElement", tag });
        return {
          href: "",
          rel: "",
          style: {},
          click() {
            calls.push({ kind: "click", href: this.href });
          },
          remove() {
            calls.push({ kind: "remove" });
          },
        };
      },
    },
    windowApi: {},
  });

  assert.equal(result, "readinglog://imports/json");
  assert.deepEqual(calls, [
    {
      kind: "createElement",
      tag: "a",
    },
    {
      kind: "appendChild",
      href: "readinglog://imports/json",
    },
    {
      kind: "click",
      href: "readinglog://imports/json",
    },
    { kind: "remove" },
  ]);
});

test("popup openReadingLogApp falls back through three direct deeplink methods when popup stays visible", async () => {
  const calls = [];
  await assert.rejects(
    () =>
      openReadingLogApp("readinglog://imports/json", {
        documentApi: {
          visibilityState: "visible",
          body: {
            appendChild(node) {
              calls.push({ kind: "appendChild", href: node.href });
            },
          },
          createElement(tag) {
            calls.push({ kind: "createElement", tag });
            return {
              href: "",
              rel: "",
              style: {},
              click() {
                calls.push({ kind: "click", href: this.href });
              },
              remove() {
                calls.push({ kind: "remove" });
              },
            };
          },
        },
        windowApi: {
          location: {
            assign(url) {
              calls.push({ kind: "assign", url });
            },
          },
          open(url, target) {
            calls.push({ kind: "open", url, target });
            return null;
          },
        },
        waitForPopupHidden: async () => false,
      }),
    /브라우저가 ReadingLog 앱 열기를 막고 있습니다/
  );

  assert.deepEqual(calls, [
    { kind: "createElement", tag: "a" },
    { kind: "appendChild", href: "readinglog://imports/json" },
    { kind: "click", href: "readinglog://imports/json" },
    { kind: "remove" },
    { kind: "assign", url: "readinglog://imports/json" },
    { kind: "open", url: "readinglog://imports/json", target: "_blank" },
  ]);
});

test("popup openReadingLogApp reports direct deeplink attempt stages in order", async () => {
  const statuses = [];

  await assert.rejects(
    () =>
      openReadingLogApp("readinglog://imports/json", {
        documentApi: {
          visibilityState: "visible",
          body: {
            appendChild() {},
          },
          createElement() {
            return {
              href: "",
              rel: "",
              style: {},
              click() {},
              remove() {},
            };
          },
        },
        windowApi: {
          location: {
            assign() {},
          },
          open() {
            return null;
          },
        },
        waitForPopupHidden: async () => false,
        onAttempt(label) {
          statuses.push(`attempt:${label}`);
        },
        onFallback(label) {
          statuses.push(`fallback:${label}`);
        },
      }),
    /브라우저가 ReadingLog 앱 열기를 막고 있습니다/
  );

  assert.deepEqual(statuses, [
    "attempt:anchor.click",
    "fallback:anchor.click",
    "attempt:location.assign",
    "fallback:location.assign",
    "attempt:window.open",
    "fallback:window.open",
  ]);
});

test("popup opens ReadingLog directly before starting the background transfer", async () => {
  const calls = [];
  const result = await openReadingLogAppAndStartTransferFromPopup({
    browserApi: {
      runtime: {
        sendMessage(message) {
          calls.push({ kind: "runtimeSendMessage", message });
          return Promise.resolve({
            ok: true,
            accepted: true,
            sessionId: "session-1",
          });
        },
      },
    },
    exportMessage: {
      type: FIREFOX_EXPORT_JSON_MESSAGE,
    },
    sessionId: "session-popup-3",
    openReadingLogApp: async (url) => {
      calls.push({ kind: "open", url });
      return url;
    },
  });

  assert.equal(result.accepted, true);
  assert.deepEqual(calls, [
    {
      kind: "open",
      url: "readinglog://imports/json",
    },
    {
      kind: "runtimeSendMessage",
      message: {
        type: FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
        exportMessage: {
          type: FIREFOX_EXPORT_JSON_MESSAGE,
        },
        sessionId: "session-popup-3",
        skipWakeApp: true,
      },
    },
  ]);
});

test("popup background transfer defaults to opening ReadingLog from the popup context", async () => {
  const previousDocument = global.document;
  const previousWindow = global.window;
  const calls = [];

  global.document = {
    body: {
      appendChild(node) {
        calls.push({ kind: "appendChild", href: node.href });
      },
    },
    createElement(tag) {
      calls.push({ kind: "createElement", tag });
      return {
        href: "",
        rel: "",
        style: {},
        click() {
          calls.push({ kind: "click", href: this.href });
        },
        remove() {
          calls.push({ kind: "remove" });
        },
      };
    },
  };
  global.window = {};

  try {
    const result = await openReadingLogAppAndStartTransferFromPopup({
      browserApi: {
        runtime: {
          sendMessage(message) {
            calls.push({ kind: "runtimeSendMessage", message });
            return Promise.resolve({
              ok: true,
              accepted: true,
              sessionId: "session-1",
            });
          },
        },
      },
      exportMessage: {
        type: FIREFOX_EXPORT_JSON_MESSAGE,
      },
      sessionId: "session-popup-default",
    });

    assert.equal(result.accepted, true);
    assert.deepEqual(calls, [
      {
        kind: "createElement",
        tag: "a",
      },
      {
        kind: "appendChild",
        href: "readinglog://imports/json",
      },
      {
        kind: "click",
        href: "readinglog://imports/json",
      },
      { kind: "remove" },
      {
        kind: "runtimeSendMessage",
        message: {
          type: FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
          exportMessage: {
            type: FIREFOX_EXPORT_JSON_MESSAGE,
          },
          sessionId: "session-popup-default",
          skipWakeApp: true,
        },
      },
    ]);
  } finally {
    if (typeof previousDocument === "undefined") {
      delete global.document;
    } else {
      global.document = previousDocument;
    }
    if (typeof previousWindow === "undefined") {
      delete global.window;
    } else {
      global.window = previousWindow;
    }
  }
});

test("firefox mobile popup opens ReadingLog first and then starts background transfer without waking again", async () => {
  const calls = [];

  const result = await openReadingLogAppAndStartTransferFromPopup({
    browserApi: {
      runtime: {
        sendMessage(message) {
          calls.push({ kind: "runtimeSendMessage", message });
          return Promise.resolve({
            ok: true,
            accepted: true,
            sessionId: "session-1",
          });
        },
      },
    },
    exportMessage: {
      type: FIREFOX_EXPORT_JSON_MESSAGE,
    },
    sessionId: "session-popup-3",
    openReadingLogApp: async (url) => {
      calls.push({ kind: "open", url });
      return url;
    },
  });

  assert.equal(result.accepted, true);
  assert.deepEqual(calls, [
    {
      kind: "open",
      url: "readinglog://imports/json",
    },
    {
      kind: "runtimeSendMessage",
      message: {
        type: FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
        exportMessage: {
          type: FIREFOX_EXPORT_JSON_MESSAGE,
        },
        sessionId: "session-popup-3",
        skipWakeApp: true,
      },
    },
  ]);
});

test("firefox mobile popup can request a background-owned readinglog transfer without waking the app from background", async () => {
  const sentMessages = [];
  const result = await startReadingLogTransferFromPopup({
    browserApi: {
      runtime: {
        sendMessage(message) {
          sentMessages.push(message);
          return Promise.resolve({
            ok: true,
            sessionId: "session-1",
            accepted: true,
          });
        },
      },
    },
    exportMessage: {
      type: FIREFOX_EXPORT_JSON_MESSAGE,
    },
    sessionId: "session-popup-1",
    skipWakeApp: true,
  });

  assert.deepEqual(sentMessages, [
    {
      type: FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
      exportMessage: {
        type: FIREFOX_EXPORT_JSON_MESSAGE,
      },
      sessionId: "session-popup-1",
      skipWakeApp: true,
    },
  ]);
  assert.equal(result.accepted, true);
});

test("firefox mobile popup surfaces background transfer failures", async () => {
  await assert.rejects(
    () =>
      startReadingLogTransferFromPopup({
        browserApi: {
          runtime: {
            sendMessage() {
              return Promise.resolve({
                ok: false,
                errorMessage: "ReadingLog 앱이 준비되지 않았습니다.",
              });
            },
          },
        },
        exportMessage: {
          type: FIREFOX_EXPORT_JSON_MESSAGE,
        },
        sessionId: "session-popup-2",
      }),
    /ReadingLog 앱이 준비되지 않았습니다/
  );
});

test("firefox mobile can request avatar mappings from the active tab", async () => {
  const mappings = await requestAvatarMappingsFromActiveTab({
    browserApi: {
      tabs: {
        query: async () => [{ id: 15 }],
        sendMessage: async (tabId, message) => {
          assert.equal(tabId, 15);
          assert.equal(message.type, "R20_JSON_EXPORTER_FIREFOX_GET_AVATAR_MAPPINGS");
          return {
            ok: true,
            mappings: [{ id: "row-1" }],
          };
        },
      },
    },
  });

  assert.deepEqual(mappings, [{ id: "row-1" }]);
});
