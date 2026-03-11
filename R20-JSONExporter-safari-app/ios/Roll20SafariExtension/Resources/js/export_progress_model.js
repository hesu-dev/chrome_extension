(function () {
  const EXPORT_PROGRESS_STAGES = [
    "idle",
    "checking_page",
    "measuring_dom",
    "building_json",
    "checking_storage",
    "writing_inbox",
    "done",
    "error",
  ];

  function createInitialExportProgress() {
    return {
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
    };
  }

  function updateExportProgress(previous, patch = {}) {
    return {
      ...(previous || createInitialExportProgress()),
      ...(patch || {}),
    };
  }

  const api = {
    EXPORT_PROGRESS_STAGES,
    createInitialExportProgress,
    updateExportProgress,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  window.Roll20SafariExportProgressModel = api;
})();
