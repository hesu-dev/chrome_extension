(function () {
  const FIREFOX_EXPORT_JSON_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON";
  const FIREFOX_DOWNLOAD_JSON_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_JSON";
  const FIREFOX_EXPORT_PROGRESS_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_EXPORT_PROGRESS";
  const FIREFOX_START_READINGLOG_TRANSFER_MESSAGE =
    "R20_JSON_EXPORTER_FIREFOX_START_READINGLOG_TRANSFER";
  const FIREFOX_DOWNLOAD_STREAM_START_MESSAGE =
    "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_STREAM_START";
  const FIREFOX_DOWNLOAD_STREAM_CHUNK_MESSAGE =
    "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_STREAM_CHUNK";
  const FIREFOX_DOWNLOAD_STREAM_FINISH_MESSAGE =
    "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_STREAM_FINISH";
  const READINGLOG_ANDROID_DEEPLINK_URL =
    "readinglog://imports/json";
  const READINGLOG_ANDROID_LEGACY_INTENT_URL =
    "intent://imports/json#Intent;scheme=readinglog;package=com.reha.readinglog;end";
  const downloadStreams = new Map();

  function isFilenameConstraintError(error) {
    const normalized = String(error?.message || error || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!normalized) return false;
    return (
      normalized.includes("filename must") ||
      normalized.includes("invalid filename") ||
      normalized.includes("illegal characters") ||
      normalized.includes("path is invalid")
    );
  }

  function normalizeFirefoxMobileErrorMessage(error, fallbackMessage) {
    const fallback = String(fallbackMessage || "처리 중 오류가 발생했습니다.");
    const rawMessage = String(error?.message || error || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!rawMessage) return fallback;

    const normalized = rawMessage.toLowerCase();
    if (
      normalized.includes("filename must") ||
      normalized.includes("invalid filename") ||
      normalized.includes("illegal characters") ||
      normalized.includes("path is invalid")
    ) {
      return "파일 이름에 사용할 수 없는 문자가 포함되어 있습니다.";
    }
    if (normalized.includes("downloads blocked")) {
      return "파일 저장이 차단되었습니다.";
    }
    if (normalized.includes("download canceled")) {
      return "파일 저장이 취소되었습니다.";
    }
    return rawMessage || fallback;
  }

  function buildDownloadFilename(filenameBase) {
    const cleaned = String(filenameBase || "roll20-chat")
      .trim()
      .replace(/[\[\]<>:"/\\|?*;,+=\x00-\x1f\u200e\u200f\u202a-\u202e]+/g, " ")
      .replace(/[^A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ _()\-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .trim();
    const base = cleaned || "roll20-chat";
    return base.toLowerCase().endsWith(".json") ? base : `${base}.json`;
  }

  function buildFallbackDownloadFilename(filenameBase) {
    const cleaned = String(filenameBase || "roll20-chat")
      .trim()
      .replace(/[\[\]<>:"/\\|?*;,+=\x00-\x1f\u200e\u200f\u202a-\u202e]+/g, " ")
      .replace(/[^A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ _()\-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .trim();
    const base = cleaned || "roll20-chat";
    return base.toLowerCase().endsWith(".json") ? base : `${base}.json`;
  }

  function scheduleObjectUrlRevoke(
    url,
    {
      revokeObjectURL = (value) => URL.revokeObjectURL(value),
      delayMs = 10 * 60 * 1000,
    } = {}
  ) {
    if (!url || typeof revokeObjectURL !== "function") return;
    setTimeout(() => {
      try {
        revokeObjectURL(url);
      } catch (error) {
        // Ignore delayed cleanup failures.
      }
    }, Math.max(1000, Number(delayMs) || 600000));
  }

  async function downloadJsonPayload(
    { jsonText = "", filenameBase = "roll20-chat" } = {},
    {
      BlobCtor = typeof Blob !== "undefined" ? Blob : null,
      createObjectURL = (blob) => URL.createObjectURL(blob),
      revokeObjectURL = (url) => URL.revokeObjectURL(url),
      download = (options) => browser.downloads.download(options),
      scheduleRevoke = (url) => scheduleObjectUrlRevoke(url, { revokeObjectURL }),
      reportProgress = async () => undefined,
    } = {}
  ) {
    return downloadJsonPartsPayload(
      {
        parts: [String(jsonText || "")],
        filenameBase,
      },
      {
        BlobCtor,
        createObjectURL,
        revokeObjectURL,
        download,
        scheduleRevoke,
        reportProgress,
      }
    );
  }

  async function downloadJsonPartsPayload(
    { parts = [], filenameBase = "roll20-chat" } = {},
    {
      BlobCtor = typeof Blob !== "undefined" ? Blob : null,
      createObjectURL = (blob) => URL.createObjectURL(blob),
      revokeObjectURL = (url) => URL.revokeObjectURL(url),
      download = (options) => browser.downloads.download(options),
      scheduleRevoke = (url) => scheduleObjectUrlRevoke(url, { revokeObjectURL }),
      reportProgress = async () => undefined,
    } = {}
  ) {
    if (typeof BlobCtor !== "function") {
      throw new Error("Blob 생성기를 찾지 못했습니다.");
    }
    if (typeof createObjectURL !== "function" || typeof revokeObjectURL !== "function") {
      throw new Error("브라우저 URL API를 찾지 못했습니다.");
    }
    if (typeof download !== "function") {
      throw new Error("다운로드 API를 찾지 못했습니다.");
    }

    await reportProgress("파일 조각을 하나로 합치는 중입니다.");
    const blob = new BlobCtor(Array.isArray(parts) ? parts : [String(parts || "")], {
      type: "application/json;charset=utf-8",
    });
    await reportProgress("저장할 JSON 파일을 준비하고 있습니다.");
    const url = createObjectURL(blob);
    const primaryFilename = buildDownloadFilename(filenameBase);
    const fallbackFilename = buildFallbackDownloadFilename(filenameBase);

    try {
      try {
        await reportProgress("브라우저에 파일 저장을 요청하고 있습니다.");
        await download({
          url,
          filename: primaryFilename,
          saveAs: false,
          conflictAction: "uniquify",
        });
        return {
          ok: true,
          filename: primaryFilename,
          usedFallbackFilename: false,
        };
      } catch (error) {
        if (!isFilenameConstraintError(error) || fallbackFilename === primaryFilename) {
          throw error;
        }
        await reportProgress("파일 이름을 다시 정리하고 있습니다.");
        await reportProgress("브라우저에 파일 저장을 다시 요청하고 있습니다.");
        await download({
          url,
          filename: fallbackFilename,
          saveAs: false,
          conflictAction: "uniquify",
        });
        return {
          ok: true,
          filename: fallbackFilename,
          usedFallbackFilename: true,
        };
      }
    } finally {
      scheduleRevoke(url);
    }
  }

  function createStreamProgressReporter(
    { sessionId = "", runtimeApi = typeof browser !== "undefined" ? browser.runtime : null } = {}
  ) {
    const safeSessionId = String(sessionId || "").trim();
    if (!safeSessionId || typeof runtimeApi?.sendMessage !== "function") {
      return async () => undefined;
    }
    return async (detail = "") => {
      try {
        await runtimeApi.sendMessage({
          type: FIREFOX_EXPORT_PROGRESS_MESSAGE,
          sessionId: safeSessionId,
          percent: 99,
          detail: String(detail || "").trim(),
        });
      } catch (error) {
        // Ignore popup listener failures while background work continues.
      }
    };
  }

  function buildReadingLogWakeUrl() {
    return READINGLOG_ANDROID_DEEPLINK_URL;
  }

  async function cleanupReadingLogWakeTabs(
    {
      tabsApi = typeof browser !== "undefined" ? browser.tabs : null,
      wakeUrl = buildReadingLogWakeUrl(),
      legacyWakeUrl = READINGLOG_ANDROID_LEGACY_INTENT_URL,
    } = {}
  ) {
    if (typeof tabsApi?.query !== "function" || typeof tabsApi?.remove !== "function") {
      return;
    }
    const safeWakeUrl = String(wakeUrl || "").trim();
    if (!safeWakeUrl) return;
    const tabs = await tabsApi.query({});
    const staleTabIds = (Array.isArray(tabs) ? tabs : [])
      .filter((tab) => {
        const tabUrl = String(tab?.url || "").trim();
        return tabUrl === safeWakeUrl || tabUrl === String(legacyWakeUrl || "").trim();
      })
      .map((tab) => Number(tab?.id))
      .filter((tabId) => Number.isFinite(tabId));
    if (!staleTabIds.length) return;
    await tabsApi.remove(staleTabIds);
  }

  function createReadingLogProgressReporter(
    { sessionId = "", runtimeApi = typeof browser !== "undefined" ? browser.runtime : null } = {}
  ) {
    const safeSessionId = String(sessionId || "").trim();
    if (!safeSessionId || typeof runtimeApi?.sendMessage !== "function") {
      return async () => undefined;
    }
    return async (percent = 0, detail = "") => {
      try {
        await runtimeApi.sendMessage({
          type: FIREFOX_EXPORT_PROGRESS_MESSAGE,
          sessionId: safeSessionId,
          percent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0))),
          detail: String(detail || "").trim(),
        });
      } catch (error) {
        // Ignore popup listener cleanup failures while background work continues.
      }
    };
  }

  function createTransferSessionId() {
    return `firefox-readinglog-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  async function openReadingLogAppInBackground(
    wakeUrl = buildReadingLogWakeUrl(),
    {
      tabsApi = typeof browser !== "undefined" ? browser.tabs : null,
    } = {}
  ) {
    const safeUrl = String(wakeUrl || "").trim();
    if (!safeUrl || typeof tabsApi?.create !== "function") {
      throw new Error("ReadingLog 앱을 열 수 없습니다.");
    }
    const wakeTab = await tabsApi.create({ url: safeUrl, active: true });
    return {
      wakeUrl: safeUrl,
      wakeTabId: Number.isFinite(Number(wakeTab?.id)) ? Number(wakeTab.id) : null,
    };
  }

  async function closeReadingLogWakeTab(
    wakeTabId,
    {
      tabsApi = typeof browser !== "undefined" ? browser.tabs : null,
    } = {}
  ) {
    const safeWakeTabId = Number(wakeTabId);
    if (!Number.isFinite(safeWakeTabId) || typeof tabsApi?.remove !== "function") {
      return;
    }
    try {
      await tabsApi.remove(safeWakeTabId);
    } catch (error) {
      // Ignore cleanup failures.
    }
  }

  async function wait(delayMs = 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
    });
  }

  async function waitForReadingLogReady({
    fetchApi = typeof fetch !== "undefined" ? fetch : null,
    baseUrl = "http://127.0.0.1:37845",
    maxAttempts = 40,
    pollIntervalMs = 300,
  } = {}) {
    if (typeof fetchApi !== "function") {
      throw new Error("ReadingLog 앱 연결을 지원하지 않습니다.");
    }
    const attemptsLimit = Math.max(1, Number(maxAttempts) || 1);
    for (let attempt = 1; attempt <= attemptsLimit; attempt += 1) {
      try {
        const response = await fetchApi(`${baseUrl}/health`, {
          method: "GET",
          cache: "no-store",
        });
        if (response?.ok) {
          return {
            ok: true,
            attempts: attempt,
          };
        }
      } catch (error) {
        // keep polling until timeout
      }
    if (attempt < attemptsLimit) {
      await wait(pollIntervalMs);
    }
  }
  throw new Error("브라우저가 ReadingLog 앱 열기를 막고 있습니다.");
  }

  function splitJsonTextIntoChunks(jsonText = "", chunkSize = 256 * 1024) {
    const safeText = String(jsonText || "");
    const safeChunkSize = Math.max(1, Number(chunkSize) || 1);
    const parts = [];
    for (let offset = 0; offset < safeText.length; offset += safeChunkSize) {
      parts.push(safeText.slice(offset, offset + safeChunkSize));
    }
    return parts.length ? parts : [""];
  }

  async function readJsonResponse(response) {
    if (typeof response?.json !== "function") {
      return {};
    }
    try {
      return (await response.json()) || {};
    } catch (error) {
      return {};
    }
  }

  async function streamToReadingLogInBackground(
    payload,
    {
      fetchApi = typeof fetch !== "undefined" ? fetch : null,
      baseUrl = "http://127.0.0.1:37845",
      chunkSize = 256 * 1024,
      reportProgress = async () => undefined,
    } = {}
  ) {
    if (typeof fetchApi !== "function") {
      throw new Error("ReadingLog 앱 연결을 지원하지 않습니다.");
    }
    const jsonText = String(payload?.jsonText || "");
    const filenameBase = String(payload?.filenameBase || "roll20-chat").trim() || "roll20-chat";
    const jsonByteLength =
      Number(payload?.jsonByteLength) > 0 ? Number(payload.jsonByteLength) : jsonText.length;
    const lineCount = Math.max(0, Number(payload?.lineCount) || 0);
    const chunks = splitJsonTextIntoChunks(jsonText, chunkSize);

    const startResponse = await fetchApi(`${baseUrl}/imports/json/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: filenameBase,
        jsonByteLength,
        lineCount,
        chunkCount: chunks.length,
      }),
    });
    if (!startResponse?.ok) {
      throw new Error("ReadingLog 앱으로 데이터를 보내는 중 오류가 발생했습니다.");
    }
    const startPayload = await readJsonResponse(startResponse);
    const transferId = String(startPayload?.transferId || "").trim();
    if (!transferId) {
      throw new Error("ReadingLog 앱으로 데이터를 보내는 중 오류가 발생했습니다.");
    }

    for (let index = 0; index < chunks.length; index += 1) {
      const chunkResponse = await fetchApi(`${baseUrl}/imports/json/chunk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transferId,
          index,
          chunkCount: chunks.length,
          data: chunks[index],
        }),
      });
      if (!chunkResponse?.ok) {
        throw new Error("ReadingLog 앱으로 데이터를 보내는 중 오류가 발생했습니다.");
      }
      const completedRatio = (index + 1) / chunks.length;
      const percent = Math.min(99, Math.max(50, 50 + Math.floor(completedRatio * 49)));
      const detail =
        index + 1 >= chunks.length
          ? "ReadingLog 앱으로 전송을 마무리하고 있습니다."
          : `ReadingLog 앱으로 데이터를 전송하고 있습니다. (${index + 1}/${chunks.length})`;
      await reportProgress(percent, detail);
    }

    const finishResponse = await fetchApi(`${baseUrl}/imports/json/finish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transferId,
      }),
    });
    if (!finishResponse?.ok) {
      throw new Error("ReadingLog 앱으로 데이터를 보내는 중 오류가 발생했습니다.");
    }
    return {
      ok: true,
      transferId,
    };
  }

  async function startReadingLogTransferInBackground({
    exportMessage = {
      type: FIREFOX_EXPORT_JSON_MESSAGE,
    },
    skipWakeApp = false,
    createSessionId = createTransferSessionId,
    reportProgress = async () => undefined,
    cleanupReadingLogWakeTabs: cleanupWakeTabs = () => cleanupReadingLogWakeTabs(),
    openReadingLogApp = (url) => openReadingLogAppInBackground(url),
    closeReadingLogWakeTab: closeWakeTab = (wakeTabId) => closeReadingLogWakeTab(wakeTabId),
    waitForReadingLogReady: waitUntilReady = () => waitForReadingLogReady(),
    tabsApi = typeof browser !== "undefined" ? browser.tabs : null,
    streamToReadingLog = (payload) => streamToReadingLogInBackground(payload, { reportProgress }),
  } = {}) {
    const sessionId = String(
      typeof createSessionId === "function" ? createSessionId() : createTransferSessionId()
    ).trim();
    await reportProgress(5, "현재 열려 있는 Roll20 탭을 확인하고 있습니다.");
    const [tab] = await tabsApi.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("현재 열려 있는 Roll20 탭을 찾지 못했습니다.");
    }
    await cleanupWakeTabs();
    let wakeTabId = null;
    let wakeTabClosed = true;
    try {
      if (!skipWakeApp) {
        await reportProgress(15, "ReadingLog 앱을 열고 있습니다.");
        const wakeResult = await openReadingLogApp(buildReadingLogWakeUrl());
        wakeTabId = Number(wakeResult?.wakeTabId);
        wakeTabClosed = false;
      }
      await reportProgress(25, "ReadingLog 앱 준비를 확인하고 있습니다.");
      await waitUntilReady();
      if (!wakeTabClosed) {
        await closeWakeTab(wakeTabId);
        wakeTabClosed = true;
      }
      await reportProgress(35, "Roll20 페이지에 JSON 생성을 요청하고 있습니다.");
      const response = await tabsApi.sendMessage(tab.id, {
        ...exportMessage,
        delivery: "background-readinglog-transfer",
        sessionId,
      });
      if (!response?.ok) {
        throw new Error(response?.errorMessage || "Roll20 탭에서 JSON을 만들지 못했습니다.");
      }
      await reportProgress(45, "ReadingLog 앱으로 보낼 데이터를 정리하고 있습니다.");
      const result = await streamToReadingLog({
        jsonText: String(response.jsonText || ""),
        filenameBase: String(response.filenameBase || "roll20-chat"),
        jsonByteLength: Number(response.jsonByteLength) || 0,
        lineCount: Number(response.lineCount) || 0,
      });
      return {
        ok: true,
        accepted: true,
        sessionId,
        transferId: result?.transferId || "",
        filenameBase: String(response.filenameBase || "roll20-chat"),
        jsonByteLength: Number(response.jsonByteLength) || 0,
        lineCount: Number(response.lineCount) || 0,
      };
    } finally {
      if (!wakeTabClosed) {
        await closeWakeTab(wakeTabId);
      }
    }
  }

  function startDownloadStream({ sessionId = "", filenameBase = "roll20-chat" } = {}) {
    const safeSessionId = String(sessionId || "").trim();
    if (!safeSessionId) {
      throw new Error("다운로드 세션을 시작하지 못했습니다.");
    }
    downloadStreams.set(safeSessionId, {
      filenameBase: String(filenameBase || "roll20-chat"),
      parts: [],
    });
    return { ok: true };
  }

  function appendDownloadStreamChunk({ sessionId = "", chunkText = "" } = {}) {
    const safeSessionId = String(sessionId || "").trim();
    const session = downloadStreams.get(safeSessionId);
    if (!session) {
      throw new Error("다운로드 세션을 찾지 못했습니다.");
    }
    session.parts.push(String(chunkText || ""));
    return { ok: true };
  }

  async function finishDownloadStream(
    { sessionId = "" } = {},
    { reportProgress = async () => undefined } = {}
  ) {
    const safeSessionId = String(sessionId || "").trim();
    const session = downloadStreams.get(safeSessionId);
    if (!session) {
      throw new Error("다운로드 세션을 찾지 못했습니다.");
    }
    downloadStreams.delete(safeSessionId);
    return downloadJsonPartsPayload({
      parts: session.parts,
      filenameBase: session.filenameBase,
    }, {
      reportProgress,
    });
  }

  function createBackgroundMessageHandler({
    handleReadingLogTransferStart = (message) =>
      startReadingLogTransferInBackground({
        exportMessage: message?.exportMessage || {
          type: FIREFOX_EXPORT_JSON_MESSAGE,
        },
        skipWakeApp: message?.skipWakeApp === true,
        reportProgress: createReadingLogProgressReporter({
          sessionId:
            typeof message?.sessionId === "string" && message.sessionId.trim()
              ? message.sessionId
              : createTransferSessionId(),
        }),
      }),
  } = {}) {
    return async (message) => {
      try {
        if (message?.type === FIREFOX_START_READINGLOG_TRANSFER_MESSAGE) {
          return await handleReadingLogTransferStart(message);
        }
        if (message?.type === FIREFOX_DOWNLOAD_JSON_MESSAGE) {
          return await downloadJsonPayload({
            jsonText: message?.jsonText || "",
            filenameBase: message?.filenameBase || "roll20-chat",
          }, {
            reportProgress: createStreamProgressReporter({
              sessionId: message?.sessionId || "",
            }),
          });
        }
        if (message?.type === FIREFOX_DOWNLOAD_STREAM_START_MESSAGE) {
          return startDownloadStream({
            sessionId: message?.sessionId || "",
            filenameBase: message?.filenameBase || "roll20-chat",
          });
        }
        if (message?.type === FIREFOX_DOWNLOAD_STREAM_CHUNK_MESSAGE) {
          return appendDownloadStreamChunk({
            sessionId: message?.sessionId || "",
            chunkText: message?.chunkText || "",
          });
        }
        if (message?.type === FIREFOX_DOWNLOAD_STREAM_FINISH_MESSAGE) {
          return await finishDownloadStream({
            sessionId: message?.sessionId || "",
          }, {
            reportProgress: createStreamProgressReporter({
              sessionId: message?.sessionId || "",
            }),
          });
        }
        return undefined;
      } catch (error) {
        const fallbackMessage =
          message?.type === FIREFOX_START_READINGLOG_TRANSFER_MESSAGE
            ? "ReadingLog 앱 전송을 시작하지 못했습니다."
            : "다운로드를 시작하지 못했습니다.";
        return {
          ok: false,
          errorMessage: normalizeFirefoxMobileErrorMessage(
            error,
            fallbackMessage
          ),
        };
      }
    };
  }

  if (typeof browser !== "undefined" && browser.runtime?.onInstalled) {
    browser.runtime.onInstalled.addListener(() => {
      browser.storage?.local?.set?.({
        firefoxMobileShellReady: true,
      });
      cleanupReadingLogWakeTabs().catch(() => undefined);
    });
  }

  if (typeof browser !== "undefined" && browser.runtime?.onMessage) {
    cleanupReadingLogWakeTabs().catch(() => undefined);
    browser.runtime.onMessage.addListener(createBackgroundMessageHandler());
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      FIREFOX_DOWNLOAD_JSON_MESSAGE,
      FIREFOX_EXPORT_PROGRESS_MESSAGE,
      FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
      FIREFOX_EXPORT_JSON_MESSAGE,
      FIREFOX_DOWNLOAD_STREAM_START_MESSAGE,
      FIREFOX_DOWNLOAD_STREAM_CHUNK_MESSAGE,
      FIREFOX_DOWNLOAD_STREAM_FINISH_MESSAGE,
      buildReadingLogWakeUrl,
      READINGLOG_ANDROID_LEGACY_INTENT_URL,
      cleanupReadingLogWakeTabs,
      createTransferSessionId,
      isFilenameConstraintError,
      buildDownloadFilename,
      buildFallbackDownloadFilename,
      scheduleObjectUrlRevoke,
      downloadJsonPartsPayload,
      downloadJsonPayload,
      createStreamProgressReporter,
      createReadingLogProgressReporter,
      openReadingLogAppInBackground,
      closeReadingLogWakeTab,
      waitForReadingLogReady,
      splitJsonTextIntoChunks,
      readJsonResponse,
      streamToReadingLogInBackground,
      startReadingLogTransferInBackground,
      startDownloadStream,
      appendDownloadStreamChunk,
      finishDownloadStream,
      normalizeFirefoxMobileErrorMessage,
      createBackgroundMessageHandler,
    };
  }
})();
