function setStatus(text) {
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = text;
}

function getFirefoxExportAction({ canDownload = true, canShare = false } = {}) {
  if (canDownload) {
    return {
      primary: "download",
      fallbacks: canShare ? ["share"] : [],
    };
  }
  if (canShare) {
    return {
      primary: "share",
      fallbacks: [],
    };
  }
  return {
    primary: "copy",
    fallbacks: [],
  };
}

async function pingActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("활성 탭을 찾지 못했습니다.");
    return;
  }

  try {
    const response = await browser.tabs.sendMessage(tab.id, {
      type: "R20_JSON_EXPORTER_FIREFOX_PING",
    });
    setStatus(response?.ok ? "Firefox 모바일 셸 준비됨" : "응답 없음");
  } catch (error) {
    setStatus("Roll20 탭에서 다시 시도하세요.");
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getFirefoxExportAction };
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("exportJson");
    if (button) {
      button.addEventListener("click", pingActiveTab);
    }
    setStatus("준비되었습니다.");
  });
}
