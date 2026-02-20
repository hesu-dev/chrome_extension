(function () {
  function normalizeSpeakerName(raw) {
    const compact = String(raw || "").replace(/\s+/g, " ").trim();
    if (!compact) return "";
    if (/^:+$/.test(compact)) return compact;
    return compact.replace(/:+$/, "").trim();
  }

  function resolveMessageContext(current, previous) {
    const prev = previous || {};
    const now = current || {};

    const normalizedSpeaker = normalizeSpeakerName(now.speaker || "");
    const currentAvatarSrc = String(now.avatarSrc || "").trim();
    const currentSpeakerImageUrl = String(now.speakerImageUrl || "").trim();
    const inheritedAvatarSrc = currentAvatarSrc || String(prev.avatarSrc || "");
    const inheritedSpeakerImageUrl =
      currentSpeakerImageUrl || String(prev.speakerImageUrl || "") || inheritedAvatarSrc;

    return {
      speaker: normalizedSpeaker || String(prev.speaker || ""),
      avatarSrc: inheritedAvatarSrc,
      speakerImageUrl: inheritedSpeakerImageUrl,
    };
  }

  function shouldInheritMessageContext(role, options = {}) {
    if (options && (options.hasDescStyle || options.hasEmoteStyle || options.hasAvatar)) {
      return false;
    }
    return true;
  }

  const api = {
    normalizeSpeakerName,
    resolveMessageContext,
    shouldInheritMessageContext,
  };

  if (typeof window !== "undefined") {
    window.Roll20CleanerMessageContext = window.Roll20CleanerMessageContext || {};
    Object.assign(window.Roll20CleanerMessageContext, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
