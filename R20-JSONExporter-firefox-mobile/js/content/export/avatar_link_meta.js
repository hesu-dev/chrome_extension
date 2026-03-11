(function () {
  function normalizeSpeakerName(raw) {
    const compact = String(raw || "").replace(/\s+/g, " ").trim();
    if (!compact) return "";
    if (/^:+$/.test(compact)) return compact;
    return compact.replace(/:+$/, "").trim();
  }

  function toAbsoluteUrl(value) {
    return String(value || "").trim();
  }

  function createAvatarLinkMetaIndex(
    mappings,
    {
      normalizeSpeakerName: normalizeSpeaker = normalizeSpeakerName,
      toAbsoluteUrl: absoluteUrl = toAbsoluteUrl,
    } = {}
  ) {
    const byPair = new Map();
    const byOriginal = new Map();
    const list = Array.isArray(mappings) ? mappings : [];

    list.forEach((item) => {
      const name = normalizeSpeaker(item?.name || "");
      const originalUrl = absoluteUrl(item?.originalUrl || "");
      const avatarUrl = absoluteUrl(item?.avatarUrl || "");
      if (!name || !originalUrl) return;

      const normalized = {
        name,
        originalUrl,
        avatarUrl,
      };
      byPair.set(`${name}|||${originalUrl}`, normalized);
      if (!byOriginal.has(originalUrl)) {
        byOriginal.set(originalUrl, normalized);
      }
    });

    return {
      byPair,
      byOriginal,
    };
  }

  function resolveAvatarLinkMeta(
    source,
    index,
    {
      normalizeSpeakerName: normalizeSpeaker = normalizeSpeakerName,
      toAbsoluteUrl: absoluteUrl = toAbsoluteUrl,
    } = {}
  ) {
    const speaker = normalizeSpeaker(source?.speaker || "");
    const currentSrc = absoluteUrl(source?.currentSrc || "");
    const byPair = index?.byPair instanceof Map ? index.byPair : new Map();
    const byOriginal = index?.byOriginal instanceof Map ? index.byOriginal : new Map();
    const matched = byPair.get(`${speaker}|||${currentSrc}`) || byOriginal.get(currentSrc) || null;
    const originalUrl = matched?.originalUrl || currentSrc || "";
    const redirectedUrl = matched?.avatarUrl || currentSrc || "";

    return {
      originalUrl,
      redirectedUrl,
      effectiveUrl: redirectedUrl || originalUrl || "",
    };
  }

  const api = {
    createAvatarLinkMetaIndex,
    resolveAvatarLinkMeta,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  window.Roll20CleanerAvatarLinkMeta = api;
})();
