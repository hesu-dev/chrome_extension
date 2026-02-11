if (globalThis.__roll20CleanerContentLoaded) {
  // Already injected; avoid redeclaring top-level bindings.
} else {
globalThis.__roll20CleanerContentLoaded = true;

const ROOT_CLASS = "roll20-cleaner-enabled";
const MESSAGE_SELECTOR = "div.message";
const HIDDEN_TEXT = "This message has been hidden";
const COLOR_HIDE_ATTR = "data-roll20-cleaner-color-hide";
const TEXT_HIDE_ATTR = "data-roll20-cleaner-text-hide";
const PREV_DISPLAY_ATTR = "data-roll20-cleaner-prev-display";
const INLINE_FETCH_TIMEOUT_MS = 10000;
const avatarRedirectCache = new Map();

const settings = {
  colorFilterEnabled: false,
  hiddenTextEnabled: false,
  targetColor: "#aaaaaa",
  styleQuery: null,
};

function normalizeColor(color) {
  if (!color) return "";
  const swatch = document.createElement("span");
  swatch.style.color = color;
  document.body.appendChild(swatch);
  const normalized = getComputedStyle(swatch).color;
  swatch.remove();
  return normalized;
}

function extractColorValue(rawInput) {
  const raw = (rawInput || "").trim();
  if (!raw) return "";
  const match = raw.match(/color\s*:\s*([^;]+)/i);
  if (match?.[1]) return match[1].trim();
  return raw;
}

function normalizeStyleKey(rawKey) {
  const key = (rawKey || "").trim().toLowerCase();
  if (!key) return "color";
  if (key === "컬러" || key === "색상") return "color";
  if (key === "오퍼시티" || key === "투명도") return "opacity";
  if (key === "글자색" || key === "폰트색") return "color";
  return key;
}

function parseStyleQuery(rawInput) {
  const raw = (rawInput || "").trim();
  if (!raw) return null;
  const unquoted = raw.replace(/^["']\s*|\s*["']$/g, "").trim();
  if (!unquoted) return null;

  const match = unquoted.match(/^([^:=]+?)\s*[:=]\s*(.+)$/);
  let key = "color";
  let value = unquoted;
  if (match) {
    key = normalizeStyleKey(match[1]);
    value = match[2].trim().replace(/;$/, "").trim();
  } else {
    value = extractColorValue(unquoted);
    key = "color";
  }

  if (!value) return null;

  return { key, value };
}

function getInlineStyleValue(styleText, key) {
  if (!styleText || !key) return "";
  const regex = new RegExp(`(?:^|;)\\s*${key}\\s*:\\s*([^;]+)`, "i");
  const match = styleText.match(regex);
  return match?.[1]?.trim() || "";
}

function updateRootState() {
  document.documentElement.classList.toggle(
    ROOT_CLASS,
    settings.colorFilterEnabled || settings.hiddenTextEnabled
  );
}

function markHidden(el, reasonAttr) {
  if (el.hasAttribute(reasonAttr)) return;
  el.setAttribute(reasonAttr, "true");
  if (!el.hasAttribute(PREV_DISPLAY_ATTR)) {
    el.setAttribute(PREV_DISPLAY_ATTR, el.style.display || "");
  }
  el.style.display = "none";
}

function unmarkHidden(el, reasonAttr) {
  if (!el.hasAttribute(reasonAttr)) return;
  el.removeAttribute(reasonAttr);
  const stillHidden =
    el.hasAttribute(COLOR_HIDE_ATTR) || el.hasAttribute(TEXT_HIDE_ATTR);
  if (stillHidden) {
    el.style.display = "none";
    return;
  }

  const prev = el.getAttribute(PREV_DISPLAY_ATTR);
  el.removeAttribute(PREV_DISPLAY_ATTR);
  if (prev) {
    el.style.display = prev;
    return;
  }
  el.style.removeProperty("display");
}

function getTargetSpan(messageEl) {
  const spans = messageEl.querySelectorAll("span");
  if (spans.length < 3) return null;
  return spans[2];
}

function getInlineColor(styleText) {
  if (!styleText) return "";
  const match = styleText.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  return match?.[1]?.trim() || "";
}

function isStyleValueMatch(actualValue, expectedValue, key) {
  if (!actualValue) return false;
  const actual = String(actualValue).trim().toLowerCase();
  const expected = String(expectedValue).trim().toLowerCase();

  if (key === "color") {
    const actualColor = normalizeColor(actual);
    const expectedColor = normalizeColor(expected);
    return !!actualColor && !!expectedColor && actualColor === expectedColor;
  }

  if (key === "opacity") {
    const actualNum = Number.parseFloat(actual);
    const expectedNum = Number.parseFloat(expected);
    if (Number.isFinite(actualNum) && Number.isFinite(expectedNum)) {
      return Math.abs(actualNum - expectedNum) < 0.001;
    }
  }

  return actual === expected;
}

function hasMatchingStyleInMessage(messageEl) {
  if (!settings.styleQuery) return false;
  const { key, value } = settings.styleQuery;

  const thirdSpan = getTargetSpan(messageEl);
  if (thirdSpan) {
    const computed = getComputedStyle(thirdSpan);
    const computedValue = computed.getPropertyValue(key);
    if (isStyleValueMatch(computedValue, value, key)) return true;
  }

  const styledNodes = messageEl.querySelectorAll("[style]");
  for (const node of styledNodes) {
    const inlineStyle = node.getAttribute("style") || "";
    const inlineValue = getInlineStyleValue(inlineStyle, key);
    if (inlineValue && isStyleValueMatch(inlineValue, value, key)) {
      return true;
    }

    const computed = getComputedStyle(node);
    const actualValue = computed.getPropertyValue(key);
    if (isStyleValueMatch(actualValue, value, key)) {
      return true;
    }
  }

  return false;
}

function applyColorFilter(root) {
  const rootEl = root.nodeType === 1 ? root : document.documentElement;
  const candidates = rootEl.matches?.(MESSAGE_SELECTOR)
    ? [rootEl]
    : [];
  const messages = rootEl.querySelectorAll
    ? rootEl.querySelectorAll(MESSAGE_SELECTOR)
    : [];
  candidates.push(...messages);

  candidates.forEach((messageEl) => {
    if (!settings.colorFilterEnabled || !settings.styleQuery) {
      unmarkHidden(messageEl, COLOR_HIDE_ATTR);
      return;
    }
    if (hasMatchingStyleInMessage(messageEl)) {
      markHidden(messageEl, COLOR_HIDE_ATTR);
    } else {
      unmarkHidden(messageEl, COLOR_HIDE_ATTR);
    }
  });
}

function applyHiddenTextFilter(root) {
  const rootEl = root.nodeType === 1 ? root : document.documentElement;
  const messages = rootEl.matches?.(MESSAGE_SELECTOR) ? [rootEl] : [];
  const messageNodes = rootEl.querySelectorAll
    ? rootEl.querySelectorAll(MESSAGE_SELECTOR)
    : [];
  messages.push(...messageNodes);

  // Clean up stale markers from older logic that may have hidden non-message containers.
  if (rootEl === document.documentElement) {
    const stale = document.querySelectorAll(`[${TEXT_HIDE_ATTR}]`);
    stale.forEach((el) => {
      if (!el.matches?.(MESSAGE_SELECTOR)) {
        unmarkHidden(el, TEXT_HIDE_ATTR);
      }
    });
  }

  messages.forEach((messageEl) => {
    if (!settings.hiddenTextEnabled) {
      unmarkHidden(messageEl, TEXT_HIDE_ATTR);
      return;
    }
    if (messageEl.textContent?.includes(HIDDEN_TEXT)) {
      markHidden(messageEl, TEXT_HIDE_ATTR);
    } else {
      unmarkHidden(messageEl, TEXT_HIDE_ATTR);
    }
  });
}

function applyFilters(root) {
  applyColorFilter(root);
  applyHiddenTextFilter(root);
}

function refreshSettings(next) {
  settings.colorFilterEnabled = next.colorFilterEnabled;
  settings.hiddenTextEnabled = next.hiddenTextEnabled;
  settings.targetColor = next.targetColor;
  settings.styleQuery = parseStyleQuery(settings.targetColor);
  updateRootState();
  applyFilters(document.documentElement);
}

chrome.storage.sync.get(
  { colorFilterEnabled: false, hiddenTextEnabled: false, targetColor: "#aaaaaa" },
  refreshSettings
);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  const next = {
    colorFilterEnabled:
      changes.colorFilterEnabled?.newValue ?? settings.colorFilterEnabled,
    hiddenTextEnabled:
      changes.hiddenTextEnabled?.newValue ?? settings.hiddenTextEnabled,
    targetColor: changes.targetColor?.newValue ?? settings.targetColor,
  };
  refreshSettings(next);
});

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => applyFilters(node));
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

function pruneHidden(originalNode, cloneNode) {
  if (originalNode.nodeType !== 1) return;

  const style = getComputedStyle(originalNode);
  if (style.display === "none") {
    cloneNode.remove();
    return;
  }

  const originalChildren = Array.from(originalNode.childNodes);
  const cloneChildren = Array.from(cloneNode.childNodes);
  for (let i = 0; i < originalChildren.length; i += 1) {
    const originalChild = originalChildren[i];
    const cloneChild = cloneChildren[i];
    if (!cloneChild) continue;
    if (originalChild.nodeType === 1) {
      pruneHidden(originalChild, cloneChild);
    }
  }
}

function removeSheetTemplateAreaNewlines(root) {
  const areas = root.querySelectorAll("div.sheet-template-area");
  areas.forEach((area) => {
    const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node = walker.nextNode();
    while (node) {
      textNodes.push(node);
      node = walker.nextNode();
    }

    textNodes.forEach((textNode) => {
      const raw = textNode.nodeValue || "";
      const normalized = raw.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ");
      if (normalized.trim() === "") {
        textNode.nodeValue = "";
        return;
      }
      textNode.nodeValue = normalized.trim();
    });

    // Remove empty text nodes created by whitespace normalization.
    const cleanupWalker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
    const removable = [];
    let cleanupNode = cleanupWalker.nextNode();
    while (cleanupNode) {
      if ((cleanupNode.nodeValue || "").trim() === "") {
        removable.push(cleanupNode);
      }
      cleanupNode = cleanupWalker.nextNode();
    }
    removable.forEach((node) => node.remove());
  });
}

async function resolveAvatarUrl(url) {
  const absolute = toAbsoluteUrl(url);
  if (!absolute) return "";
  if (!/\/users\/avatar\/\d+\/\d+/i.test(absolute)) return absolute;
  if (avatarRedirectCache.has(absolute)) return avatarRedirectCache.get(absolute);

  try {
    // Manual redirect lets us read Location from same-origin redirect response.
    const response = await fetch(absolute, {
      method: "GET",
      redirect: "manual",
      credentials: "include",
    });
    const location = response.headers.get("location");
    const resolved = location ? toAbsoluteUrl(location, absolute) : absolute;
    avatarRedirectCache.set(absolute, resolved || absolute);
    return resolved || absolute;
  } catch (error) {
    avatarRedirectCache.set(absolute, absolute);
    return absolute;
  }
}

async function absolutizeResourceUrls(clone) {
  const fixAttr = (selector, attr) => {
    const nodes = clone.querySelectorAll(selector);
    nodes.forEach((node) => {
      const raw = node.getAttribute(attr);
      if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return;
      const absolute = toAbsoluteUrl(raw);
      if (absolute) node.setAttribute(attr, absolute);
    });
  };

  fixAttr("img[src]", "src");
  fixAttr("source[src]", "src");
  fixAttr("a[href]", "href");
  fixAttr("link[href]", "href");

  // Resolve Roll20 avatar redirect URLs to their final absolute URL (e.g., gravatar).
  const avatarImgs = Array.from(clone.querySelectorAll("img[src]"));
  for (const img of avatarImgs) {
    const src = img.getAttribute("src") || "";
    if (!/\/users\/avatar\/\d+\/\d+/i.test(src)) continue;
    const finalUrl = await resolveAvatarUrl(src);
    if (finalUrl) img.setAttribute("src", finalUrl);
  }
}

async function buildVisibleHtml() {
  const clone = document.documentElement.cloneNode(true);
  pruneHidden(document.documentElement, clone);
  removeSheetTemplateAreaNewlines(clone);
  removeNonSingleFileAttrs(clone);
  await absolutizeResourceUrls(clone);
  const serializer = new XMLSerializer();
  const html = serializer.serializeToString(clone);
  if (document.doctype) {
    return `<!DOCTYPE ${document.doctype.name}>\n${html}`;
  }
  return html;
}

function stripHeadJsAndCss(clone) {
  const head = clone.querySelector("head");
  if (!head) return;
  const targets = head.querySelectorAll(
    'script, style, link[rel*="stylesheet" i], link[as="style" i]'
  );
  targets.forEach((node) => node.remove());
}

async function buildVisibleHtmlWithoutHeadAssets() {
  const clone = document.documentElement.cloneNode(true);
  pruneHidden(document.documentElement, clone);
  removeSheetTemplateAreaNewlines(clone);
  removeNonSingleFileAttrs(clone);
  await absolutizeResourceUrls(clone);
  stripHeadJsAndCss(clone);
  const serializer = new XMLSerializer();
  const html = serializer.serializeToString(clone);
  if (document.doctype) {
    return `<!DOCTYPE ${document.doctype.name}>\n${html}`;
  }
  return html;
}

function parseCampaignNameFromHref(href) {
  if (!href) return "";
  const match = href.match(/\/campaigns\/details\/\d+\/([^/?#]+)/i);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]).trim();
  } catch (error) {
    return match[1].trim();
  }
}

function extractCampaignNameFromHref() {
  const anchors = Array.from(document.querySelectorAll('a[href*="/campaigns/details/"]'));
  for (const anchor of anchors) {
    const name = parseCampaignNameFromHref(anchor.getAttribute("href") || "");
    if (name) return name;
  }
  return "";
}

function getDownloadNameBase() {
  return extractCampaignNameFromHref() || document.title || "roll20-chat";
}

function normalizeSpeakerName(raw) {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  return text.replace(/:+$/, "").trim();
}

function getMessageSpeakerName(messageEl) {
  const byEl = Array.from(messageEl.children).find(
    (child) => child.matches?.("span.by")
  );
  return normalizeSpeakerName(byEl?.textContent || "");
}

function getMessageAvatarImg(messageEl) {
  const avatarWrap = Array.from(messageEl.children).find(
    (child) => child.classList?.contains("avatar")
  );
  if (!avatarWrap) return null;
  return avatarWrap.querySelector("img");
}

async function collectAvatarMappingsFromRoot(root) {
  const messages = root.querySelectorAll("div.message");
  const byPair = new Map();

  for (const messageEl of messages) {
    const name = getMessageSpeakerName(messageEl);
    const imgEl = getMessageAvatarImg(messageEl);
    if (!name || !imgEl) continue;
    const src = imgEl.getAttribute("src") || "";
    if (!name || !src) continue;
    const resolvedSrc = await resolveAvatarUrl(src);
    const finalSrc = resolvedSrc || toAbsoluteUrl(src) || src;

    const pairKey = `${name}|||${finalSrc}`;
    if (!byPair.has(pairKey)) {
      byPair.set(pairKey, {
        id: pairKey,
        name,
        avatarUrl: finalSrc,
        originalUrl: finalSrc,
      });
    }
  }

  return Array.from(byPair.values());
}

function applyAvatarReplacementsToClone(clone, replacements) {
  const normalizedReplacements = new Map();
  (Array.isArray(replacements) ? replacements : []).forEach((item) => {
    const name = normalizeSpeakerName(item?.name || "");
    const originalUrl = toAbsoluteUrl(item?.originalUrl || "");
    const newUrl = (item?.newUrl || "").trim();
    if (!name || !originalUrl || !newUrl) return;
    normalizedReplacements.set(`${name}|||${originalUrl}`, newUrl);
  });

  if (!normalizedReplacements.size) return;

  const messageNodes = clone.querySelectorAll("div.message");
  messageNodes.forEach((messageEl) => {
    const name = getMessageSpeakerName(messageEl);
    const imgEl = getMessageAvatarImg(messageEl);
    if (!name || !imgEl) return;
    const currentSrc = toAbsoluteUrl(imgEl.getAttribute("src") || "");
    const replacement = normalizedReplacements.get(`${name}|||${currentSrc}`);
    if (replacement) imgEl.setAttribute("src", replacement);
  });
}

async function buildVisibleHtmlWithAvatarReplacements(replacements) {
  const clone = document.documentElement.cloneNode(true);
  pruneHidden(document.documentElement, clone);
  removeSheetTemplateAreaNewlines(clone);
  removeNonSingleFileAttrs(clone);
  applyAvatarReplacementsToClone(clone, replacements);
  await absolutizeResourceUrls(clone);

  const serializer = new XMLSerializer();
  const html = serializer.serializeToString(clone);
  if (document.doctype) {
    return `<!DOCTYPE ${document.doctype.name}>\n${html}`;
  }
  return html;
}

function sanitizeFilenameBase(name) {
  const value = (name || "").trim();
  const cleaned = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim();
  return cleaned || "roll20-chat";
}

function downloadHtmlInPage(html, filenameBase) {
  const filename = `${sanitizeFilenameBase(filenameBase)}.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function toAbsoluteUrl(url, baseUrl = document.baseURI) {
  try {
    return new URL(url, baseUrl).href;
  } catch (error) {
    return "";
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to convert blob to data URL"));
    reader.readAsDataURL(blob);
  });
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INLINE_FETCH_TIMEOUT_MS);
  const response = await fetch(url, {
    credentials: "include",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

function rewriteCssUrls(cssText, baseUrl) {
  return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, quote, rawUrl) => {
    const value = (rawUrl || "").trim();
    if (!value || value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("#")) {
      return full;
    }
    const absolute = toAbsoluteUrl(value, baseUrl);
    if (!absolute) return full;
    return `url("${absolute}")`;
  });
}

async function resolveImportedCss(cssText, baseUrl, depth = 0) {
  if (depth > 4) return rewriteCssUrls(cssText, baseUrl);
  const importRegex = /@import\s+(?:url\(\s*)?['"]?([^'")\s]+)['"]?\s*\)?\s*([^;]*);/gi;
  let result = "";
  let lastIndex = 0;
  let match = importRegex.exec(cssText);

  while (match) {
    const full = match[0];
    const importUrl = match[1];
    const media = (match[2] || "").trim();
    result += cssText.slice(lastIndex, match.index);
    lastIndex = match.index + full.length;

    const absoluteImportUrl = toAbsoluteUrl(importUrl, baseUrl);
    if (!absoluteImportUrl) {
      match = importRegex.exec(cssText);
      continue;
    }

    try {
      const importedCss = await fetchText(absoluteImportUrl);
      const resolvedCss = await resolveImportedCss(importedCss, absoluteImportUrl, depth + 1);
      if (media) {
        result += `@media ${media} {\n${resolvedCss}\n}\n`;
      } else {
        result += `${resolvedCss}\n`;
      }
    } catch (error) {
      // Keep moving even if one imported stylesheet fails.
    }

    match = importRegex.exec(cssText);
  }

  result += cssText.slice(lastIndex);
  return rewriteCssUrls(result, baseUrl);
}

async function fetchDataUrl(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INLINE_FETCH_TIMEOUT_MS);
  const response = await fetch(url, {
    credentials: "include",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

async function inlineStyles(doc) {
  const createEl = (tag) => (doc.ownerDocument || document).createElement(tag);
  const links = Array.from(doc.querySelectorAll("link[href]")).filter((link) => {
    const rel = (link.getAttribute("rel") || "").toLowerCase();
    const as = (link.getAttribute("as") || "").toLowerCase();
    return rel.includes("stylesheet") || as === "style";
  });

  for (const link of links) {
    const href = link.getAttribute("href");
    const absoluteUrl = toAbsoluteUrl(href);
    if (!absoluteUrl) continue;
    try {
      const cssText = await fetchText(absoluteUrl);
      const resolvedCss = await resolveImportedCss(cssText, absoluteUrl);
      const styleEl = createEl("style");
      styleEl.setAttribute("data-roll20-cleaner-source", absoluteUrl);
      styleEl.textContent = resolvedCss;
      link.replaceWith(styleEl);
    } catch (error) {
      // Keep original link if fetch fails due to CORS or network issues.
    }
  }

  const styleTags = Array.from(doc.querySelectorAll("style"));
  for (const styleTag of styleTags) {
    const raw = styleTag.textContent || "";
    if (!raw.includes("@import")) continue;
    try {
      styleTag.textContent = await resolveImportedCss(raw, document.baseURI);
    } catch (error) {
      // Leave style as-is if resolving fails.
    }
  }
}

function inlineRuntimeStyleSheets(doc) {
  const collected = [];
  const sheets = Array.from(document.styleSheets || []);

  for (const sheet of sheets) {
    try {
      const href = sheet.href || "";
      if (href.startsWith("chrome-extension://")) continue;
      const rules = sheet.cssRules;
      if (!rules || !rules.length) continue;

      let cssText = "";
      for (const rule of rules) {
        cssText += `${rule.cssText}\n`;
      }
      if (!cssText.trim()) continue;

      const marker = href ? `/* runtime stylesheet: ${href} */\n` : "/* runtime stylesheet */\n";
      collected.push(marker + cssText);
    } catch (error) {
      // Some styleSheets are not readable due to CORS; skip them.
    }
  }

  if (!collected.length) return;
  const styleEl = (doc.ownerDocument || document).createElement("style");
  styleEl.setAttribute("data-roll20-cleaner-runtime-styles", "true");
  styleEl.textContent = collected.join("\n");
  const target = doc.querySelector("head");
  if (target) target.appendChild(styleEl);
}

async function inlineScripts(doc) {
  const createEl = (tag) => (doc.ownerDocument || document).createElement(tag);
  const scripts = Array.from(doc.querySelectorAll("script[src]"));
  for (const script of scripts) {
    const src = script.getAttribute("src");
    const absoluteUrl = toAbsoluteUrl(src);
    if (!absoluteUrl) continue;
    try {
      const jsText = await fetchText(absoluteUrl);
      const inlineScript = createEl("script");
      const type = script.getAttribute("type");
      if (type) inlineScript.setAttribute("type", type);
      inlineScript.setAttribute("data-roll20-cleaner-source", absoluteUrl);
      inlineScript.textContent = jsText;
      script.replaceWith(inlineScript);
    } catch (error) {
      // Keep original script if fetch fails.
    }
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}

async function inlineElementSource(doc, selector, attrName, concurrency = 6) {
  const nodes = Array.from(doc.querySelectorAll(selector));
  const byUrl = new Map();
  for (const node of nodes) {
    const src = node.getAttribute(attrName);
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
    const absoluteUrl = toAbsoluteUrl(src);
    if (!absoluteUrl) continue;
    if (!byUrl.has(absoluteUrl)) byUrl.set(absoluteUrl, []);
    byUrl.get(absoluteUrl).push(node);
  }

  const urls = Array.from(byUrl.keys());
  let processed = 0;
  await mapLimit(urls, concurrency, async (absoluteUrl) => {
    try {
      const dataUrl = await fetchDataUrl(absoluteUrl);
      const targets = byUrl.get(absoluteUrl) || [];
      targets.forEach((node) => node.setAttribute(attrName, dataUrl));
    } catch (error) {
      // Keep original source if fetch fails.
    } finally {
      processed += 1;
    }
  });
  return urls.length ? processed / urls.length : 1;
}

async function inlineImages(doc) {
  await inlineElementSource(doc, "img[src]", "src", 8);
  await inlineElementSource(doc, 'input[type="image"][src]', "src", 8);
}

function removeNonSingleFileAttrs(doc) {
  const nodes = doc.querySelectorAll(
    `[${COLOR_HIDE_ATTR}], [${TEXT_HIDE_ATTR}], [${PREV_DISPLAY_ATTR}]`
  );
  nodes.forEach((node) => {
    node.removeAttribute(COLOR_HIDE_ATTR);
    node.removeAttribute(TEXT_HIDE_ATTR);
    node.removeAttribute(PREV_DISPLAY_ATTR);
  });
}

function reportBundleProgress(requestId, percent, label) {
  if (!requestId) return;
  chrome.runtime.sendMessage({
    type: "BUNDLE_PROGRESS",
    requestId,
    percent,
    label,
  });
}

async function buildBundledHtml(requestId) {
  reportBundleProgress(requestId, 5, "보이는 DOM을 수집하는 중...");
  const clone = document.documentElement.cloneNode(true);
  pruneHidden(document.documentElement, clone);
  removeSheetTemplateAreaNewlines(clone);
  removeNonSingleFileAttrs(clone);
  reportBundleProgress(requestId, 25, "CSS를 포함하는 중...");
  await inlineStyles(clone);
  reportBundleProgress(requestId, 50, "JavaScript를 포함하는 중...");
  await inlineScripts(clone);
  reportBundleProgress(requestId, 75, "이미지를 포함하는 중...");
  await inlineImages(clone);
  reportBundleProgress(requestId, 90, "HTML로 변환하는 중...");

  const serializer = new XMLSerializer();
  const html = serializer.serializeToString(clone);
  reportBundleProgress(requestId, 100, "번들 준비 완료");
  if (document.doctype) {
    return `<!DOCTYPE ${document.doctype.name}>\n${html}`;
  }
  return html;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ROLL20_CLEANER_PING") {
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === "GET_VISIBLE_HTML") {
    buildVisibleHtml()
      .then((html) => sendResponse({ html, filenameBase: getDownloadNameBase() }))
      .catch(() => sendResponse({ html: "", filenameBase: getDownloadNameBase() }));
    return true;
  }
  if (message?.type === "GET_BUNDLED_HTML") {
    buildBundledHtml(message?.requestId || "")
      .then((html) =>
        sendResponse({ html, filenameBase: getDownloadNameBase() })
      )
      .catch(() =>
        buildVisibleHtml()
          .then((html) =>
            sendResponse({ html, filenameBase: getDownloadNameBase() })
          )
          .catch(() =>
            sendResponse({ html: "", filenameBase: getDownloadNameBase() })
          )
      );
    return true;
  }
  if (message?.type === "GET_AVATAR_MAPPINGS") {
    collectAvatarMappingsFromRoot(document)
      .then((mappings) => sendResponse({ mappings }))
      .catch(() => sendResponse({ mappings: [] }));
    return true;
  }
  if (message?.type === "DOWNLOAD_BUNDLED_HTML_DIRECT") {
    buildVisibleHtmlWithoutHeadAssets()
      .then((html) => {
        downloadHtmlInPage(html, getDownloadNameBase());
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "DOWNLOAD_WITH_AVATAR_REPLACEMENTS") {
    buildVisibleHtmlWithAvatarReplacements(message?.replacements || {})
      .then((html) => {
        downloadHtmlInPage(html, getDownloadNameBase());
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});

}
