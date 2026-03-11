(function () {
  function createEmptyMaps() {
    return {
      byVariant: new Map(),
      byPair: new Map(),
      byOriginal: new Map(),
    };
  }

  function createAvatarExportResolutionContext(
    { avatarMappings = [], replacements = [] } = {},
    {
      buildReplacementMaps = null,
      toAbsoluteUrl = (value) => String(value || "").trim(),
      normalizeSpeakerName = (value) => String(value || "").trim(),
    } = {}
  ) {
    if (typeof buildReplacementMaps !== "function") {
      return {
        baseMaps: createEmptyMaps(),
        overrideMaps: createEmptyMaps(),
      };
    }

    const baseReplacements = (Array.isArray(avatarMappings) ? avatarMappings : []).map((item) => ({
      name: item?.name || "",
      originalUrl: item?.originalUrl || "",
      avatarUrl: item?.avatarUrl || "",
      newUrl: item?.avatarUrl || "",
    }));

    return {
      baseMaps: buildReplacementMaps(baseReplacements, {
        toAbsoluteUrl,
        normalizeSpeakerName,
      }),
      overrideMaps: buildReplacementMaps(Array.isArray(replacements) ? replacements : [], {
        toAbsoluteUrl,
        normalizeSpeakerName,
      }),
    };
  }

  function resolveAvatarExportUrl(
    message,
    context,
    {
      findReplacementForMessage = null,
      toAbsoluteUrl = (value) => String(value || "").trim(),
      normalizeSpeakerName = (value) => String(value || "").trim(),
    } = {}
  ) {
    const fallbackUrl =
      toAbsoluteUrl(message?.currentAvatarUrl || "") || toAbsoluteUrl(message?.currentSrc || "");
    if (typeof findReplacementForMessage !== "function") return fallbackUrl;

    const overrideUrl = findReplacementForMessage(
      message,
      context?.overrideMaps || createEmptyMaps(),
      { toAbsoluteUrl, normalizeSpeakerName }
    );
    if (overrideUrl) return overrideUrl;

    const baseUrl = findReplacementForMessage(
      message,
      context?.baseMaps || createEmptyMaps(),
      { toAbsoluteUrl, normalizeSpeakerName }
    );
    return baseUrl || fallbackUrl;
  }

  const api = {
    createAvatarExportResolutionContext,
    resolveAvatarExportUrl,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  window.Roll20CleanerAvatarExportResolution = api;
})();
