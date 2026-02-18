(function () {
  const SAVED_STATUS_MESSAGE = "설정은 저장되었습니다. 반영되었으니 화면을 확인해주세요.";

  function getSavedStatusMessage() {
    return SAVED_STATUS_MESSAGE;
  }

  function isNonFatalApplyDispatchError(rawMessage) {
    const message = String(rawMessage || "").toLowerCase();
    if (!message) return false;

    return (
      message.includes("message port closed before a response was received") ||
      message.includes("receiving end does not exist") ||
      message.includes("cannot access contents of url") ||
      message.includes("the tab was closed") ||
      message.includes("no tab with id")
    );
  }

  function toApplyProgressPercent(processed, total) {
    const safeProcessed = Math.max(0, Number(processed) || 0);
    const safeTotal = Math.max(1, Number(total) || 1);
    const ratio = Math.min(1, safeProcessed / safeTotal);
    // Keep 100% for DONE event so progress UI doesn't show completion early.
    return 15 + Math.floor(ratio * 80);
  }

  const api = {
    getSavedStatusMessage,
    isNonFatalApplyDispatchError,
    toApplyProgressPercent,
  };

  if (typeof window !== "undefined") {
    window.Roll20CleanerFilterApplyFeedback = window.Roll20CleanerFilterApplyFeedback || {};
    Object.assign(window.Roll20CleanerFilterApplyFeedback, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
