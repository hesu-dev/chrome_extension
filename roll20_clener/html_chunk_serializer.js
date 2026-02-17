(function () {
  function chunkString(text, maxChunkSize) {
    const value = String(text || "");
    const parsed = Number(maxChunkSize);
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1024 * 512;
    if (!value) return [];
    if (value.length <= limit) return [value];
    const chunks = [];
    for (let i = 0; i < value.length; i += limit) {
      chunks.push(value.slice(i, i + limit));
    }
    return chunks;
  }

  function escapeHtmlAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function openTag(tagName, attrs) {
    const attrText = (Array.isArray(attrs) ? attrs : [])
      .map((attr) => ` ${attr.name}="${escapeHtmlAttr(attr.value)}"`)
      .join("");
    return `<${tagName}${attrText}>`;
  }

  function createDocumentChunks({
    doctypeName = "",
    htmlAttrs = [],
    headAttrs = [],
    bodyAttrs = [],
    headChildHtml = [],
    bodyChildHtml = [],
    maxChunkSize = 1024 * 512,
  } = {}) {
    const parts = [];
    if (doctypeName) {
      parts.push(`<!DOCTYPE ${doctypeName}>\n`);
    }
    parts.push(openTag("html", htmlAttrs));
    parts.push(openTag("head", headAttrs));
    (Array.isArray(headChildHtml) ? headChildHtml : []).forEach((html) => parts.push(String(html || "")));
    parts.push("</head>");
    parts.push(openTag("body", bodyAttrs));
    (Array.isArray(bodyChildHtml) ? bodyChildHtml : []).forEach((html) => parts.push(String(html || "")));
    parts.push("</body></html>");

    const chunks = [];
    parts.forEach((part) => {
      chunkString(part, maxChunkSize).forEach((segment) => chunks.push(segment));
    });
    return chunks;
  }

  const api = {
    chunkString,
    createDocumentChunks,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof window !== "undefined") {
    window.Roll20CleanerHtmlChunk = window.Roll20CleanerHtmlChunk || {};
    Object.assign(window.Roll20CleanerHtmlChunk, api);
  }
})();
