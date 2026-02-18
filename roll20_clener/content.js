// content.js
// Refactored to use modules: Utils, Avatar, Style, Dom

(function () {
  console.log("[Roll20Cleaner] content.js initializing...");

  if (globalThis.__roll20CleanerContentLoaded) {
    console.log("[Roll20Cleaner] content.js already loaded, preventing duplicate init.");
    return;
  }
  globalThis.__roll20CleanerContentLoaded = true;

  // --- Wrapper Accessors for Modules ---
  // Accessing window.Roll20Cleaner* directly at the top level is risky 
  // if this script runs before others. We access them lazily.

  const getUtils = () => window.Roll20CleanerUtils || {};
  const getAvatar = () => window.Roll20CleanerAvatar || {};
  const getStyle = () => window.Roll20CleanerStyle || {};
  const getDom = () => window.Roll20CleanerDom || {};
  const getData = () => window.Roll20CleanerData || {};
  const getRootState = () => window.Roll20CleanerRootState || {};
  const getPerf = () => window.Roll20CleanerPerf || {};

  const TEST_HTML_BASE_BYTES = 13045405;

  const settings = {
    colorFilterEnabled: false,
    hiddenTextEnabled: false,
    targetColor: "#aaaaaa",
    styleQuery: null,
  };

  // --- Filtering Logic (Specific to content.js state) ---

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

  function isRootClassDesired() {
    const { computeRootClassDesired } = getRootState();
    if (computeRootClassDesired) return computeRootClassDesired(settings);
    return settings.colorFilterEnabled || settings.hiddenTextEnabled;
  }

  function updateRootState() {
    const { ROOT_CLASS } = getData();
    if (!ROOT_CLASS) return;
    const desired = isRootClassDesired();
    const { syncRootClass } = getRootState();
    if (syncRootClass) {
      syncRootClass(document.documentElement.classList, ROOT_CLASS, desired);
      return;
    }
    document.documentElement.classList.toggle(ROOT_CLASS, desired);
  }

  function markHidden(el, reasonAttr) {
    const { PREV_DISPLAY_ATTR } = getData();
    if (el.hasAttribute(reasonAttr)) return;
    el.setAttribute(reasonAttr, "true");
    if (!el.hasAttribute(PREV_DISPLAY_ATTR)) {
      el.setAttribute(PREV_DISPLAY_ATTR, el.style.display || "");
    }
    el.style.display = "none";
  }

  function unmarkHidden(el, reasonAttr) {
    const { COLOR_HIDE_ATTR, TEXT_HIDE_ATTR, PREV_DISPLAY_ATTR } = getData();

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

  function isStyleValueMatch(actualValue, expectedValue, key) {
    const { normalizeColor } = getStyle();

    if (!actualValue) return false;
    const actual = String(actualValue).trim().toLowerCase();
    const expected = String(expectedValue).trim().toLowerCase();

    if (key === "color") {
      const actualColor = normalizeColor ? normalizeColor(actual) : actual;
      const expectedColor = normalizeColor ? normalizeColor(expected) : expected;
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
    const { MESSAGE_SELECTOR, COLOR_HIDE_ATTR } = getData();
    if (!MESSAGE_SELECTOR) return;

    const rootEl = root.nodeType === 1 ? root : document.documentElement;
    const candidates = rootEl.matches?.(MESSAGE_SELECTOR) ? [rootEl] : [];
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
    const { MESSAGE_SELECTOR, TEXT_HIDE_ATTR, HIDDEN_TEXT } = getData();
    if (!MESSAGE_SELECTOR) return;

    const rootEl = root.nodeType === 1 ? root : document.documentElement;
    const messages = rootEl.matches?.(MESSAGE_SELECTOR) ? [rootEl] : [];
    const messageNodes = rootEl.querySelectorAll
      ? rootEl.querySelectorAll(MESSAGE_SELECTOR)
      : [];
    messages.push(...messageNodes);

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

  const scheduleRootStateSync = (() => {
    const { createCoalescedScheduler } = getRootState();
    if (createCoalescedScheduler) {
      return createCoalescedScheduler(() => updateRootState());
    }

    let scheduled = false;
    return () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        updateRootState();
      }, 0);
    };
  })();

  // --- Main Build Functions ---

  function appendDoctypeIfNeeded(html) {
    if (document.doctype) {
      return `<!DOCTYPE ${document.doctype.name}>\n${html}`;
    }
    return html;
  }

  async function buildVisibleHtmlCore({
    requestId = "",
    includeScripts = false,
    withAvatarReplacements = null,
    reportProgress = false,
  } = {}) {
    const { reportBundleProgress } = getUtils();
    const perf = getPerf();
    const {
      processVisibleNodes,
      processVisibleNodesBatched,
      estimateElementCount,
      removeSheetTemplateAreaNewlines,
      removeNonSingleFileAttrs,
      absolutizeResourceUrls,
      stripHeadJsAndCss,
      inlineScripts,
    } = getDom();
    const { applyAvatarReplacementsToClone } = getAvatar();

    const report = (percent, label) => {
      if (!reportProgress || !reportBundleProgress) return;
      reportBundleProgress(requestId, percent, label);
    };

    const start = performance.now();
    const clone = document.documentElement.cloneNode(true);
    const estimatedNodes = estimateElementCount ? estimateElementCount(document.documentElement) : 0;
    report(5, `DOM 준비 중 (${estimatedNodes.toLocaleString()} 노드 추정)`);

    if (processVisibleNodesBatched) {
      await processVisibleNodesBatched(document.documentElement, clone, {
        estimatedNodes,
        styleMode: "auto",
        chunkSize: 400,
        onProgress: ({ processedNodes, estimatedNodes: total }) => {
          if (!reportProgress) return;
          const ratio = total ? Math.min(1, processedNodes / total) : 0;
          const percent = 10 + Math.floor(ratio * 40);
          report(percent, `DOM 처리 중 (${processedNodes.toLocaleString()}/${total.toLocaleString()})`);
        },
      });
    } else if (processVisibleNodes) {
      processVisibleNodes(document.documentElement, clone, {
        styleMode: "balanced",
        estimatedNodes,
      });
      report(50, "DOM 처리 완료");
    } else {
      throw new Error("Roll20CleanerDom.processVisibleNodes is missing!");
    }

    removeSheetTemplateAreaNewlines(clone);
    removeNonSingleFileAttrs(clone);
    report(60, "리소스 정리 중...");

    if (withAvatarReplacements && applyAvatarReplacementsToClone) {
      applyAvatarReplacementsToClone(clone, withAvatarReplacements);
    }

    await absolutizeResourceUrls(clone);

    if (includeScripts) {
      report(75, "스크립트 포함 중...");
      await inlineScripts(clone);
    } else {
      stripHeadJsAndCss(clone);
    }

    report(90, "HTML 직렬화 중...");
    const serializer = new XMLSerializer();
    const html = appendDoctypeIfNeeded(serializer.serializeToString(clone));
    const bytes = perf.getUtf8ByteLength ? perf.getUtf8ByteLength(html) : new TextEncoder().encode(html).length;
    const elapsedMs = Math.round(performance.now() - start);
    report(100, `완료 (${(bytes / (1024 * 1024)).toFixed(2)}MB, ${elapsedMs}ms)`);

    return {
      html,
      bytes,
      elapsedMs,
      estimatedNodes,
    };
  }

  async function buildVisibleHtml() {
    const result = await buildVisibleHtmlCore();
    return result.html;
  }

  async function buildVisibleHtmlWithoutHeadAssets(requestId = "", reportProgress = false) {
    try {
      const result = await buildVisibleHtmlCore({
        requestId,
        includeScripts: false,
        reportProgress,
      });
      return result;
    } catch (e) {
      console.error("[Roll20Cleaner] Critical Error in buildVisibleHtmlWithoutHeadAssets:", e);
      throw e;
    }
  }

  async function buildVisibleHtmlWithAvatarReplacements(replacements) {
    const result = await buildVisibleHtmlCore({
      withAvatarReplacements: replacements,
      includeScripts: false,
      reportProgress: false,
    });
    return result.html;
  }

  function buildProfileImageReplacementChunks(replacements) {
    const { applyAvatarReplacementsToClone } = getAvatar();
    const { serializeDocumentCloneToChunks } = getDom();
    const clone = document.documentElement.cloneNode(true);
    if (applyAvatarReplacementsToClone) {
      applyAvatarReplacementsToClone(clone, replacements);
    }
    if (!serializeDocumentCloneToChunks) {
      throw new Error("serializeDocumentCloneToChunks 함수가 준비되지 않았습니다.");
    }
    return serializeDocumentCloneToChunks(clone, {
      doctypeName: document.doctype?.name || "",
      maxChunkSize: 1024 * 512,
    });
  }

  // --- Helper: Campaign Name ---

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

  // --- Initialization ---

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

  const rootClassObserver = new MutationObserver((mutations) => {
    const rootEl = document.documentElement;
    const { shouldResyncOnMutations } = getRootState();
    if (shouldResyncOnMutations) {
      if (shouldResyncOnMutations(mutations, rootEl)) {
        scheduleRootStateSync();
      }
      return;
    }

    const hasRootClassMutation = mutations.some(
      (mutation) =>
        mutation?.type === "attributes" &&
        mutation?.attributeName === "class" &&
        mutation?.target === rootEl
    );

    if (hasRootClassMutation) {
      scheduleRootStateSync();
    }
  });

  rootClassObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  // --- Message Handling ---

  async function buildBundledHtml(requestId) {
    const result = await buildVisibleHtmlCore({
      requestId,
      includeScripts: true,
      reportProgress: true,
    });
    return result.html;
  }

  console.log("[Roll20Cleaner] content.js setup complete, adding listeners...");

  function toErrorResponsePayload(error) {
    if (error?.code === "COPY_TOO_LARGE") {
      return {
        errorCode: 9,
        errorMessage: `복사 가능한 최대 크기를 초과했습니다. 다운로드를 이용해주세요. (${(error.htmlBytes / (1024 * 1024)).toFixed(2)}MB)`,
      };
    }
    const message = error?.message ? String(error.message) : String(error || "Unknown error");
    if (error?.name === "NotAllowedError") {
      return { errorCode: 7, errorMessage: "브라우저가 클립보드 접근을 허용하지 않았습니다." };
    }
    if (/clipboard/i.test(message)) {
      return { errorCode: 8, errorMessage: "클립보드 복사 중 오류가 발생했습니다." };
    }
    return { errorCode: 1, errorMessage: message };
  }

  function toSimpleErrorMessage(error) {
    return error?.message ? String(error.message) : "처리 중 오류가 발생했습니다.";
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // console.log("[Roll20Cleaner] Message received:", message.type);

    if (message?.type === "ROLL20_CLEANER_PING") {
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "ROLL20_CLEANER_STREAM_READY") {
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "ROLL20_CLEANER_GET_ROOT_STATE") {
      const { ROOT_CLASS } = getData();
      const desiredRootClassEnabled = isRootClassDesired();
      const rootClassApplied = ROOT_CLASS
        ? document.documentElement.classList.contains(ROOT_CLASS)
        : false;
      sendResponse({
        ok: true,
        desiredRootClassEnabled,
        rootClassApplied,
      });
      return;
    }

    const { downloadHtmlInPage, buildLoadedImageUrlMap, copyTextToClipboard } = getDom();
    const { collectAvatarMappingsFromRoot } = getAvatar();

    if (message?.type === "GET_VISIBLE_HTML") {
      buildVisibleHtmlWithoutHeadAssets()
        .then((result) => sendResponse({ html: result.html, filenameBase: getDownloadNameBase() }))
        .catch((e) => {
          console.error(e);
          sendResponse({ html: "", filenameBase: getDownloadNameBase() });
        });
      return true;
    }

    if (message?.type === "GET_BUNDLED_HTML") {
      buildBundledHtml(message?.requestId || "")
        .then((html) =>
          sendResponse({ html, filenameBase: getDownloadNameBase() })
        )
        .catch((e) => {
          console.error(e);
          sendResponse({ html: "", filenameBase: getDownloadNameBase() });
        });
      return true;
    }

    if (message?.type === "GET_AVATAR_MAPPINGS") {
      collectAvatarMappingsFromRoot(document, buildLoadedImageUrlMap ? buildLoadedImageUrlMap() : undefined)
        .then((mappings) => sendResponse({ mappings }))
        .catch(() => sendResponse({ mappings: [] }));
      return true;
    }

    if (message?.type === "DOWNLOAD_BUNDLED_HTML_DIRECT") {
      const requestId = message?.requestId || "";
      sendResponse({ ok: true, accepted: true });

      (async () => {
        try {
          const result = await buildVisibleHtmlWithoutHeadAssets(requestId, true);
          if (downloadHtmlInPage) {
            downloadHtmlInPage(result.html, getDownloadNameBase());
          }
          chrome.runtime.sendMessage({
            type: "BUNDLE_DONE",
            requestId,
            ok: true,
            htmlBytes: result.bytes,
            elapsedMs: result.elapsedMs,
          });
        } catch (e) {
          console.error(e);
          chrome.runtime.sendMessage({
            type: "BUNDLE_DONE",
            requestId,
            ok: false,
            errorMessage: e?.message ? String(e.message) : "다운로드 생성 중 오류가 발생했습니다.",
          });
        }
      })();
      return;
    }

    if (message?.type === "COPY_BUNDLED_HTML_DIRECT") {
      buildVisibleHtmlWithoutHeadAssets("", false)
        .then(async (result) => {
          if (!copyTextToClipboard) {
            throw new Error("copyTextToClipboard 함수가 준비되지 않았습니다.");
          }
          const perf = getPerf();
          const copyMaxBytes = perf.computeThreeXTarget ? perf.computeThreeXTarget(TEST_HTML_BASE_BYTES) : TEST_HTML_BASE_BYTES * 3;
          if (perf.shouldBlockClipboardCopy && perf.shouldBlockClipboardCopy({ htmlBytes: result.bytes, maxBytes: copyMaxBytes })) {
            const err = new Error("copy too large");
            err.code = "COPY_TOO_LARGE";
            err.htmlBytes = result.bytes;
            throw err;
          }
          const copied = await copyTextToClipboard(result.html);
          sendResponse({
            ok: true,
            method: copied?.method || "",
            htmlBytes: result.bytes,
            elapsedMs: result.elapsedMs,
          });
        })
        .catch((e) => {
          console.error(e);
          sendResponse({ ok: false, ...toErrorResponsePayload(e) });
        });
      return true;
    }

    if (message?.type === "DOWNLOAD_WITH_AVATAR_REPLACEMENTS") {
      buildVisibleHtmlWithAvatarReplacements(message?.replacements || {})
        .then((html) => {
          if (downloadHtmlInPage) downloadHtmlInPage(html, getDownloadNameBase());
          sendResponse({ ok: true });
        })
        .catch((e) => {
          console.error(e);
          sendResponse({ ok: false });
        });
      return true;
    }
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (!port || port.name !== "ROLL20_CLEANER_STREAM") return;

    port.onMessage.addListener((message) => {
      if (message?.type !== "START_PROFILE_IMAGE_REPLACEMENT_DOWNLOAD") return;

      const requestId = message?.requestId || "";
      try {
        port.postMessage({
          type: "STREAM_PROGRESS",
          requestId,
          percent: 10,
          label: "DOM 스냅샷 복제 중...",
        });
        const chunks = buildProfileImageReplacementChunks(message?.replacements || []);
        port.postMessage({
          type: "STREAM_PROGRESS",
          requestId,
          percent: 80,
          label: "청크 다운로드 준비 중...",
        });
        if (getDom().downloadHtmlChunksInPage) {
          getDom().downloadHtmlChunksInPage(chunks, getDownloadNameBase());
        } else if (downloadHtmlInPage) {
          downloadHtmlInPage(chunks.join(""), getDownloadNameBase());
        }
        port.postMessage({
          type: "STREAM_DONE",
          requestId,
          ok: true,
        });
      } catch (error) {
        console.error(error);
        port.postMessage({
          type: "STREAM_DONE",
          requestId,
          ok: false,
          errorMessage: toSimpleErrorMessage(error),
        });
      }
    });
  });

})();
