const FIREFOX_PING_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_PING";
const FIREFOX_EXPORT_JSON_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON";
const FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE =
  "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS";
const FIREFOX_GET_AVATAR_MAPPINGS_MESSAGE =
  "R20_JSON_EXPORTER_FIREFOX_GET_AVATAR_MAPPINGS";
const FIREFOX_DOWNLOAD_JSON_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_JSON";
const avatarDownloadPlan =
  typeof window !== "undefined" ? window.Roll20CleanerAvatarDownloadPlan || {} : {};
const avatarPreview =
  typeof window !== "undefined" ? window.Roll20CleanerAvatarPreview || {} : {};
const statusEl = typeof document !== "undefined" ? document.getElementById("status") : null;
const imageCheckButtonEl =
  typeof document !== "undefined" ? document.getElementById("downloadTest2") : null;
const readingLogDownloadButtonEl =
  typeof document !== "undefined" ? document.getElementById("downloadReadingLogJson") : null;
const avatarEditorEl =
  typeof document !== "undefined" ? document.getElementById("avatarEditor") : null;
const avatarListEl =
  typeof document !== "undefined" ? document.getElementById("avatarList") : null;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

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
  exportMessage = {
    type: FIREFOX_EXPORT_JSON_MESSAGE,
  },
  browserApi = typeof browser !== "undefined" ? browser : null,
  navigatorApi = typeof navigator !== "undefined" ? navigator : null,
  setStatus: setStatusText = () => {},
} = {}) {
  const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("활성 탭을 찾지 못했습니다.");
  }

  const response = await browserApi.tabs.sendMessage(tab.id, {
    ...exportMessage,
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
    throw new Error(response?.errorMessage || "이미지 링크 목록을 불러오지 못했습니다.");
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
    setStatus(error?.message ? String(error.message) : "이미지 링크 목록을 불러오지 못했습니다.");
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

async function handleExportClick() {
  setStatus("ReadingLog 파일을 만드는 중입니다...");
  try {
    const replacements = collectChangedAvatarReplacements();
    const resolveMode =
      typeof avatarDownloadPlan.resolveReadingLogDownloadMode === "function"
        ? avatarDownloadPlan.resolveReadingLogDownloadMode
        : (items) => (Array.isArray(items) && items.length > 0 ? "mapped" : "direct");
    const mode = resolveMode(replacements);
    const exportMessage =
      mode === "mapped"
        ? {
            type: FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE,
            replacements,
          }
        : {
            type: FIREFOX_EXPORT_JSON_MESSAGE,
          };
    await exportJsonFromActiveTab({
      exportMessage,
      setStatus,
    });
  } catch (error) {
    setStatus(
      error?.message ? String(error.message) : "ReadingLog 파일 내보내기에 실패했습니다."
    );
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FIREFOX_EXPORT_JSON_MESSAGE,
    FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE,
    FIREFOX_GET_AVATAR_MAPPINGS_MESSAGE,
    getFirefoxExportAction,
    canUseDownloadsApi,
    canUseShareApi,
    canUseClipboardApi,
    exportJsonFromActiveTab,
    requestAvatarMappingsFromActiveTab,
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    imageCheckButtonEl?.addEventListener("click", handleAvatarMappingClick);
    readingLogDownloadButtonEl?.addEventListener("click", handleExportClick);
    setStatus("준비되었습니다.");
  });
}
