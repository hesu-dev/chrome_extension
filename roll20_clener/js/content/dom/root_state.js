(function () {
  function computeRootClassDesired(settings) {
    return !!(settings?.colorFilterEnabled || settings?.hiddenTextEnabled);
  }

  function syncRootClass(classList, rootClass, desiredEnabled) {
    if (!classList || !rootClass) return false;

    const hasClass = !!classList.contains(rootClass);
    if (desiredEnabled && !hasClass) {
      classList.add(rootClass);
      return true;
    }

    if (!desiredEnabled && hasClass) {
      classList.remove(rootClass);
      return true;
    }

    return false;
  }

  function shouldResyncOnMutations(mutations, rootEl) {
    if (!Array.isArray(mutations) || !rootEl) return false;
    return mutations.some(
      (mutation) =>
        mutation?.type === "attributes" &&
        mutation?.attributeName === "class" &&
        mutation?.target === rootEl
    );
  }

  function createCoalescedScheduler(callback) {
    let scheduled = false;

    return function schedule() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        callback();
      }, 0);
    };
  }

  const api = {
    computeRootClassDesired,
    syncRootClass,
    shouldResyncOnMutations,
    createCoalescedScheduler,
  };

  if (typeof window !== "undefined") {
    window.Roll20CleanerRootState = window.Roll20CleanerRootState || {};
    Object.assign(window.Roll20CleanerRootState, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
