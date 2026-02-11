const targetColorEl = document.getElementById("targetColor");
const colorFilterEnabledEl = document.getElementById("colorFilterEnabled");
const hiddenTextEnabledEl = document.getElementById("hiddenTextEnabled");
const downloadBundlePageEl = document.getElementById("downloadBundlePage");
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

function requestToTab(tabId, messageType, extra = {}) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("응답 시간이 초과되었습니다.")), 120000);
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
        files: ["content.js"],
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
  try {
    return await requestToTab(tabId, messageType, extra);
  } catch (error) {
    await injectContentScript(tabId);
    return requestToTab(tabId, messageType, extra);
  }
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id || 0;
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
  try {
    const tabId = await getActiveTabId();
    if (!tabId) {
      setStatus("현재 활성 탭을 찾을 수 없습니다.");
      return;
    }

    const requestId = randomRequestId();
    activeProgressRequestId = requestId;
    setStatus("HTML 파일을 준비하는 중입니다...");
    setProgress(5, "준비 중...");

    const response = await requestWithRecovery(tabId, "DOWNLOAD_BUNDLED_HTML_DIRECT", {
      requestId,
    });

    if (!response?.ok) {
      setStatus("HTML 데이터를 받지 못했습니다.");
      activeProgressRequestId = "";
      hideProgress();
      return;
    }

    setProgress(100, "완료되었습니다.");
    setStatus("다운로드가 시작되었습니다.");
    activeProgressRequestId = "";
    setTimeout(() => hideProgress(), 800);
  } catch (error) {
    setStatus("다운로드에 실패했습니다.");
    activeProgressRequestId = "";
    hideProgress();
  }
});

downloadTest2El.addEventListener("click", async () => {
  try {
    const tabId = await getActiveTabId();
    if (!tabId) {
      setStatus("현재 활성 탭을 찾을 수 없습니다.");
      return;
    }

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
    setStatus("아바타 목록을 불러오지 못했습니다.");
  }
});

downloadAvatarMappedEl.addEventListener("click", async () => {
  try {
    const tabId = await getActiveTabId();
    if (!tabId) {
      setStatus("현재 활성 탭을 찾을 수 없습니다.");
      return;
    }

    if (!currentAvatarMappings.length) {
      setStatus("먼저 테스트용2 버튼으로 목록을 불러오세요.");
      return;
    }

    const replacements = collectAvatarReplacements();
    if (!replacements.length) {
      setStatus("적용할 이미지 링크가 없습니다.");
      return;
    }

    setStatus("아바타를 치환한 HTML을 만드는 중입니다...");
    const response = await requestWithRecovery(tabId, "DOWNLOAD_WITH_AVATAR_REPLACEMENTS", {
      replacements,
    });

    if (!response?.ok) {
      setStatus("아바타 치환 다운로드에 실패했습니다.");
      return;
    }

    setStatus("아바타 치환 HTML 다운로드가 시작되었습니다.");
  } catch (error) {
    setStatus("아바타 치환 다운로드에 실패했습니다.");
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "BUNDLE_PROGRESS") return;
  if (!message.requestId || message.requestId !== activeProgressRequestId) return;
  setProgress(message.percent ?? 0, message.label || "처리 중...");
});
