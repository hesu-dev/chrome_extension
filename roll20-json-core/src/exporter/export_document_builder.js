const chatJson = require("../chat_json_export.js");

function buildExportDocument({ scenarioTitle = "", snapshots = [], compact = true } = {}) {
  const lines = (Array.isArray(snapshots) ? snapshots : []).map((snapshot) =>
    chatJson.buildChatJsonEntry({
      id: snapshot?.id,
      speaker: snapshot?.speaker,
      role: snapshot?.role,
      timestamp: snapshot?.timestamp,
      textColor: snapshot?.textColor,
      text: snapshot?.text,
      imageUrl: snapshot?.imageUrl,
      speakerImageUrl: snapshot?.speakerImageUrl,
      dice: snapshot?.dice,
    })
  );

  const documentPayload = chatJson.buildChatJsonDocument({
    scenarioTitle,
    lines,
  });
  const rawJsonText = compact
    ? JSON.stringify(documentPayload)
    : JSON.stringify(documentPayload, null, 2);
  const jsonText =
    typeof chatJson.normalizeImgurLinksInJsonText === "function"
      ? chatJson.normalizeImgurLinksInJsonText(rawJsonText)
      : rawJsonText;
  const jsonByteLength =
    typeof TextEncoder === "function"
      ? new TextEncoder().encode(jsonText).length
      : Buffer.byteLength(jsonText, "utf8");

  return {
    documentPayload,
    jsonText,
    jsonByteLength,
    lineCount: lines.length,
    ruleType: String(documentPayload?.ebookView?.titlePage?.ruleType || ""),
  };
}

module.exports = {
  buildExportDocument,
};
