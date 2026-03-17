(function () {
  const progressModel =
    typeof module !== "undefined" && module.exports
      ? require("./export_progress_model.js")
      : window.Roll20SafariExportProgressModel || {};
  const contentApi =
    typeof module !== "undefined" && module.exports
      ? require("./content.js")
      : window.Roll20SafariExportContent || {};
  const nativeBridgeContract =
    typeof module !== "undefined" && module.exports
      ? require("./native_bridge_contract.js")
      : window.Roll20SafariNativeBridgeContract || {};

  function getDefaultDocument() {
    return typeof document !== "undefined" ? document : null;
  }

  function getWebExtensionApi(overrideApi) {
    if (overrideApi) return overrideApi;
    if (typeof browser !== "undefined") return browser;
    if (typeof chrome !== "undefined") return chrome;
    return null;
  }

  function formatByteSize(bytes) {
    const numeric = Number(bytes) || 0;
    if (numeric < 1024) return `${numeric} B`;
    const kib = numeric / 1024;
    if (kib < 1024) return `${Math.round(kib * 10) / 10} KB`;
    return `${Math.round((kib / 1024) * 10) / 10} MB`;
  }

  function getByteLength(rawText) {
    const value = String(rawText || "");
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(value).length;
    }
    return value.length;
  }

  function formatStageLabel(stage) {
    switch (String(stage || "")) {
      case "checking_page":
        return "페이지 확인";
      case "measuring_dom":
        return "대화 측정";
      case "building_json":
        return "파일 생성";
      case "checking_storage":
        return "공간 확인";
      case "writing_inbox":
        return "앱으로 복사";
      case "done":
        return "완료";
      case "error":
        return "오류";
      default:
        return "준비됨";
    }
  }

  function createDomBindings(doc = getDefaultDocument()) {
    return {
      button: doc?.getElementById?.("exportButton") || null,
      statusStage: doc?.getElementById?.("statusStage") || null,
      statusMessage: doc?.getElementById?.("statusMessage") || null,
      statusFilename: doc?.getElementById?.("statusFilename") || null,
      statusMetrics: doc?.getElementById?.("statusMetrics") || null,
      statusPayload: doc?.getElementById?.("statusPayload") || null,
      statusInbox: doc?.getElementById?.("statusInbox") || null,
    };
  }

  async function queryActiveTab(api) {
    const tabs = await Promise.resolve(api?.tabs?.query?.({ active: true, currentWindow: true }));
    return Array.isArray(tabs) ? tabs[0] || null : null;
  }

  async function sendTabMessage(api, tabId, payload) {
    return Promise.resolve(api?.tabs?.sendMessage?.(tabId, payload));
  }

  async function sendNativeMessage(api, payload) {
    return Promise.resolve(api?.runtime?.sendNativeMessage?.(payload));
  }

  function defaultWaitForMs(delayMs) {
    const duration = Math.max(0, Number(delayMs) || 0);
    return new Promise((resolve) => {
      setTimeout(resolve, duration);
    });
  }

  function formatPendingExportCount(count) {
    const numeric = Number(count) || 0;
    return numeric === 1 ? "대기 파일 1개" : `대기 파일 ${numeric}개`;
  }

  function shouldShowDebugDetails() {
    if (typeof globalThis === "undefined") return false;
    return globalThis.__ROLL20_SAFARI_DEBUG__ === true;
  }

  function renderState(state, bindings) {
    if (bindings.statusStage) {
      bindings.statusStage.textContent = formatStageLabel(state?.stage);
    }
    if (bindings.statusMessage) {
      bindings.statusMessage.textContent = String(state?.message || "");
    }
    if (bindings.statusFilename) {
      bindings.statusFilename.textContent = state?.filenameBase
        ? `${state.filenameBase}.json`
        : "대기 중";
    }
    if (bindings.statusMetrics) {
      const metrics = state?.metrics;
      bindings.statusMetrics.textContent = metrics
        ? shouldShowDebugDetails()
          ? `메시지 ${metrics.messageCount}개 · DOM 노드 ${metrics.domNodeEstimate}개`
          : `메시지 ${metrics.messageCount}개`
        : "아직 측정된 채팅 로그가 없습니다.";
    }
    if (bindings.statusPayload) {
      bindings.statusPayload.textContent =
        state?.payloadBytes > 0
          ? `현재 파일 크기 ${formatByteSize(state.payloadBytes)}`
          : "현재 파일 크기를 아직 계산하지 않았습니다.";
    }
    if (bindings.statusInbox) {
      if (!shouldShowDebugDetails()) {
        bindings.statusInbox.textContent = "";
      } else if (state?.savedFileName) {
        bindings.statusInbox.textContent = `${state.savedFileName} · ${formatPendingExportCount(
          state.pendingCount
        )}`;
      } else if (state?.pendingCount > 0) {
        bindings.statusInbox.textContent = formatPendingExportCount(state.pendingCount);
      } else {
        bindings.statusInbox.textContent = "아직 앱 보관함으로 복사하지 않았습니다.";
      }
    }
  }

  function createPopupController({
    api = getWebExtensionApi(),
    doc = getDefaultDocument(),
    progressApi = progressModel,
    pingRetryDelayMs = 250,
    pingRetryCount = 3,
    waitForMs = defaultWaitForMs,
  } = {}) {
    const bindings = createDomBindings(doc);
    const createInitialExportProgress =
      typeof progressApi.createInitialExportProgress === "function"
        ? progressApi.createInitialExportProgress
        : () => ({
            stage: "idle",
            message: "Roll20 채팅 로그를 가져올 준비가 되었습니다.",
            filenameBase: "",
            metrics: null,
            payloadBytes: 0,
            jsonText: "",
            pendingCount: 0,
            pendingBytes: 0,
            inboxRelativePath: "",
            savedFileName: "",
            errorMessage: "",
          });
    const updateExportProgress =
      typeof progressApi.updateExportProgress === "function"
        ? progressApi.updateExportProgress
        : (previous, patch) => ({ ...(previous || {}), ...(patch || {}) });

    let state = createInitialExportProgress();

    function setState(patch) {
      state = updateExportProgress(state, patch);
      renderState(state, bindings);
    }

    async function pingContentScript(tabId) {
      const totalAttempts = Math.max(1, Number(pingRetryCount) || 1);
      for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
        try {
          const response = await sendTabMessage(api, tabId, {
            type: contentApi.SAFARI_PING_MESSAGE || "R20_SAFARI_EXPORT_PING",
          });
          if (response?.ok) return true;
        } catch (error) {
          // Retry after a short delay.
        }
        if (attempt < totalAttempts - 1) {
          await waitForMs(pingRetryDelayMs);
        }
      }
      return false;
    }

    async function handleExportClick() {
      if (bindings.button) {
        bindings.button.disabled = true;
        bindings.button.textContent = "복사하는 중...";
      }

      try {
        setState({
          stage: "checking_page",
          message: "현재 사파리 탭이 Roll20 페이지인지 확인하고 있습니다.",
        });

        const tab = await queryActiveTab(api);
        if (!tab?.id) {
          throw new Error("사파리에서 Roll20 페이지를 먼저 열어주세요.");
        }

        const pingOk = await pingContentScript(tab.id);
        if (!pingOk) {
          throw new Error(
            "사파리 페이지 연결이 아직 준비되지 않았습니다. 페이지를 새로고침한 뒤 다시 시도해주세요."
          );
        }

        setState({
          stage: "measuring_dom",
          message: "현재 열려 있는 Roll20 채팅 로그를 확인하고 있습니다.",
        });
        const measurement = await sendTabMessage(api, tab.id, {
          type: contentApi.SAFARI_MEASURE_MESSAGE || "R20_SAFARI_EXPORT_MEASURE",
        });
        if (!measurement?.ok) {
          throw new Error(String(measurement?.errorMessage || "Roll20 페이지 측정에 실패했습니다."));
        }

        setState({
          stage: "measuring_dom",
          message: "채팅 로그를 확인했습니다.",
          filenameBase: String(measurement.filenameBase || ""),
          metrics: {
            messageCount: Number(measurement.messageCount) || 0,
            domNodeEstimate: Number(measurement.domNodeEstimate) || 0,
          },
        });

        setState({
          stage: "building_json",
          message: "리딩로그 파일을 만들고 있습니다.",
        });
        const payload = await sendTabMessage(api, tab.id, {
          type: contentApi.SAFARI_EXPORT_JSON_MESSAGE || "R20_SAFARI_EXPORT_JSON",
        });
        if (!payload?.ok) {
          throw new Error(String(payload?.errorMessage || "리딩로그 파일 생성에 실패했습니다."));
        }

        const jsonText = String(payload?.jsonText || "");
        const payloadBytes = getByteLength(jsonText);
        setState({
          stage: "checking_storage",
          message: "앱으로 복사하기 전에 저장 공간을 확인하고 있습니다.",
          filenameBase: String(payload?.filenameBase || measurement.filenameBase || "roll20-chat"),
          payloadBytes,
          jsonText,
        });

        const storagePreflight = await sendNativeMessage(api, {
          type:
            nativeBridgeContract.MESSAGE_TYPES?.storagePreflight ||
            "R20_SAFARI_STORAGE_PREFLIGHT",
          payloadBytes,
        });
        if (!storagePreflight?.ok) {
          throw new Error(
            String(storagePreflight?.errorMessage || "앱 보관함 저장 공간 확인에 실패했습니다.")
          );
        }

        setState({
          stage: "writing_inbox",
          message: "파일을 앱으로 복사하고 있습니다.",
          filenameBase: String(payload?.filenameBase || measurement.filenameBase || "roll20-chat"),
          pendingCount: Number(storagePreflight.pendingCount) || 0,
          pendingBytes: Number(storagePreflight.pendingBytes) || 0,
          jsonText,
          payloadBytes,
        });

        const writeResult = await sendNativeMessage(api, {
          type:
            nativeBridgeContract.MESSAGE_TYPES?.writeInboxExport ||
            "R20_SAFARI_WRITE_INBOX_EXPORT",
          filenameBase: String(payload?.filenameBase || measurement.filenameBase || "roll20-chat"),
          jsonText,
          payloadBytes,
        });
        if (!writeResult?.ok) {
          throw new Error(String(writeResult?.errorMessage || "앱 보관함 복사에 실패했습니다."));
        }

        setState({
          stage: "done",
          message: "복사완료! 앱으로 돌아가주세요.",
          filenameBase: String(payload?.filenameBase || measurement.filenameBase || "roll20-chat"),
          payloadBytes,
          jsonText,
          pendingCount: Number(writeResult.pendingCount) || 0,
          pendingBytes: Number(writeResult.pendingBytes) || 0,
          inboxRelativePath: String(writeResult.inboxRelativePath || ""),
          savedFileName: String(
            writeResult.savedFileName ||
              `${payload?.filenameBase || measurement.filenameBase || "roll20-chat"}.json`
          ),
        });
      } catch (error) {
        setState({
          stage: "error",
          message: error?.message ? String(error.message) : "사파리 가져오기에 실패했습니다.",
          errorMessage: error?.message ? String(error.message) : "사파리 가져오기에 실패했습니다.",
        });
      } finally {
        if (bindings.button) {
          bindings.button.disabled = false;
          bindings.button.textContent = "리딩로그로 복사하기";
        }
      }
    }

    renderState(state, bindings);
    if (bindings.button?.addEventListener) {
      bindings.button.addEventListener("click", handleExportClick);
    }

    return {
      handleExportClick,
      getState() {
        return state;
      },
      render() {
        renderState(state, bindings);
      },
    };
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      createPopupController();
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      createPopupController,
      createDomBindings,
      formatByteSize,
      formatStageLabel,
    };
  }
})();
