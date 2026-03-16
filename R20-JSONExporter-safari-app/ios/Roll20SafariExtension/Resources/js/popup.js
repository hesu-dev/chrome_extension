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
        return "Checking Page";
      case "measuring_dom":
        return "Measuring DOM";
      case "building_json":
        return "Building JSON";
      case "checking_storage":
        return "Checking Storage";
      case "writing_inbox":
        return "Writing Inbox";
      case "done":
        return "Done";
      case "error":
        return "Error";
      default:
        return "Idle";
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

  function formatPendingExportCount(count) {
    const numeric = Number(count) || 0;
    return numeric === 1 ? "1 pending export" : `${numeric} pending exports`;
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
        : "Pending";
    }
    if (bindings.statusMetrics) {
      const metrics = state?.metrics;
      bindings.statusMetrics.textContent = metrics
        ? `${metrics.messageCount} messages · ${metrics.domNodeEstimate} DOM nodes`
        : "No Roll20 measurement yet.";
    }
    if (bindings.statusPayload) {
      bindings.statusPayload.textContent =
        state?.payloadBytes > 0
          ? `${formatByteSize(state.payloadBytes)} current file size`
          : "File size not measured yet.";
    }
    if (bindings.statusInbox) {
      if (state?.savedFileName) {
        bindings.statusInbox.textContent = `${state.savedFileName} · ${formatPendingExportCount(
          state.pendingCount
        )}`;
      } else if (state?.pendingCount > 0) {
        bindings.statusInbox.textContent = formatPendingExportCount(state.pendingCount);
      } else {
        bindings.statusInbox.textContent = "Inbox not written yet.";
      }
    }
  }

  function createPopupController({
    api = getWebExtensionApi(),
    doc = getDefaultDocument(),
    progressApi = progressModel,
  } = {}) {
    const bindings = createDomBindings(doc);
    const createInitialExportProgress =
      typeof progressApi.createInitialExportProgress === "function"
        ? progressApi.createInitialExportProgress
        : () => ({
            stage: "idle",
            message: "Ready to export Roll20 chat.",
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

    async function handleExportClick() {
      if (bindings.button) {
        bindings.button.disabled = true;
        bindings.button.textContent = "Exporting...";
      }

      try {
        setState({
          stage: "checking_page",
          message: "Checking the active Safari tab for Roll20.",
        });

        const tab = await queryActiveTab(api);
        if (!tab?.id) {
          throw new Error("Open a Roll20 tab in Safari first.");
        }

        setState({
          stage: "measuring_dom",
          message: "Measuring the loaded Roll20 chat DOM.",
        });
        const measurement = await sendTabMessage(api, tab.id, {
          type: contentApi.SAFARI_MEASURE_MESSAGE || "R20_SAFARI_EXPORT_MEASURE",
        });
        if (!measurement?.ok) {
          throw new Error(String(measurement?.errorMessage || "Roll20 DOM measurement failed."));
        }

        setState({
          stage: "measuring_dom",
          message: "Measured current Roll20 chat DOM.",
          filenameBase: String(measurement.filenameBase || ""),
          metrics: {
            messageCount: Number(measurement.messageCount) || 0,
            domNodeEstimate: Number(measurement.domNodeEstimate) || 0,
          },
        });

        setState({
          stage: "building_json",
          message: "Building portable Roll20 chat JSON.",
        });
        const payload = await sendTabMessage(api, tab.id, {
          type: contentApi.SAFARI_EXPORT_JSON_MESSAGE || "R20_SAFARI_EXPORT_JSON",
        });
        if (!payload?.ok) {
          throw new Error(String(payload?.errorMessage || "Roll20 JSON build failed."));
        }

        const jsonText = String(payload?.jsonText || "");
        const payloadBytes = getByteLength(jsonText);
        setState({
          stage: "checking_storage",
          message: "Checking App Group storage budget before writing the inbox export.",
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
            String(storagePreflight?.errorMessage || "Safari inbox storage preflight failed.")
          );
        }

        setState({
          stage: "writing_inbox",
          message: "Writing the JSON export into the Safari inbox.",
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
          throw new Error(String(writeResult?.errorMessage || "Safari inbox write failed."));
        }

        setState({
          stage: "done",
          message: "Saved to the Safari inbox. Open the standalone app to review pending exports.",
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
          message: error?.message ? String(error.message) : "Safari export failed.",
          errorMessage: error?.message ? String(error.message) : "Safari export failed.",
        });
      } finally {
        if (bindings.button) {
          bindings.button.disabled = false;
          bindings.button.textContent =
            state.stage === "done" ? "Export Again" : "Export Roll20 JSON";
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
