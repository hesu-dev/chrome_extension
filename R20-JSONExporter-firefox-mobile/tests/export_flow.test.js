const test = require("node:test");
const assert = require("node:assert/strict");

const { getFirefoxExportAction, exportJsonFromActiveTab } = require("../js/popup/popup.js");

test("firefox mobile export prefers file download", () => {
  const action = getFirefoxExportAction({ canDownload: true, canShare: true });
  assert.equal(action.primary, "download");
  assert.deepEqual(action.fallbacks, ["share"]);
});

test("firefox mobile export falls back to share when download is unavailable", () => {
  const action = getFirefoxExportAction({ canDownload: false, canShare: true });
  assert.equal(action.primary, "share");
});

test("firefox mobile export routes the generated JSON through background download", async () => {
  const events = [];
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
            jsonText: '{"schemaVersion":1}',
            filenameBase: "session-a",
          };
        },
      },
      runtime: {
        sendMessage: async (message) => {
          events.push({ kind: "background", message });
          return {
            ok: true,
            filename: "session-a.json",
          };
        },
      },
    },
    navigatorApi: {},
    setStatus() {},
  });

  assert.equal(result.method, "download");
  assert.deepEqual(events, [
    {
      kind: "content",
      tabId: 7,
      message: {
        type: "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON",
      },
    },
    {
      kind: "background",
      message: {
        type: "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_JSON",
        jsonText: '{"schemaVersion":1}',
        filenameBase: "session-a",
      },
    },
  ]);
});

test("firefox mobile export falls back to share when background download fails", async () => {
  let sharedPayload = null;

  const result = await exportJsonFromActiveTab({
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
        }),
      },
      runtime: {
        sendMessage: async () => ({
          ok: false,
          errorMessage: "downloads blocked",
        }),
      },
    },
    navigatorApi: {
      share: async (payload) => {
        sharedPayload = payload;
      },
    },
    setStatus() {},
  });

  assert.equal(result.method, "share");
  assert.deepEqual(sharedPayload, {
    title: "session-b.json",
    text: '{"schemaVersion":1}',
  });
});

test("firefox mobile export falls back to copy when share also fails", async () => {
  let copiedText = "";

  const result = await exportJsonFromActiveTab({
    browserApi: {
      tabs: {
        query: async () => [{ id: 10 }],
        sendMessage: async () => ({
          ok: true,
          jsonText: '{"schemaVersion":1}',
          filenameBase: "session-c",
        }),
      },
      runtime: {
        sendMessage: async () => ({
          ok: false,
          errorMessage: "downloads blocked",
        }),
      },
    },
    navigatorApi: {
      share: async () => {
        throw new Error("share blocked");
      },
      clipboard: {
        writeText: async (text) => {
          copiedText = text;
        },
      },
    },
    setStatus() {},
  });

  assert.equal(result.method, "copy");
  assert.equal(copiedText, '{"schemaVersion":1}');
});
