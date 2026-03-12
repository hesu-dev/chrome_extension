function toText(value) {
  return String(value || "").trim();
}

function isAllowedImageUrl(url) {
  const value = toText(url);
  return /^(https?:\/\/|data:image\/)/i.test(value);
}

function createEmptyMaps() {
  return {
    byVariant: new Map(),
    byPair: new Map(),
    byOriginal: new Map(),
  };
}

function buildReplacementMaps(replacements, deps = {}) {
  const toAbsoluteUrl =
    typeof deps.toAbsoluteUrl === "function" ? deps.toAbsoluteUrl : (value) => toText(value);
  const normalizeSpeakerName =
    typeof deps.normalizeSpeakerName === "function"
      ? deps.normalizeSpeakerName
      : (value) => toText(value);

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
  const toAbsoluteUrl =
    typeof deps.toAbsoluteUrl === "function" ? deps.toAbsoluteUrl : (value) => toText(value);
  const normalizeSpeakerName =
    typeof deps.normalizeSpeakerName === "function"
      ? deps.normalizeSpeakerName
      : (value) => toText(value);

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

function createAvatarExportResolutionContext(
  { avatarMappings = [], replacements = [] } = {},
  {
    toAbsoluteUrl = (value) => toText(value),
    normalizeSpeakerName = (value) => toText(value),
    buildMaps = buildReplacementMaps,
  } = {}
) {
  if (typeof buildMaps !== "function") {
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
    baseMaps: buildMaps(baseReplacements, {
      toAbsoluteUrl,
      normalizeSpeakerName,
    }),
    overrideMaps: buildMaps(Array.isArray(replacements) ? replacements : [], {
      toAbsoluteUrl,
      normalizeSpeakerName,
    }),
  };
}

function resolveAvatarExportUrl(
  message,
  context,
  {
    toAbsoluteUrl = (value) => toText(value),
    normalizeSpeakerName = (value) => toText(value),
    findReplacement = findReplacementForMessage,
  } = {}
) {
  const fallbackUrl =
    toAbsoluteUrl(message?.currentAvatarUrl || "") || toAbsoluteUrl(message?.currentSrc || "");
  if (typeof findReplacement !== "function") return fallbackUrl;

  const overrideUrl = findReplacement(
    message,
    context?.overrideMaps || createEmptyMaps(),
    { toAbsoluteUrl, normalizeSpeakerName }
  );
  if (overrideUrl) return overrideUrl;

  const baseUrl = findReplacement(
    message,
    context?.baseMaps || createEmptyMaps(),
    { toAbsoluteUrl, normalizeSpeakerName }
  );
  return baseUrl || fallbackUrl;
}

module.exports = {
  createEmptyMaps,
  buildReplacementMaps,
  findReplacementForMessage,
  createAvatarExportResolutionContext,
  resolveAvatarExportUrl,
};
