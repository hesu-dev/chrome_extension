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
    const previousSpeaker = normalizeSpeakerName(prev.speaker || "");
    const canInheritAvatarContext =
      !normalizedSpeaker || normalizedSpeaker === previousSpeaker;
    const currentAvatarSrc = String(now.avatarSrc || "").trim();
    const currentSpeakerImageUrl = String(now.speakerImageUrl || "").trim();
    const currentTimestamp = String(now.timestamp || "").replace(/\s+/g, " ").trim();
    const inheritedAvatarSrc =
      currentAvatarSrc || (canInheritAvatarContext ? String(prev.avatarSrc || "") : "");
    const inheritedSpeakerImageUrl =
      currentSpeakerImageUrl ||
      (canInheritAvatarContext ? String(prev.speakerImageUrl || "") : "") ||
      inheritedAvatarSrc;
    const inheritedTimestamp = currentTimestamp || String(prev.timestamp || "");

    return {
      speaker: normalizedSpeaker || previousSpeaker || "",
      avatarSrc: inheritedAvatarSrc,
      speakerImageUrl: inheritedSpeakerImageUrl,
      timestamp: inheritedTimestamp,
    };
  }

  function shouldInheritMessageContext(role, options = {}) {
    if (options && (options.hasDescStyle || options.hasEmoteStyle)) {
      return false;
    }
    if (String(role || "").toLowerCase() === "system") {
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
