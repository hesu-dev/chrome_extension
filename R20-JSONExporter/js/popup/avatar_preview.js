(function () {
  function normalizeUrl(raw) {
    return String(raw || "").trim();
  }

  function resolveAvatarPreviewUrl(input, { fallbackUrl = "" } = {}) {
    const value = normalizeUrl(input?.value);
    if (value) return value;
    return "";
  }

  function syncAvatarPreviewWithInput(input, preview, options = {}) {
    if (!preview) return "";
    const nextUrl = resolveAvatarPreviewUrl(input, options);
    if (nextUrl) {
      preview.src = nextUrl;
    } else if (typeof preview.removeAttribute === "function") {
      preview.removeAttribute("src");
    } else {
      preview.src = "";
    }
    return nextUrl;
  }

  function bindAvatarPreviewInput(input, preview, options = {}) {
    if (!input || !preview || typeof input.addEventListener !== "function") return () => "";
    const sync = () => syncAvatarPreviewWithInput(input, preview, options);
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
    sync();
    return sync;
  }

  const api = {
    resolveAvatarPreviewUrl,
    syncAvatarPreviewWithInput,
    bindAvatarPreviewInput,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  window.Roll20CleanerAvatarPreview = api;
})();
