(function () {
  function isAvatarPathUrl(url) {
    return /\/users\/avatar\/[^/]+\/\d+/i.test(String(url || ""));
  }

  function toText(value) {
    return String(value || "").trim();
  }

  function isAllowedImageUrl(url) {
    const value = toText(url);
    return /^(https?:\/\/|data:image\/)/i.test(value);
  }

  function buildReplacementMaps(replacements, deps = {}) {
    const toAbsoluteUrl = typeof deps.toAbsoluteUrl === "function" ? deps.toAbsoluteUrl : (v) => v;
    const normalizeSpeakerName =
      typeof deps.normalizeSpeakerName === "function" ? deps.normalizeSpeakerName : (v) => toText(v);

    const byVariant = new Map();
    const byPair = new Map();
    const byOriginal = new Map();
    const items = Array.isArray(replacements) ? replacements : [];

    items.forEach((item) => {
      const name = normalizeSpeakerName(item?.name || "");
      const originalUrl = toAbsoluteUrl(item?.originalUrl || "");
      const avatarUrl = toAbsoluteUrl(item?.avatarUrl || "");
      const newUrl = toText(item?.newUrl || "");
      if (!name || !originalUrl || !newUrl || !isAllowedImageUrl(newUrl)) return;

      const variantKey = `${name}|||${originalUrl}|||${avatarUrl}`;
      const pairKey = `${name}|||${originalUrl}`;
      if (avatarUrl) {
        byVariant.set(variantKey, newUrl);
      }
      byPair.set(pairKey, newUrl);
      if (!byOriginal.has(originalUrl)) {
        byOriginal.set(originalUrl, newUrl);
      }
    });

    return { byVariant, byPair, byOriginal };
  }

  function findReplacementForMessage(message, maps, deps = {}) {
    const toAbsoluteUrl = typeof deps.toAbsoluteUrl === "function" ? deps.toAbsoluteUrl : (v) => v;
    const normalizeSpeakerName =
      typeof deps.normalizeSpeakerName === "function" ? deps.normalizeSpeakerName : (v) => toText(v);
    const name = normalizeSpeakerName(message?.name || "");
    const currentSrc = toAbsoluteUrl(message?.currentSrc || "");
    const currentAvatarUrl = toAbsoluteUrl(message?.currentAvatarUrl || "");
    if (!name || !currentSrc) return "";

    const byVariant = maps?.byVariant instanceof Map ? maps.byVariant : new Map();
    const byPair = maps?.byPair instanceof Map ? maps.byPair : new Map();
    const byOriginal = maps?.byOriginal instanceof Map ? maps.byOriginal : new Map();

    const variantKey = `${name}|||${currentSrc}|||${currentAvatarUrl}`;
    const pairKey = `${name}|||${currentSrc}`;
    if (currentAvatarUrl && byVariant.has(variantKey)) return byVariant.get(variantKey) || "";
    if (byPair.has(pairKey)) return byPair.get(pairKey) || "";
    return byOriginal.get(currentSrc) || "";
  }

  const api = {
    isAvatarPathUrl,
    buildReplacementMaps,
    findReplacementForMessage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof window !== "undefined") {
    window.Roll20CleanerAvatarRules = window.Roll20CleanerAvatarRules || {};
    Object.assign(window.Roll20CleanerAvatarRules, api);
  }
})();
