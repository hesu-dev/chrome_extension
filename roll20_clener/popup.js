const targetColorEl = document.getElementById("targetColor");
const colorFilterEnabledEl = document.getElementById("colorFilterEnabled");
const hiddenTextEnabledEl = document.getElementById("hiddenTextEnabled");
const downloadBundlePageEl = document.getElementById("downloadBundlePage");
const copyBundlePageEl = document.getElementById("copyBundlePage");
const downloadTest2El = document.getElementById("downloadTest2");
const avatarEditorEl = document.getElementById("avatarEditor");
const avatarListEl = document.getElementById("avatarList");
const downloadAvatarMappedEl = document.getElementById("downloadAvatarMapped");
const progressWrapEl = document.getElementById("progressWrap");
const progressBarEl = document.getElementById("progressBar");
const progressTextEl = document.getElementById("progressText");
const statusEl = document.getElementById("status");

let activeProgressRequestId = "";
let currentAvatarMappings = [];

function setStatus(text) {
  statusEl.textContent = text;
}

function setProgress(percent, text) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  progressWrapEl.classList.remove("hidden");
  progressBarEl.style.width = `${clamped}%`;
  progressTextEl.textContent = text || `${clamped}%`;
}

function hideProgress() {
  progressWrapEl.classList.add("hidden");
  progressBarEl.style.width = "0%";
  progressTextEl.textContent = "";
}

function randomRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isSupportedTabUrl(url) {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

function normalizeUiError(error) {
  const message = (error && error.message ? error.message : String(error || "")).trim();

  if (/Could not establish connection/i.test(message)) {
    return "오류 코드: 5 - 페이지와 연결하지 못했습니다. Roll20 게임 탭에서 다시 시도해주세요.";
  }
  if (/Receiving end does not exist/i.test(message)) {
    return "오류 코드: 5 - 컨텐츠 스크립트가 아직 준비되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.";
  }
  if (/cannot access contents of url/i.test(message)) {
    return "현재 탭에서는 동작할 수 없습니다. Roll20 웹페이지 탭에서 실행해주세요.";
  }
  if (/응답 시간이 초과/i.test(message)) {
    return "요청 시간이 초과되었습니다. 페이지가 완전히 로드된 뒤 다시 시도해주세요.";
  }

  return message || "알 수 없는 오류가 발생했습니다.";
}

// Check if content script is ready
async function ensureContentScriptLoaded(tabId) {
  try {
    const response = await requestToTab(tabId, "ROLL20_CLEANER_PING", {}, 2000);
    if (response && response.ok) {
      console.log("[Roll20Cleaner] Content script already loaded.");
      return true;
    }
  } catch (e) {
    console.log("[Roll20Cleaner] Content script not responding, injecting...");
  }

  // If ping failed, inject scripts
  await injectContentScript(tabId);

  // Wait a bit for scripts to initialize
  await new Promise(r => setTimeout(r, 500));

  // Ping again to verify
  try {
    const response = await requestToTab(tabId, "ROLL20_CLEANER_PING", {}, 2000);
    return response && response.ok;
  } catch (e) {
    console.error("[Roll20Cleaner] Script injection failed or script crashed:", e);
    return false;
  }
}

function requestToTab(tabId, messageType, extra = {}, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("응답 시간이 초과되었습니다.")), timeoutMs);
    chrome.tabs.sendMessage(tabId, { type: messageType, ...extra }, (response) => {
      clearTimeout(timeoutId);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response || {});
    });
  });
}

function injectContentScript(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        // Inject ALL modules in correct order
        files: [
          "utils.js",
          "performance_utils.js",
          "avatar_rules.js",
          "html_chunk_serializer.js",
          "avatar_processor.js",
          "style_processor.js",
          "dom_processor.js",
          "content.js"
        ],
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      }
    );
  });
}

async function requestWithRecovery(tabId, messageType, extra = {}) {
  const ready = await ensureContentScriptLoaded(tabId);
  if (!ready) {
    throw new Error("컨텐츠 스크립트 연결에 실패했습니다. 페이지를 새로고침 해주세요.");
  }
  return await requestToTab(tabId, messageType, extra);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function getValidatedActiveTabId() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("현재 활성 탭을 찾을 수 없습니다.");
  }
  if (!isSupportedTabUrl(tab.url || "")) {
    throw new Error("현재 탭에서는 동작할 수 없습니다. Roll20 웹페이지 탭에서 실행해주세요.");
  }
  return tab.id;
}

async function runHtmlAction({
  startStatus,
  successStatus,
  failedPrefix,
  messageType,
  extra = {},
  withProgress = false,
  deferCompletion = false,
}) {
  try {
    const tabId = await getValidatedActiveTabId();

    let requestId = "";
    if (withProgress) {
      requestId = randomRequestId();
      activeProgressRequestId = requestId;
      setProgress(5, "준비 중...");
    }

    setStatus(startStatus);
    const response = await requestWithRecovery(tabId, messageType, {
      ...extra,
      ...(withProgress ? { requestId } : {}),
    });

    if (!response?.ok) {
      const rawMessage = response?.errorMessage || "처리에 실패했습니다.";
      const codePrefix = response?.errorCode ? `오류 코드: ${response.errorCode} - ` : "";
      throw new Error(`${codePrefix}${rawMessage}`);
    }

    if (withProgress && !deferCompletion) {
      setProgress(100, "완료되었습니다.");
      activeProgressRequestId = "";
      setTimeout(() => hideProgress(), 800);
    }

    setStatus(successStatus);
    return response;
  } catch (error) {
    if (withProgress) {
      activeProgressRequestId = "";
      hideProgress();
    }
    console.error("[Roll20Cleaner] Action failed:", error);
    setStatus(`${failedPrefix}: ${normalizeUiError(error)}`);
    return null;
  }
}

async function runAvatarReplacementStream(tabId, replacements) {
  return new Promise((resolve, reject) => {
    const requestId = randomRequestId();
    let settled = false;
    const port = chrome.tabs.connect(tabId, { name: "ROLL20_CLEANER_STREAM" });

    const finish = (error) => {
      if (settled) return;
      settled = true;
      try {
        port.disconnect();
      } catch (e) {
        // noop
      }
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    const timeoutId = setTimeout(() => {
      finish(new Error("응답 시간이 초과되었습니다."));
    }, 180000);

    port.onMessage.addListener((message) => {
      if (!message?.requestId || message.requestId !== requestId) return;
      if (message.type === "STREAM_PROGRESS") {
        setProgress(message.percent ?? 0, message.label || "처리 중...");
        return;
      }
      if (message.type === "STREAM_DONE") {
        clearTimeout(timeoutId);
        if (message.ok) {
          finish();
          return;
        }
        finish(new Error(message.errorMessage || "다운로드 생성 중 오류가 발생했습니다."));
      }
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      clearTimeout(timeoutId);
      const raw = chrome.runtime.lastError?.message || "연결이 종료되었습니다.";
      finish(new Error(raw));
    });

    setProgress(5, "치환 요청 준비 중...");
    port.postMessage({
      type: "START_PROFILE_IMAGE_REPLACEMENT_DOWNLOAD",
      requestId,
      replacements,
    });
  });
}

async function supportsAvatarReplacementStream(tabId) {
  try {
    const response = await requestWithRecovery(tabId, "ROLL20_CLEANER_STREAM_READY", {});
    return !!response?.ok;
  } catch (e) {
    return false;
  }
}

async function runAvatarReplacementFallback(tabId, replacements) {
  const response = await requestWithRecovery(tabId, "DOWNLOAD_WITH_AVATAR_REPLACEMENTS", {
    replacements,
  });
  if (!response?.ok) {
    throw new Error("아바타 치환 다운로드에 실패했습니다.");
  }
}

function renderAvatarMappings(mappings) {
  avatarListEl.innerHTML = "";
  mappings.forEach((item) => {
    const row = document.createElement("div");
    row.className = "avatar-row";

    const preview = document.createElement("img");
    preview.className = "avatar-preview";
    preview.src = item.avatarUrl;
    preview.alt = item.name;

    const right = document.createElement("div");
    const name = document.createElement("div");
    name.className = "avatar-name";
    name.textContent = item.name;

    const input = document.createElement("input");
    input.className = "avatar-input";
    input.type = "text";
    input.placeholder = "새 이미지 링크를 입력하세요";
    input.value = item.avatarUrl;
    input.dataset.id = item.id;
    input.dataset.name = item.name;
    input.dataset.originalUrl = item.originalUrl;

    right.appendChild(name);
    right.appendChild(input);
    row.appendChild(preview);
    row.appendChild(right);
    avatarListEl.appendChild(row);
  });
}

function collectAvatarReplacements() {
  const replacements = [];
  const inputs = avatarListEl.querySelectorAll("input.avatar-input");
  inputs.forEach((input) => {
    const id = input.dataset.id;
    const name = input.dataset.name;
    const originalUrl = input.dataset.originalUrl;
    const value = input.value.trim();
    if (!id || !name || !originalUrl || !value) return;
    replacements.push({
      id,
      name,
      originalUrl,
      newUrl: value,
    });
  });
  return replacements;
}

chrome.storage.sync.get(
  { colorFilterEnabled: false, hiddenTextEnabled: false, targetColor: "#aaaaaa" },
  ({ colorFilterEnabled, hiddenTextEnabled, targetColor }) => {
    colorFilterEnabledEl.checked = colorFilterEnabled;
    hiddenTextEnabledEl.checked = hiddenTextEnabled;
    targetColorEl.value = targetColor;
    setStatus("준비되었습니다.");
  }
);

function persist() {
  chrome.storage.sync.set(
    {
      colorFilterEnabled: colorFilterEnabledEl.checked,
      hiddenTextEnabled: hiddenTextEnabledEl.checked,
      targetColor: targetColorEl.value.trim(),
    },
    () => setStatus("설정이 저장되었습니다.")
  );
}

colorFilterEnabledEl.addEventListener("change", persist);
hiddenTextEnabledEl.addEventListener("change", persist);
targetColorEl.addEventListener("change", persist);
targetColorEl.addEventListener("keyup", (event) => {
  if (event.key === "Enter") persist();
});

downloadBundlePageEl.addEventListener("click", async () => {
  await runHtmlAction({
    startStatus: "HTML 파일을 준비하는 중입니다...",
    successStatus: "다운로드 작업을 시작했습니다...",
    failedPrefix: "다운로드에 실패했습니다",
    messageType: "DOWNLOAD_BUNDLED_HTML_DIRECT",
    withProgress: true,
    deferCompletion: true,
  });
});

copyBundlePageEl.addEventListener("click", async () => {
  await runHtmlAction({
    startStatus: "복사할 HTML을 준비하는 중입니다...",
    successStatus: "클립보드에 HTML이 복사되었습니다.",
    failedPrefix: "복사에 실패했습니다",
    messageType: "COPY_BUNDLED_HTML_DIRECT",
    withProgress: false,
  });
});

downloadTest2El.addEventListener("click", async () => {
  try {
    const tabId = await getValidatedActiveTabId();

    setStatus("이름/아바타 목록을 불러오는 중입니다...");
    const response = await requestWithRecovery(tabId, "GET_AVATAR_MAPPINGS");
    const mappings = Array.isArray(response?.mappings) ? response.mappings : [];

    if (!mappings.length) {
      setStatus("아바타 매핑을 찾지 못했습니다.");
      return;
    }

    currentAvatarMappings = mappings;
    renderAvatarMappings(mappings);
    avatarEditorEl.classList.remove("hidden");
    setStatus(`총 ${mappings.length}개의 이름을 불러왔습니다.`);
  } catch (error) {
    setStatus(`아바타 목록을 불러오지 못했습니다: ${normalizeUiError(error)}`);
  }
});

downloadAvatarMappedEl.addEventListener("click", async () => {
  try {
    const tabId = await getValidatedActiveTabId();

    if (!currentAvatarMappings.length) {
      setStatus("먼저 프로필 이미지 교체 버튼으로 목록을 불러오세요.");
      return;
    }

    const replacements = collectAvatarReplacements();
    if (!replacements.length) {
      setStatus("적용할 이미지 링크가 없습니다.");
      return;
    }

    const ready = await ensureContentScriptLoaded(tabId);
    if (!ready) {
      setStatus("컨텐츠 스크립트 연결에 실패했습니다. 페이지를 새로고침 해주세요.");
      return;
    }

    setStatus("프로필 이미지 교체 HTML을 만드는 중입니다...");
    const streamSupported = await supportsAvatarReplacementStream(tabId);
    if (streamSupported) {
      await runAvatarReplacementStream(tabId, replacements);
      setProgress(100, "완료되었습니다.");
      setStatus("프로필 이미지 교체 HTML 다운로드가 시작되었습니다.");
      setTimeout(() => hideProgress(), 900);
      return;
    }

    await runAvatarReplacementFallback(tabId, replacements);
    hideProgress();
    setStatus("프로필 이미지 교체 HTML 다운로드가 시작되었습니다.");
  } catch (error) {
    hideProgress();
    setStatus(`아바타 치환 다운로드에 실패했습니다: ${normalizeUiError(error)}`);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "BUNDLE_PROGRESS") {
    if (!message.requestId || message.requestId !== activeProgressRequestId) return;
    setProgress(message.percent ?? 0, message.label || "처리 중...");
    return;
  }

  if (message?.type === "BUNDLE_DONE") {
    if (!message.requestId || message.requestId !== activeProgressRequestId) return;
    if (message.ok) {
      setProgress(100, "완료되었습니다.");
      setStatus("다운로드가 시작되었습니다.");
      activeProgressRequestId = "";
      setTimeout(() => hideProgress(), 900);
      return;
    }
    activeProgressRequestId = "";
    hideProgress();
    const errorText = message.errorMessage ? `: ${message.errorMessage}` : "";
    setStatus(`다운로드에 실패했습니다${errorText}`);
  }
});
