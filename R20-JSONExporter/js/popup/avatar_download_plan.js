(function () {
  function normalizeUrl(raw) {
    return String(raw || "").trim();
  }

  function collectAvatarReplacementsFromInputs(inputs, { onlyChanged = false } = {}) {
    const rows = Array.from(inputs || []);
    const replacements = [];

    rows.forEach((input) => {
      const id = input?.dataset?.id;
      const name = input?.dataset?.name;
      const originalUrl = normalizeUrl(input?.dataset?.originalUrl);
      const initialUrl = normalizeUrl(input?.dataset?.initialUrl);
      const value = normalizeUrl(input?.value);
      if (!id || !name || !originalUrl || !value) return;
      if (onlyChanged && value === initialUrl) return;
      replacements.push({
        id,
        name,
        originalUrl,
        ...(normalizeUrl(input?.dataset?.avatarUrl)
          ? { avatarUrl: normalizeUrl(input.dataset.avatarUrl) }
          : {}),
        newUrl: value,
      });
    });

    return replacements;
  }

  function resolveReadingLogDownloadMode(replacements) {
    return Array.isArray(replacements) && replacements.length > 0 ? "mapped" : "direct";
  }

  const api = {
    collectAvatarReplacementsFromInputs,
    resolveReadingLogDownloadMode,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  window.Roll20CleanerAvatarDownloadPlan = api;
})();
