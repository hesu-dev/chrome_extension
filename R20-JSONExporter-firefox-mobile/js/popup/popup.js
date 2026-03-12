const FIREFOX_PING_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_PING";
const FIREFOX_EXPORT_JSON_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON";
const FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE =
  "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS";
const FIREFOX_GET_AVATAR_MAPPINGS_MESSAGE =
  "R20_JSON_EXPORTER_FIREFOX_GET_AVATAR_MAPPINGS";
const FIREFOX_DOWNLOAD_JSON_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_JSON";
const FIREFOX_EXPORT_PROGRESS_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_EXPORT_PROGRESS";
const FIREFOX_START_READINGLOG_TRANSFER_MESSAGE =
  "R20_JSON_EXPORTER_FIREFOX_START_READINGLOG_TRANSFER";
const FIREFOX_OPEN_READINGLOG_APP_MESSAGE =
  "R20_JSON_EXPORTER_FIREFOX_OPEN_READINGLOG_APP";
const READINGLOG_LOCALHOST_BASE_URL = "http://127.0.0.1:37845";
const READINGLOG_ANDROID_DEEPLINK_URL =
  "readinglog://imports/json";
const READINGLOG_CLIPBOARD_SHARE_MARKER_TEXT = "readinglog-clipboard-import";
const READINGLOG_CLIPBOARD_SHARE_TITLE = "ReadingLog 클립보드 가져오기";
const READINGLOG_DIRECT_TEXT_SHARE_TITLE = "ReadingLog JSON 가져오기";
const READINGLOG_DIRECT_TEXT_SHARE_MAX_BYTES = 256 * 1024;
const READINGLOG_APP_OPEN_BLOCKED_MESSAGE =
  "브라우저가 ReadingLog 앱 열기를 막고 있습니다.";
const avatarDownloadPlan =
  typeof window !== "undefined" ? window.Roll20CleanerAvatarDownloadPlan || {} : {};
const avatarPreview =
  typeof window !== "undefined" ? window.Roll20CleanerAvatarPreview || {} : {};
const statusEl = typeof document !== "undefined" ? document.getElementById("status") : null;
const imageCheckButtonEl =
  typeof document !== "undefined" ? document.getElementById("downloadTest2") : null;
const readingLogDownloadButtonEl =
  typeof document !== "undefined" ? document.getElementById("downloadReadingLogJson") : null;
const readingLogShareButtonEl =
  typeof document !== "undefined" ? document.getElementById("shareReadingLogJson") : null;
const exportProgressWrapEl =
  typeof document !== "undefined" ? document.getElementById("exportProgressWrap") : null;
const exportProgressBarEl =
  typeof document !== "undefined" ? document.getElementById("exportProgressBar") : null;
const exportProgressLabelEl =
  typeof document !== "undefined" ? document.getElementById("exportProgressLabel") : null;
const exportMetaEl =
  typeof document !== "undefined" ? document.getElementById("exportMeta") : null;
const avatarEditorEl =
  typeof document !== "undefined" ? document.getElementById("avatarEditor") : null;
const avatarListEl =
  typeof document !== "undefined" ? document.getElementById("avatarList") : null;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function normalizeFirefoxMobileErrorMessage(error, fallbackMessage) {
  const fallback = String(fallbackMessage || "처리 중 오류가 발생했습니다.");
  const rawMessage = String(error?.message || error || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!rawMessage) return fallback;

  const normalized = rawMessage.toLowerCase();
  if (
    normalized.includes("could not establish connection") ||
    normalized.includes("receiving end does not exist") ||
    normalized.includes("message port closed before a response was received")
  ) {
    return "Roll20 탭 응답이 없습니다. 탭을 새로고침한 뒤 다시 시도하세요.";
  }
  if (
    normalized.includes("filename must") ||
    normalized.includes("invalid filename") ||
    normalized.includes("illegal characters") ||
    normalized.includes("path is invalid")
  ) {
    return "파일 이름에 사용할 수 없는 문자가 포함되어 있습니다.";
  }
  if (
    normalized.includes("share failed") ||
    normalized.includes("share blocked") ||
    normalized.includes("aborterror") ||
    normalized.includes("notallowederror")
  ) {
    return "파일 공유를 완료하지 못했습니다.";
  }
  if (normalized.includes("downloads blocked")) {
    return "파일 저장이 차단되었습니다.";
  }
  return rawMessage || fallback;
}

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

function buildSafeJsonFilename(filenameBase) {
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

function buildFallbackJsonFilename(filenameBase) {
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

function clampProgressPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function createExportSessionId() {
  return `firefox-mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  const safeTimeoutMs = Math.max(1, Number(timeoutMs) || 1);
  let timerId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, safeTimeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
  });
}

function setExportProgress(percent, detail = "") {
  const safePercent = clampProgressPercent(percent);
  if (exportProgressWrapEl) exportProgressWrapEl.hidden = false;
  if (exportProgressBarEl) exportProgressBarEl.value = safePercent;
  if (exportProgressLabelEl) {
    exportProgressLabelEl.textContent = detail
      ? `${safePercent}% · ${String(detail)}`
      : `${safePercent}%`;
  }
}

function resetExportProgress() {
  if (exportProgressBarEl) exportProgressBarEl.value = 0;
  if (exportProgressLabelEl) exportProgressLabelEl.textContent = "0%";
  if (exportProgressWrapEl) exportProgressWrapEl.hidden = true;
}

function formatByteSize(byteLength) {
  const numeric = Number(byteLength);
  if (!Number.isFinite(numeric) || numeric <= 0) return "0B";
  if (numeric < 1024) return `${Math.round(numeric)}B`;
  if (numeric < 1024 * 1024) return `${(numeric / 1024).toFixed(1)}KB`;
  return `${(numeric / (1024 * 1024)).toFixed(2)}MB`;
}

function measureTextByteLength(text) {
  const safeText = String(text || "");
  if (typeof TextEncoder === "function") {
    return new TextEncoder().encode(safeText).length;
  }
  if (typeof Blob !== "undefined") {
    return new Blob([safeText]).size;
  }
  return safeText.length;
}

function buildExportMetaText({ byteLength = 0, lineCount = 0 } = {}) {
  const parts = [];
  if (Number(byteLength) > 0) {
    parts.push(`예상 파일 크기 ${formatByteSize(byteLength)}`);
  }
  if (Number(lineCount) > 0) {
    parts.push(`대사 ${lineCount}개`);
  }
  return parts.join(" · ");
}

function setExportMeta(meta = {}) {
  if (!exportMetaEl) return;
  const text = buildExportMetaText(meta);
  exportMetaEl.textContent = text;
  exportMetaEl.hidden = !text;
}

function resetExportMeta() {
  if (!exportMetaEl) return;
  exportMetaEl.textContent = "";
  exportMetaEl.hidden = true;
}

function resolveFileStageTimeoutMs({
  byteLength = 0,
  baseTimeoutMs = 15000,
} = {}) {
  const safeBaseTimeoutMs = Math.max(5000, Number(baseTimeoutMs) || 15000);
  const safeByteLength = Math.max(0, Number(byteLength) || 0);
  const megaBytes = safeByteLength / (1024 * 1024);
  const paddedTimeoutMs =
    safeBaseTimeoutMs +
    Math.min(60000, Math.ceil(megaBytes) * 10000) +
    (safeByteLength >= 512 * 1024 ? 5000 : 0);
  return Math.min(90000, paddedTimeoutMs);
}

function resolveContentBuildTimeoutMs({
  preferredAction = "download",
  baseTimeoutMs = 60000,
} = {}) {
  const safeBaseTimeoutMs = Math.max(10000, Number(baseTimeoutMs) || 60000);
  if (preferredAction === "download") {
    return Math.max(safeBaseTimeoutMs, 600000);
  }
  return Math.max(safeBaseTimeoutMs, 90000);
}

function subscribeToExportProgress({
  browserApi = typeof browser !== "undefined" ? browser : null,
  sessionId = "",
  setProgress = () => {},
  setStatus = () => {},
  setMeta = () => {},
} = {}) {
  const onMessage = browserApi?.runtime?.onMessage;
  if (
    typeof onMessage?.addListener !== "function" ||
    typeof onMessage?.removeListener !== "function" ||
    !sessionId
  ) {
    return () => {};
  }

  const listener = (message) => {
    if (message?.type !== FIREFOX_EXPORT_PROGRESS_MESSAGE) return undefined;
    if (String(message?.sessionId || "") !== sessionId) return undefined;
    const detail = String(message?.detail || "").trim();
    setProgress(Number(message?.percent || 0), detail);
    const jsonByteLength = Number(message?.jsonByteLength || 0);
    const lineCount = Number(message?.lineCount || 0);
    if (jsonByteLength > 0 || lineCount > 0) {
      setMeta({ byteLength: jsonByteLength, lineCount });
    }
    if (detail) {
      setStatus(detail);
    }
    return undefined;
  };

  onMessage.addListener(listener);
  return () => {
    try {
      onMessage.removeListener(listener);
    } catch (error) {
      // Ignore popup listener cleanup failures.
    }
  };
}

function getFirefoxExportAction({
  canDownload = true,
  canShare = false,
  canShareText = false,
  canPostToLocalhost = false,
  canOpenReadingLogApp = false,
  canWriteClipboard = false,
  preferredAction = "download",
} = {}) {
  if (preferredAction === "share-text-direct") {
    if (!canShareText) {
      throw new Error("텍스트 공유를 지원하지 않습니다.");
    }
    return {
      primary: "share-text-direct",
      fallbacks: [],
    };
  }

  if (preferredAction === "clipboard-share-marker") {
    if (!canWriteClipboard) {
      throw new Error("클립보드 복사를 지원하지 않습니다.");
    }
    return {
      primary: "clipboard-share-marker",
      fallbacks: [],
    };
  }

  if (preferredAction === "deeplink-localhost") {
    if (!canOpenReadingLogApp) {
      throw new Error("ReadingLog 앱을 열 수 없습니다.");
    }
    if (!canPostToLocalhost) {
      throw new Error("ReadingLog 앱 연결을 지원하지 않습니다.");
    }
    return {
      primary: "deeplink-localhost",
      fallbacks: [],
    };
  }

  if (preferredAction === "localhost-post") {
    if (!canPostToLocalhost) {
      throw new Error("ReadingLog 앱 연결을 지원하지 않습니다.");
    }
    return {
      primary: "localhost-post",
      fallbacks: [],
    };
  }

  if (preferredAction === "share-file") {
    if (!canShare) {
      throw new Error("파일 공유를 지원하지 않습니다.");
    }
    return {
      primary: "share-file",
      fallbacks: [],
    };
  }

  if (!canDownload) {
    throw new Error("파일 저장을 지원하지 않습니다.");
  }
  return {
    primary: "download",
    fallbacks: [],
  };
}

function canUseDownloadsApi(browserApi = typeof browser !== "undefined" ? browser : null) {
  return typeof browserApi?.downloads?.download === "function";
}

function canUseLocalhostTransfer(fetchApi = typeof fetch !== "undefined" ? fetch : null) {
  return typeof fetchApi === "function";
}

function buildReadingLogWakeUrl() {
  return READINGLOG_ANDROID_DEEPLINK_URL;
}

async function waitForPopupHiddenAfterDeepLinkAttempt(
  {
    documentApi = typeof document !== "undefined" ? document : null,
    windowApi = typeof window !== "undefined" ? window : null,
    wait = sleep,
    timeoutMs = 200,
  } = {}
) {
  const supportsObservation =
    typeof documentApi?.addEventListener === "function" ||
    typeof windowApi?.addEventListener === "function";

  if (!supportsObservation) {
    return true;
  }

  const isHidden = () =>
    documentApi?.visibilityState === "hidden" ||
    documentApi?.hidden === true ||
    documentApi?.webkitHidden === true;

  if (isHidden()) {
    return true;
  }

  return new Promise((resolve) => {
    let settled = false;
    const cleanupCallbacks = [];

    const settle = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      while (cleanupCallbacks.length > 0) {
        const cleanup = cleanupCallbacks.pop();
        try {
          cleanup?.();
        } catch (_error) {
          // Best-effort cleanup only.
        }
      }
      resolve(Boolean(value));
    };

    const register = (target, eventName, handler) => {
      if (typeof target?.addEventListener !== "function") {
        return;
      }
      target.addEventListener(eventName, handler, { once: true });
      cleanupCallbacks.push(() => {
        if (typeof target.removeEventListener === "function") {
          target.removeEventListener(eventName, handler, { once: true });
        }
      });
    };

    const hiddenHandler = () => settle(true);
    register(documentApi, "visibilitychange", hiddenHandler);
    register(windowApi, "pagehide", hiddenHandler);
    register(windowApi, "blur", hiddenHandler);

    Promise.resolve(wait(timeoutMs))
      .then(() => settle(isHidden()))
      .catch(() => settle(isHidden()));
  });
}

async function openReadingLogApp(
  deeplinkUrl = buildReadingLogWakeUrl(),
  {
    windowApi = typeof window !== "undefined" ? window : null,
    browserApi = typeof browser !== "undefined" ? browser : null,
    documentApi = typeof document !== "undefined" ? document : null,
    waitForPopupHidden = (options) => waitForPopupHiddenAfterDeepLinkAttempt(options),
    logger = typeof console !== "undefined" ? console : null,
    onAttempt = () => {},
    onFallback = () => {},
    onSuccess = () => {},
  } = {}
) {
  const safeUrl = String(deeplinkUrl || "").trim();
  if (!safeUrl) {
    throw new Error("ReadingLog 앱을 열 수 없습니다.");
  }

  const attempt = async (label, run) => {
    onAttempt(label);
    logger?.info?.(`[ReadingLog] popup deeplink 시도: ${label}`);
    await run();
    const hidden = await waitForPopupHidden({
      documentApi,
      windowApi,
    });
    if (hidden) {
      onSuccess(label);
      logger?.info?.(`[ReadingLog] popup deeplink 성공 추정: ${label}`);
      return true;
    }
    onFallback(label);
    logger?.warn?.(`[ReadingLog] popup deeplink 반응 없음, 다음 방식으로 전환: ${label}`);
    return false;
  };

  if (
    typeof documentApi?.createElement === "function" &&
    documentApi?.body &&
    typeof documentApi.body.appendChild === "function"
  ) {
    const didOpen = await attempt("anchor.click", async () => {
      const anchor = documentApi.createElement("a");
      anchor.href = safeUrl;
      anchor.rel = "noopener";
      if (anchor.style && typeof anchor.style === "object") {
        anchor.style.display = "none";
      }
      documentApi.body.appendChild(anchor);
      try {
        if (typeof anchor.click === "function") {
          anchor.click();
          return;
        }
        throw new Error("ReadingLog 앱을 열 수 없습니다.");
      } finally {
        if (typeof anchor.remove === "function") {
          anchor.remove();
        }
      }
    });
    if (didOpen) {
      return safeUrl;
    }
  }
  if (typeof windowApi?.location?.assign === "function") {
    const didOpen = await attempt("location.assign", async () => {
      windowApi.location.assign(safeUrl);
    });
    if (didOpen) {
      return safeUrl;
    }
  }
  if (typeof windowApi?.open === "function") {
    const didOpen = await attempt("window.open", async () => {
      windowApi.open(safeUrl, "_blank");
    });
    if (didOpen) {
      return safeUrl;
    }
  }
  throw new Error(READINGLOG_APP_OPEN_BLOCKED_MESSAGE);
}

function sleep(delayMs = 0) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
  });
}

async function probeReadingLogLocalhost(
  fetchApi = typeof fetch !== "undefined" ? fetch : null,
  baseUrl = READINGLOG_LOCALHOST_BASE_URL
) {
  if (!canUseLocalhostTransfer(fetchApi)) {
    throw new Error("ReadingLog 앱 연결을 지원하지 않습니다.");
  }
  const response = await fetchApi(`${baseUrl}/health`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response?.ok) {
    throw new Error("ReadingLog 앱이 준비되지 않았습니다.");
  }
  return response;
}

async function waitForReadingLogLocalhostReady({
  openReadingLogApp: openApp = (url) => openReadingLogApp(url),
  probeLocalhost = async () => {
    try {
      await probeReadingLogLocalhost();
      return true;
    } catch (error) {
      return false;
    }
  },
  wait = sleep,
  deeplinkUrl = buildReadingLogWakeUrl(),
  maxAttempts = 20,
  pollIntervalMs = 300,
} = {}) {
  if (typeof openApp !== "function") {
    throw new Error("ReadingLog 앱을 열 수 없습니다.");
  }
  await openApp(deeplinkUrl);
  const attemptsLimit = Math.max(1, Number(maxAttempts) || 1);
  for (let attempt = 1; attempt <= attemptsLimit; attempt += 1) {
    if (await probeLocalhost()) {
      return {
        ok: true,
        attempts: attempt,
        deeplinkUrl,
      };
    }
    if (attempt < attemptsLimit) {
      await wait(pollIntervalMs);
    }
  }
  throw new Error(READINGLOG_APP_OPEN_BLOCKED_MESSAGE);
}

async function postReadingLogJsonToLocalhost(
  payload,
  {
    fetchApi = typeof fetch !== "undefined" ? fetch : null,
    baseUrl = READINGLOG_LOCALHOST_BASE_URL,
  } = {}
) {
  if (!canUseLocalhostTransfer(fetchApi)) {
    throw new Error("ReadingLog 앱 연결을 지원하지 않습니다.");
  }
  const body = JSON.stringify({
    filename: payloadFilenameBase(payload?.filenameBase),
    jsonText: String(payload?.jsonText || ""),
    jsonByteLength: measureTextByteLength(payload?.jsonText || ""),
  });
  const response = await fetchApi(`${baseUrl}/imports/json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
  if (!response?.ok) {
    throw new Error("ReadingLog 앱으로 보내지 못했습니다.");
  }
  return response;
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

async function streamReadingLogJsonToLocalhost(
  payload,
  {
    fetchApi = typeof fetch !== "undefined" ? fetch : null,
    baseUrl = READINGLOG_LOCALHOST_BASE_URL,
    chunkSize = 256 * 1024,
    onChunkProgress = () => {},
  } = {}
) {
  if (!canUseLocalhostTransfer(fetchApi)) {
    throw new Error("ReadingLog 앱 연결을 지원하지 않습니다.");
  }
  const jsonText = String(payload?.jsonText || "");
  const filename = payloadFilenameBase(payload?.filenameBase);
  const lineCount = Math.max(0, Number(payload?.lineCount) || 0);
  const chunks = splitJsonTextIntoChunks(jsonText, chunkSize);

  const startResponse = await fetchApi(`${baseUrl}/imports/json/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename,
      jsonByteLength: measureTextByteLength(jsonText),
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
    await onChunkProgress(percent, detail);
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
    filename,
  };
}

async function startReadingLogTransferFromPopup({
  browserApi = typeof browser !== "undefined" ? browser : null,
  exportMessage = {
    type: FIREFOX_EXPORT_JSON_MESSAGE,
  },
  sessionId = "",
  skipWakeApp = false,
} = {}) {
  if (typeof browserApi?.runtime?.sendMessage !== "function") {
    throw new Error("ReadingLog 전송을 시작할 수 없습니다.");
  }
  const result = await browserApi.runtime.sendMessage({
    type: FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
    exportMessage,
    sessionId: String(sessionId || "").trim(),
    ...(skipWakeApp === true ? { skipWakeApp: true } : {}),
  });
  if (result?.ok === false) {
    throw new Error(
      String(result?.errorMessage || "ReadingLog 앱 전송에 실패했습니다.")
    );
  }
  return result;
}

async function openReadingLogAppFromActiveTab({
  browserApi = typeof browser !== "undefined" ? browser : null,
  deeplinkUrl = buildReadingLogWakeUrl(),
} = {}) {
  if (
    typeof browserApi?.tabs?.query !== "function" ||
    typeof browserApi?.tabs?.sendMessage !== "function"
  ) {
    throw new Error("ReadingLog 앱을 열 수 없습니다.");
  }
  const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("현재 열려 있는 Roll20 탭을 찾지 못했습니다.");
  }
  const response = await browserApi.tabs.sendMessage(tab.id, {
    type: FIREFOX_OPEN_READINGLOG_APP_MESSAGE,
    deeplinkUrl: String(deeplinkUrl || "").trim(),
  });
  if (response?.ok === false || !String(response?.deeplinkUrl || "").trim()) {
    throw new Error(String(response?.errorMessage || "ReadingLog 앱을 열 수 없습니다."));
  }
  return response;
}

async function openReadingLogAppAndStartTransferFromPopup({
  browserApi = typeof browser !== "undefined" ? browser : null,
  exportMessage = {
    type: FIREFOX_EXPORT_JSON_MESSAGE,
  },
  sessionId = "",
  setStatusText = () => {},
  setProgress = () => {},
  openReadingLogApp: openApp = (deeplinkUrl) =>
    openReadingLogApp(deeplinkUrl, {
      browserApi,
      onAttempt(label) {
        if (label === "anchor.click") {
          setStatusText("1차로 ReadingLog 앱 열기를 시도하고 있습니다.");
          setProgress(8, "1차 앱 열기 시도 중");
          return;
        }
        if (label === "location.assign") {
          setStatusText("2차로 ReadingLog 앱 열기를 다시 시도하고 있습니다.");
          setProgress(10, "2차 앱 열기 시도 중");
          return;
        }
        if (label === "window.open") {
          setStatusText("3차로 ReadingLog 앱 열기를 다시 시도하고 있습니다.");
          setProgress(12, "3차 앱 열기 시도 중");
        }
      },
      onFallback(label) {
        if (label === "anchor.click") {
          setStatusText("1차 앱 열기 반응이 없어 다른 방식으로 다시 시도합니다.");
          return;
        }
        if (label === "location.assign") {
          setStatusText("2차 앱 열기 반응이 없어 마지막 방식으로 다시 시도합니다.");
          return;
        }
        if (label === "window.open") {
          setStatusText("브라우저가 ReadingLog 앱 열기를 막고 있습니다.");
        }
      },
      onSuccess(label) {
        if (label === "anchor.click") {
          setStatusText("ReadingLog 앱 열기를 요청했습니다.");
          setProgress(15, "앱 열기 요청 완료");
          return;
        }
        if (label === "location.assign") {
          setStatusText("2차 방식으로 ReadingLog 앱 열기를 요청했습니다.");
          setProgress(15, "앱 열기 요청 완료");
          return;
        }
        if (label === "window.open") {
          setStatusText("3차 방식으로 ReadingLog 앱 열기를 요청했습니다.");
          setProgress(15, "앱 열기 요청 완료");
        }
      },
    }),
} = {}) {
  const deeplinkUrl = buildReadingLogWakeUrl();
  await openApp(deeplinkUrl);
  return startReadingLogTransferFromPopup({
    browserApi,
    exportMessage,
    sessionId,
    skipWakeApp: true,
  });
}

function canUseFileShareApi(
  navigatorApi = typeof navigator !== "undefined" ? navigator : null,
  FileCtor = typeof File !== "undefined" ? File : null
) {
  return typeof navigatorApi?.share === "function" && typeof FileCtor === "function";
}

function canUseTextShareApi(navigatorApi = typeof navigator !== "undefined" ? navigator : null) {
  return typeof navigatorApi?.share === "function";
}

function canUseClipboardWriteApi(
  navigatorApi = typeof navigator !== "undefined" ? navigator : null,
  documentApi = typeof document !== "undefined" ? document : null
) {
  return (
    typeof navigatorApi?.clipboard?.writeText === "function" ||
    (typeof documentApi?.createElement === "function" &&
      typeof documentApi?.execCommand === "function" &&
      !!documentApi?.body &&
      typeof documentApi.body.appendChild === "function")
  );
}

async function writeTextToClipboard(
  text,
  {
    navigatorApi = typeof navigator !== "undefined" ? navigator : null,
    documentApi = typeof document !== "undefined" ? document : null,
  } = {}
) {
  const safeText = String(text || "");
  if (typeof navigatorApi?.clipboard?.writeText === "function") {
    await navigatorApi.clipboard.writeText(safeText);
    return;
  }

  if (
    typeof documentApi?.createElement === "function" &&
    typeof documentApi?.execCommand === "function" &&
    documentApi?.body &&
    typeof documentApi.body.appendChild === "function"
  ) {
    const textarea = documentApi.createElement("textarea");
    textarea.value = safeText;
    if (textarea.style && typeof textarea.style === "object") {
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
    }
    documentApi.body.appendChild(textarea);
    try {
      if (typeof textarea.focus === "function") textarea.focus();
      if (typeof textarea.select === "function") textarea.select();
      const copied = documentApi.execCommand("copy");
      if (!copied) {
        throw new Error("클립보드에 복사하지 못했습니다.");
      }
      return;
    } finally {
      if (typeof textarea.remove === "function") {
        textarea.remove();
      }
    }
  }

  throw new Error("클립보드 복사를 지원하지 않습니다.");
}

function buildClipboardSharePayload() {
  return {
    title: READINGLOG_CLIPBOARD_SHARE_TITLE,
    text: READINGLOG_CLIPBOARD_SHARE_MARKER_TEXT,
  };
}

function buildDirectTextSharePayload(text) {
  return {
    title: READINGLOG_DIRECT_TEXT_SHARE_TITLE,
    text: String(text || ""),
  };
}

function buildJsonShareFile(
  { jsonText = "", filenameBase = "roll20-chat" } = {},
  {
    FileCtor = typeof File !== "undefined" ? File : null,
    useFallbackFilename = false,
  } = {}
) {
  if (typeof FileCtor !== "function") {
    throw new Error("파일 공유 생성기를 찾지 못했습니다.");
  }
  const safeBase = payloadFilenameBase(filenameBase);
  const filename = useFallbackFilename
    ? buildFallbackJsonFilename(safeBase)
    : buildSafeJsonFilename(safeBase);
  return new FileCtor([String(jsonText || "")], filename, {
    type: "application/json",
  });
}

function buildStageFailureMessage(stage, error) {
  const reason = normalizeFirefoxMobileErrorMessage(error, "");
  if (stage === "download") {
    return reason
      ? `JSON 생성은 완료되었지만 파일 저장에 실패했습니다. ${reason}`
      : "JSON 생성은 완료되었지만 파일 저장에 실패했습니다.";
  }
  if (stage === "share-file") {
    return reason
      ? `JSON 생성은 완료되었지만 파일 공유에 실패했습니다. ${reason}`
      : "JSON 생성은 완료되었지만 파일 공유에 실패했습니다.";
  }
  if (stage === "clipboard-share-marker") {
    return reason
      ? `JSON 생성은 완료되었지만 클립보드 복사에 실패했습니다. ${reason}`
      : "JSON 생성은 완료되었지만 클립보드 복사에 실패했습니다.";
  }
  if (stage === "share-text-direct") {
    if (reason.includes("텍스트 공유를 지원하지 않습니다.")) {
      return "이 기기에서는 JSON 텍스트 공유를 지원하지 않습니다.";
    }
    if (reason.includes("텍스트 공유로 보내기에는 JSON 크기가 너무 큽니다.")) {
      return reason;
    }
    return reason
      ? `JSON 생성은 완료되었지만 ReadingLog 앱으로 텍스트를 보내지 못했습니다. ${reason}`
      : "JSON 생성은 완료되었지만 ReadingLog 앱으로 텍스트를 보내지 못했습니다.";
  }
  if (stage === "deeplink-localhost") {
    if (
      reason.includes(READINGLOG_APP_OPEN_BLOCKED_MESSAGE) ||
      reason.includes("ReadingLog 앱이 준비되지 않았습니다.")
    ) {
      return READINGLOG_APP_OPEN_BLOCKED_MESSAGE;
    }
    return reason
      ? `JSON 생성은 완료되었지만 ReadingLog 앱으로 보내지 못했습니다. ${reason}`
      : "JSON 생성은 완료되었지만 ReadingLog 앱으로 보내지 못했습니다.";
  }
  if (stage === "localhost-post") {
    if (reason.includes("ReadingLog 앱이 준비되지 않았습니다.")) {
      return "ReadingLog 앱이 준비되지 않았습니다.";
    }
    return reason
      ? `JSON 생성은 완료되었지만 ReadingLog 앱으로 보내지 못했습니다. ${reason}`
      : "JSON 생성은 완료되었지만 ReadingLog 앱으로 보내지 못했습니다.";
  }
  return reason || "JSON 내보내기에 실패했습니다.";
}

function payloadFilenameBase(filenameBase) {
  return String(filenameBase || "roll20-chat").trim() || "roll20-chat";
}

function validateReadingLogDirectTextShareSize(jsonByteLength) {
  const safeByteLength = Math.max(0, Number(jsonByteLength) || 0);
  if (safeByteLength <= READINGLOG_DIRECT_TEXT_SHARE_MAX_BYTES) {
    return;
  }
  throw new Error(
    `텍스트 공유로 보내기에는 JSON 크기가 너무 큽니다. 현재 예상 크기는 ${formatByteSize(
      safeByteLength
    )}입니다.`
  );
}

async function performExportAction(
  action,
  payload,
  {
    browserApi,
    navigatorApi,
    FileCtor,
    fetchApi = typeof fetch !== "undefined" ? fetch : null,
    documentApi = typeof document !== "undefined" ? document : null,
  }
) {
  if (action === "download") {
    const response = await browserApi.runtime.sendMessage({
      type: FIREFOX_DOWNLOAD_JSON_MESSAGE,
      jsonText: payload.jsonText,
      filenameBase: payload.filenameBase,
    });
    if (!response?.ok) {
      throw new Error(response?.errorMessage || "다운로드를 시작하지 못했습니다.");
    }
    return {
      method: "download",
      filename: response.filename,
    };
  }

  if (action === "share-file") {
    if (typeof navigatorApi?.share !== "function") {
      throw new Error("공유 API를 사용할 수 없습니다.");
    }
    const candidates = [
      buildJsonShareFile(payload, { FileCtor, useFallbackFilename: false }),
      buildJsonShareFile(payload, { FileCtor, useFallbackFilename: true }),
    ].filter((file, index, files) => files.findIndex((item) => item.name === file.name) === index);

    let lastShareError = null;
    for (const file of candidates) {
      try {
        if (typeof navigatorApi?.canShare === "function" && !navigatorApi.canShare({ files: [file] })) {
          throw new Error("파일 공유 API를 사용할 수 없습니다.");
        }
        await navigatorApi.share({
          title: file.name,
          files: [file],
        });
        return {
          method: "share-file",
          filename: file.name,
          usedFallbackFilename: file.name !== candidates[0].name,
        };
      } catch (error) {
        lastShareError = error;
        if (!isFilenameConstraintError(error)) {
          throw error;
        }
      }
    }
    throw lastShareError || new Error("파일 공유를 완료하지 못했습니다.");
  }

  if (action === "clipboard-share-marker") {
    await writeTextToClipboard(payload.jsonText, {
      navigatorApi,
      documentApi,
    });

    if (canUseTextShareApi(navigatorApi)) {
      try {
        await navigatorApi.share(buildClipboardSharePayload());
        return {
          method: "clipboard-share-marker",
          filename: buildSafeJsonFilename(payload.filenameBase),
          clipboardCopied: true,
        };
      } catch (error) {
        return {
          method: "clipboard-copy",
          filename: buildSafeJsonFilename(payload.filenameBase),
          clipboardCopied: true,
          shareErrorMessage: normalizeFirefoxMobileErrorMessage(
            error,
            "ReadingLog 앱 열기를 시작하지 못했습니다."
          ),
        };
      }
    }

    return {
      method: "clipboard-copy",
      filename: buildSafeJsonFilename(payload.filenameBase),
      clipboardCopied: true,
    };
  }

  if (action === "share-text-direct") {
    if (!canUseTextShareApi(navigatorApi)) {
      throw new Error("텍스트 공유를 지원하지 않습니다.");
    }
    await navigatorApi.share(buildDirectTextSharePayload(payload.jsonText));
    return {
      method: "share-text-direct",
      filename: buildSafeJsonFilename(payload.filenameBase),
    };
  }

  if (action === "localhost-post" || action === "deeplink-localhost") {
    if (action === "deeplink-localhost") {
      await waitForReadingLogLocalhostReady({
        openReadingLogApp: (deeplinkUrl) => openReadingLogApp(deeplinkUrl, { browserApi }),
        probeLocalhost: async () => {
          try {
            await probeReadingLogLocalhost(fetchApi);
            return true;
          } catch (error) {
            return false;
          }
        },
      });
    } else {
      await probeReadingLogLocalhost(fetchApi);
    }
    await postReadingLogJsonToLocalhost(payload, { fetchApi });
    return {
      method: action,
      filename: buildSafeJsonFilename(payload.filenameBase),
    };
  }

  throw new Error("지원하지 않는 내보내기 방식입니다.");
}

async function exportJsonFromActiveTab({
  exportMessage = {
    type: FIREFOX_EXPORT_JSON_MESSAGE,
  },
  preferredAction = "download",
  browserApi = typeof browser !== "undefined" ? browser : null,
  navigatorApi = typeof navigator !== "undefined" ? navigator : null,
  FileCtor = typeof File !== "undefined" ? File : null,
  fetchApi = typeof fetch !== "undefined" ? fetch : null,
  setStatus: setStatusText = () => {},
  setProgress = () => {},
  setMeta = () => {},
  timeoutMs = {
    activeTabLookup: 5000,
    contentBuild: 60000,
    fileSave: 15000,
    fileShare: 15000,
  },
} = {}) {
  const sessionId = createExportSessionId();
  const unsubscribeProgress = subscribeToExportProgress({
    browserApi,
    sessionId,
    setProgress,
    setStatus: setStatusText,
    setMeta,
  });

  try {
    const activeTabMessage = "현재 열려 있는 Roll20 탭을 확인하고 있습니다.";
    setStatusText(activeTabMessage);
    setProgress(1, activeTabMessage);
    const [tab] = await withTimeout(
      browserApi.tabs.query({ active: true, currentWindow: true }),
      timeoutMs.activeTabLookup,
      "현재 열려 있는 Roll20 탭을 찾는 시간이 너무 오래 걸립니다."
    );
    if (!tab?.id) {
      throw new Error("활성 탭을 찾지 못했습니다.");
    }

    const connectMessage = "Roll20 페이지와 연결하고 있습니다.";
    setStatusText(connectMessage);
    setProgress(5, connectMessage);
    const contentBuildTimeoutMs = resolveContentBuildTimeoutMs({
      preferredAction,
      baseTimeoutMs: timeoutMs.contentBuild,
    });
    let response = null;
    try {
      response = await withTimeout(
        browserApi.tabs.sendMessage(tab.id, {
          ...exportMessage,
          delivery: preferredAction === "download" ? "background-download" : "popup",
          sessionId,
        }),
        contentBuildTimeoutMs,
        "Roll20 페이지에서 JSON 파일을 만드는 시간이 너무 오래 걸립니다. 탭을 새로고침한 뒤 다시 시도하세요."
      );
    } catch (error) {
      throw new Error(
        normalizeFirefoxMobileErrorMessage(
          error,
          "Roll20 탭 응답이 없습니다. 탭을 새로고침한 뒤 다시 시도하세요."
        )
      );
    }

    if (!response) {
      throw new Error("Roll20 탭 응답이 없습니다. 탭을 새로고침한 뒤 다시 시도하세요.");
    }

    if (!response?.ok) {
      throw new Error(response?.errorMessage || "Roll20 탭에서 JSON을 만들지 못했습니다.");
    }

    const payload = {
      jsonText: String(response.jsonText || ""),
      filenameBase: payloadFilenameBase(response.filenameBase),
    };
    const jsonByteLength =
      Number(response?.jsonByteLength) > 0
        ? Number(response.jsonByteLength)
        : measureTextByteLength(payload.jsonText);
    const lineCount = Number(response?.lineCount) > 0 ? Number(response.lineCount) : 0;
    setMeta({ byteLength: jsonByteLength, lineCount });

    if (preferredAction === "share-text-direct") {
      validateReadingLogDirectTextShareSize(jsonByteLength);
    }

    if (response?.deliveredBy === "background-download" || response?.method === "download") {
      setStatusText(
        response?.usedFallbackFilename
          ? `JSON 파일 저장을 요청했습니다. 파일명: ${response.filename || buildSafeJsonFilename(
              payload.filenameBase
            )}. 다운로드 목록에서 확인해 주세요.`
          : "JSON 파일 저장을 요청했습니다. 다운로드 목록에서 확인해 주세요."
      );
      setProgress(100, "파일 저장 요청을 보냈습니다.");
      return {
        method: "download",
        filename: response?.filename || buildSafeJsonFilename(payload.filenameBase),
        usedFallbackFilename: !!response?.usedFallbackFilename,
      };
    }

    const fileStageMessage =
      preferredAction === "download"
        ? "휴대전화에 JSON 파일을 저장하고 있습니다."
        : preferredAction === "clipboard-share-marker"
          ? "JSON을 클립보드에 복사하고 ReadingLog 앱을 열 준비를 하고 있습니다."
        : preferredAction === "share-text-direct"
          ? "ReadingLog 앱으로 JSON 텍스트를 보내고 있습니다."
        : preferredAction === "deeplink-localhost"
          ? "ReadingLog 앱을 열고 준비를 기다리고 있습니다."
          : preferredAction === "localhost-post"
            ? "ReadingLog 앱 연결 상태를 확인하고 있습니다."
          : "다른 앱에서 열 수 있도록 JSON 파일을 준비하고 있습니다.";
    setStatusText(fileStageMessage);
    setProgress(95, fileStageMessage);
    const actionPlan = getFirefoxExportAction({
      canDownload: canUseDownloadsApi(browserApi),
      canShare: canUseFileShareApi(navigatorApi, FileCtor),
      canShareText: canUseTextShareApi(navigatorApi),
      canPostToLocalhost: canUseLocalhostTransfer(fetchApi),
      canOpenReadingLogApp: true,
      canWriteClipboard: canUseClipboardWriteApi(
        navigatorApi,
        typeof document !== "undefined" ? document : null
      ),
      preferredAction,
    });
    const actions = [actionPlan.primary, ...(actionPlan.fallbacks || [])];
    let lastError = null;

    for (const action of actions) {
      try {
        const stageTimeoutMs = resolveFileStageTimeoutMs({
          byteLength: jsonByteLength,
          baseTimeoutMs: action === "download" ? timeoutMs.fileSave : timeoutMs.fileShare,
        });
        const result = await withTimeout(
          performExportAction(action, payload, {
            browserApi,
            navigatorApi,
            FileCtor,
            fetchApi,
          }),
          stageTimeoutMs,
          action === "download"
            ? `파일 크기가 커서 저장 준비가 오래 걸리고 있습니다. 현재 예상 파일 크기는 ${formatByteSize(
                jsonByteLength
              )}입니다. 잠시 뒤 다시 시도해 주세요.`
            : action === "clipboard-share-marker"
              ? "JSON을 클립보드에 복사하는 시간이 너무 오래 걸립니다. 잠시 뒤 다시 시도해 주세요."
            : action === "share-text-direct"
              ? "ReadingLog 앱으로 JSON 텍스트를 보내는 시간이 너무 오래 걸립니다. 잠시 뒤 다시 시도해 주세요."
            : action === "deeplink-localhost"
              ? READINGLOG_APP_OPEN_BLOCKED_MESSAGE
              : action === "localhost-post"
                ? "ReadingLog 앱이 준비되지 않았습니다."
            : `파일 크기가 커서 공유 화면 준비가 오래 걸리고 있습니다. 현재 예상 파일 크기는 ${formatByteSize(
                jsonByteLength
              )}입니다. 잠시 뒤 다시 시도해 주세요.`
        );
        const completedMessage =
          result.method === "download"
            ? "저장이 시작되었습니다."
            : result.method === "clipboard-share-marker" || result.method === "clipboard-copy"
              ? "클립보드에 복사했습니다."
            : result.method === "share-text-direct"
              ? "앱 공유 화면을 열었습니다."
            : result.method === "localhost-post" || result.method === "deeplink-localhost"
              ? "앱 전송을 마쳤습니다."
              : "공유 화면을 열었습니다.";
        if (result.method === "download") {
          setStatusText(
            result.usedFallbackFilename
              ? `JSON 다운로드를 시작했습니다. 파일명: ${result.filename}`
              : "JSON 다운로드를 시작했습니다."
          );
        } else if (result.method === "clipboard-share-marker") {
          setStatusText(
            "JSON을 클립보드에 복사했습니다. 공유 목록에서 ReadingLog 앱을 선택하세요."
          );
        } else if (result.method === "share-text-direct") {
          setStatusText(
            "JSON 텍스트 공유 화면을 열었습니다. 공유 목록에서 ReadingLog 앱을 선택하세요."
          );
        } else if (result.method === "clipboard-copy") {
          setStatusText(
            result.shareErrorMessage
              ? `JSON을 클립보드에 복사했습니다. ${result.shareErrorMessage} ReadingLog 앱을 직접 열어 '클립보드에서 가져오기'를 누르세요.`
              : "JSON을 클립보드에 복사했습니다. ReadingLog 앱을 직접 열어 '클립보드에서 가져오기'를 누르세요."
          );
        } else if (result.method === "localhost-post" || result.method === "deeplink-localhost") {
          setStatusText("ReadingLog 앱으로 JSON 파일 전송을 요청했습니다.");
        } else if (result.method === "share-file") {
          setStatusText(
            result.usedFallbackFilename
              ? `JSON 파일 공유 시트를 열었습니다. 파일명: ${result.filename}. ReadingLog가 목록에 없으면 앱이 설치되지 않았거나 아직 JSON 열기를 지원하지 않는 버전입니다.`
              : "JSON 파일 공유 시트를 열었습니다. ReadingLog가 목록에 없으면 앱이 설치되지 않았거나 아직 JSON 열기를 지원하지 않는 버전입니다."
          );
        }
        setProgress(100, completedMessage);
        return result;
      } catch (error) {
        lastError = new Error(buildStageFailureMessage(action, error));
      }
    }

    throw lastError || new Error("JSON 내보내기에 실패했습니다.");
  } finally {
    unsubscribeProgress();
  }
}

function renderAvatarMappings(mappings) {
  if (!avatarListEl) return;
  avatarListEl.innerHTML = "";
  Array.from(mappings || []).forEach((item) => {
    const row = document.createElement("div");

    const preview = document.createElement("img");
    preview.className = "avatar-preview";
    preview.src = item.avatarUrl;
    preview.alt = item.name;

    const name = document.createElement("div");
    name.textContent = item.name;

    const input = document.createElement("input");
    input.type = "text";
    input.value = item.avatarUrl;
    input.dataset.id = item.id;
    input.dataset.name = item.name;
    input.dataset.originalUrl = item.originalUrl;
    input.dataset.avatarUrl = item.avatarUrl;
    input.dataset.initialUrl = item.avatarUrl;
    const bindPreview =
      typeof avatarPreview.bindAvatarPreviewInput === "function"
        ? avatarPreview.bindAvatarPreviewInput
        : null;
    if (bindPreview) {
      bindPreview(input, preview, { fallbackUrl: item.avatarUrl });
    }

    row.appendChild(preview);
    row.appendChild(name);
    row.appendChild(input);
    avatarListEl.appendChild(row);
  });
}

function collectChangedAvatarReplacements(rootEl = avatarListEl) {
  const collector =
    typeof avatarDownloadPlan.collectAvatarReplacementsFromInputs === "function"
      ? avatarDownloadPlan.collectAvatarReplacementsFromInputs
      : () => [];
  const inputs = rootEl?.querySelectorAll?.("input") || [];
  return collector(inputs, { onlyChanged: true });
}

async function requestAvatarMappingsFromActiveTab({
  browserApi = typeof browser !== "undefined" ? browser : null,
} = {}) {
  const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("활성 탭을 찾지 못했습니다.");
  }

    const response = await browserApi.tabs.sendMessage(tab.id, {
      type: FIREFOX_GET_AVATAR_MAPPINGS_MESSAGE,
    });
  if (!response?.ok) {
    throw new Error(
      normalizeFirefoxMobileErrorMessage(
        response?.errorMessage,
        "이미지 링크 목록을 불러오지 못했습니다."
      )
    );
  }
  return Array.isArray(response.mappings) ? response.mappings : [];
}

async function handleAvatarMappingClick() {
  setStatus("이미지 링크 목록을 불러오는 중입니다...");
  try {
    const mappings = await requestAvatarMappingsFromActiveTab();
    if (!mappings.length) {
      setStatus("아바타 매핑을 찾지 못했습니다.");
      return;
    }
    renderAvatarMappings(mappings);
    if (avatarEditorEl) avatarEditorEl.hidden = false;
    setStatus(`총 ${mappings.length}개의 이미지 링크를 불러왔습니다.`);
  } catch (error) {
    setStatus(
      normalizeFirefoxMobileErrorMessage(error, "이미지 링크 목록을 불러오지 못했습니다.")
    );
  }
}

async function pingActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("활성 탭을 찾지 못했습니다.");
    return;
  }

  try {
    const response = await browser.tabs.sendMessage(tab.id, {
      type: FIREFOX_PING_MESSAGE,
    });
    setStatus(response?.ok ? "Firefox 모바일 셸 준비됨" : "응답 없음");
  } catch (error) {
    setStatus("Roll20 탭에서 다시 시도하세요.");
  }
}

function buildExportMessageFromAvatarEditor() {
  const replacements = collectChangedAvatarReplacements();
  const resolveMode =
    typeof avatarDownloadPlan.resolveReadingLogDownloadMode === "function"
      ? avatarDownloadPlan.resolveReadingLogDownloadMode
      : (items) => (Array.isArray(items) && items.length > 0 ? "mapped" : "direct");
  const mode = resolveMode(replacements);
  return mode === "mapped"
    ? {
        type: FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE,
        replacements,
      }
    : {
        type: FIREFOX_EXPORT_JSON_MESSAGE,
      };
}

async function handleExportClick() {
  setStatus("ReadingLog 파일 다운로드를 준비하는 중입니다...");
  resetExportMeta();
  setExportProgress(5, "준비 중");
  try {
    const exportMessage = buildExportMessageFromAvatarEditor();
    await exportJsonFromActiveTab({
      exportMessage,
      preferredAction: "download",
      setStatus,
      setProgress: setExportProgress,
      setMeta: setExportMeta,
    });
  } catch (error) {
    setStatus(normalizeFirefoxMobileErrorMessage(error, "ReadingLog 파일 내보내기에 실패했습니다."));
    resetExportProgress();
  }
}

async function handleShareClick() {
  setStatus("ReadingLog 앱으로 보낼 JSON을 준비하고 있습니다...");
  resetExportMeta();
  setExportProgress(5, "전송 시작 준비 중");
  try {
    const exportMessage = buildExportMessageFromAvatarEditor();
    await exportJsonFromActiveTab({
      exportMessage,
      preferredAction: "share-text-direct",
      setStatus,
      setProgress: setExportProgress,
      setMeta: setExportMeta,
    });
  } catch (error) {
    setStatus(normalizeFirefoxMobileErrorMessage(error, "ReadingLog 앱 전송에 실패했습니다."));
    resetExportProgress();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FIREFOX_START_READINGLOG_TRANSFER_MESSAGE,
    FIREFOX_EXPORT_PROGRESS_MESSAGE,
    FIREFOX_EXPORT_JSON_MESSAGE,
    FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE,
    FIREFOX_GET_AVATAR_MAPPINGS_MESSAGE,
    getFirefoxExportAction,
    normalizeFirefoxMobileErrorMessage,
    buildStageFailureMessage,
    isFilenameConstraintError,
    buildSafeJsonFilename,
    buildFallbackJsonFilename,
    createExportSessionId,
    withTimeout,
    subscribeToExportProgress,
    formatByteSize,
    measureTextByteLength,
    buildExportMetaText,
    resolveFileStageTimeoutMs,
    resolveContentBuildTimeoutMs,
    clampProgressPercent,
    canUseDownloadsApi,
    canUseFileShareApi,
    canUseTextShareApi,
    canUseClipboardWriteApi,
    canUseLocalhostTransfer,
    writeTextToClipboard,
    buildClipboardSharePayload,
    buildDirectTextSharePayload,
    probeReadingLogLocalhost,
    buildReadingLogWakeUrl,
    openReadingLogApp,
    waitForReadingLogLocalhostReady,
    postReadingLogJsonToLocalhost,
    splitJsonTextIntoChunks,
    readJsonResponse,
    streamReadingLogJsonToLocalhost,
    startReadingLogTransferFromPopup,
    openReadingLogAppAndStartTransferFromPopup,
    sleep,
    buildJsonShareFile,
    READINGLOG_CLIPBOARD_SHARE_MARKER_TEXT,
    READINGLOG_DIRECT_TEXT_SHARE_MAX_BYTES,
    FIREFOX_OPEN_READINGLOG_APP_MESSAGE,
    openReadingLogAppFromActiveTab,
    exportJsonFromActiveTab,
    requestAvatarMappingsFromActiveTab,
    buildExportMessageFromAvatarEditor,
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    imageCheckButtonEl?.addEventListener("click", handleAvatarMappingClick);
    readingLogDownloadButtonEl?.addEventListener("click", handleExportClick);
    readingLogShareButtonEl?.addEventListener("click", handleShareClick);
    setStatus("준비되었습니다.");
  });
}
