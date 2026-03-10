function setStatus(text) {
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = text;
}

const FIREFOX_PING_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_PING";
const FIREFOX_EXPORT_JSON_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON";
const FIREFOX_DOWNLOAD_JSON_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_JSON";

function getFirefoxExportAction({ canDownload = true, canShare = false, canCopy = false } = {}) {
  if (canDownload) {
    return {
      primary: "download",
      fallbacks: [canShare ? "share" : "", canCopy ? "copy" : ""].filter(Boolean),
    };
  }
  if (canShare) {
    return {
      primary: "share",
      fallbacks: canCopy ? ["copy"] : [],
    };
  }
  return {
    primary: "copy",
    fallbacks: [],
  };
}

function canUseDownloadsApi(browserApi = typeof browser !== "undefined" ? browser : null) {
  return typeof browserApi?.downloads?.download === "function";
}

function canUseShareApi(navigatorApi = typeof navigator !== "undefined" ? navigator : null) {
  return typeof navigatorApi?.share === "function";
}

function canUseClipboardApi(navigatorApi = typeof navigator !== "undefined" ? navigator : null) {
  return typeof navigatorApi?.clipboard?.writeText === "function";
}

async function performExportAction(action, payload, { browserApi, navigatorApi }) {
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

  if (action === "share") {
    if (typeof navigatorApi?.share !== "function") {
      throw new Error("공유 API를 사용할 수 없습니다.");
    }
    const filename = `${String(payload.filenameBase || "roll20-chat")}.json`;
    await navigatorApi.share({
      title: filename,
      text: payload.jsonText,
    });
    return {
      method: "share",
      filename,
    };
  }

  if (action === "copy") {
    if (typeof navigatorApi?.clipboard?.writeText !== "function") {
      throw new Error("클립보드 API를 사용할 수 없습니다.");
    }
    await navigatorApi.clipboard.writeText(payload.jsonText);
    return {
      method: "copy",
      filename: `${String(payload.filenameBase || "roll20-chat")}.json`,
    };
  }

  throw new Error("지원하지 않는 내보내기 방식입니다.");
}

async function exportJsonFromActiveTab({
  browserApi = typeof browser !== "undefined" ? browser : null,
  navigatorApi = typeof navigator !== "undefined" ? navigator : null,
  setStatus: setStatusText = () => {},
} = {}) {
  const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("활성 탭을 찾지 못했습니다.");
  }

  const response = await browserApi.tabs.sendMessage(tab.id, {
    type: FIREFOX_EXPORT_JSON_MESSAGE,
  });
  if (!response?.ok) {
    throw new Error(response?.errorMessage || "Roll20 탭에서 JSON을 만들지 못했습니다.");
  }

  const payload = {
    jsonText: String(response.jsonText || ""),
    filenameBase: String(response.filenameBase || "roll20-chat"),
  };
  const actionPlan = getFirefoxExportAction({
    canDownload: canUseDownloadsApi(browserApi),
    canShare: canUseShareApi(navigatorApi),
    canCopy: canUseClipboardApi(navigatorApi),
  });
  const actions = [actionPlan.primary, ...(actionPlan.fallbacks || [])];
  let lastError = null;

  for (const action of actions) {
    try {
      const result = await performExportAction(action, payload, { browserApi, navigatorApi });
      if (result.method === "download") {
        setStatusText("JSON 다운로드를 시작했습니다.");
      } else if (result.method === "share") {
        setStatusText("공유 시트를 열었습니다.");
      } else if (result.method === "copy") {
        setStatusText("JSON을 클립보드에 복사했습니다.");
      }
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("JSON 내보내기에 실패했습니다.");
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

async function handleExportClick() {
  setStatus("JSON을 만드는 중입니다...");
  try {
    await exportJsonFromActiveTab({ setStatus });
  } catch (error) {
    setStatus(error?.message ? String(error.message) : "JSON 내보내기에 실패했습니다.");
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getFirefoxExportAction,
    canUseDownloadsApi,
    canUseShareApi,
    canUseClipboardApi,
    exportJsonFromActiveTab,
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("exportJson");
    if (button) {
      button.addEventListener("click", handleExportClick);
    }
    setStatus("준비되었습니다.");
  });
}
