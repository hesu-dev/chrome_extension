(function () {
  function computeExpectedRootClassEnabled({
    colorFilterEnabled = false,
    hiddenTextEnabled = false,
  } = {}) {
    return !!(colorFilterEnabled || hiddenTextEnabled);
  }

  function isRootClassApplied(response, expectedEnabled) {
    if (!response || response.ok !== true) return false;
    if (typeof response.rootClassApplied !== "boolean") return false;

    if (
      typeof response.desiredRootClassEnabled === "boolean" &&
      response.desiredRootClassEnabled !== expectedEnabled
    ) {
      return false;
    }

    return response.rootClassApplied === expectedEnabled;
  }

  const api = {
    computeExpectedRootClassEnabled,
    isRootClassApplied,
  };

  if (typeof window !== "undefined") {
    window.Roll20CleanerSettingApply = window.Roll20CleanerSettingApply || {};
    Object.assign(window.Roll20CleanerSettingApply, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
