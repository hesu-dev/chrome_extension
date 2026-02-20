(function () {
  function normalizeSpeakerName(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim().replace(/:+$/, "").trim();
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

  function shouldInheritMessageContext(role) {
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
