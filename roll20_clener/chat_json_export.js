(function () {
  function normalizeMessageText(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim();
  }

  function resolveMessageId(message, index) {
    const direct = String(message?.id || "").trim();
    if (direct) return direct;
    return String((Number(index) || 0) + 1);
  }

  function buildChatJsonEntry({
    id,
    speaker,
    role = "character",
    text,
    imageUrl = null,
    speakerImageUrl = null,
    nameColor = null,
  }) {
    return {
      id: String(id || ""),
      speaker: String(speaker || ""),
      role: String(role || "character"),
      text: String(text || ""),
      imageUrl: imageUrl == null ? null : String(imageUrl),
      speakerImageUrl: speakerImageUrl == null ? null : String(speakerImageUrl),
      nameColor: nameColor == null ? null : String(nameColor),
    };
  }

  const api = {
    normalizeMessageText,
    resolveMessageId,
    buildChatJsonEntry,
  };

  if (typeof window !== "undefined") {
    window.Roll20CleanerChatJson = window.Roll20CleanerChatJson || {};
    Object.assign(window.Roll20CleanerChatJson, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
