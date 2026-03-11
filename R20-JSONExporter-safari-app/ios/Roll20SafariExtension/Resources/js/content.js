(function () {
  const SAFARI_PING_MESSAGE = "R20_SAFARI_EXPORT_PING";
  const SAFARI_MEASURE_MESSAGE = "R20_SAFARI_EXPORT_MEASURE";
  const SAFARI_EXPORT_JSON_MESSAGE = "R20_SAFARI_EXPORT_JSON";
  const SYSTEM_CLASS_NAMES = ["desc", "emote", "em", "emas"];
  const DICE_TEMPLATE_CLASS_PREFIX = "sheet-rolltemplate-";
  const chatJsonApi =
    typeof module !== "undefined" && module.exports
      ? require("../../../../../roll20-json-core/src/chat_json_export.js")
      : window.Roll20CleanerChatJson || window.Roll20JsonCore?.chatJson || {};

  function getDefaultDocument() {
    return typeof document !== "undefined" ? document : null;
  }

  function parseCampaignNameFromHref(href) {
    if (!href) return "";
    const match = String(href).match(/\/campaigns\/details\/\d+\/([^/?#]+)/i);
    if (!match?.[1]) return "";
    try {
      return decodeURIComponent(match[1]).trim();
    } catch (error) {
      return String(match[1]).trim();
    }
  }

  function extractCampaignNameFromHref(doc = getDefaultDocument()) {
    if (!doc?.querySelectorAll) return "";
    const anchors = Array.from(doc.querySelectorAll('a[href*="/campaigns/details/"]'));
    for (const anchor of anchors) {
      const name = parseCampaignNameFromHref(anchor.getAttribute?.("href") || "");
      if (name) return name;
    }
    return "";
  }

  function getDownloadNameBase(doc = getDefaultDocument()) {
    return extractCampaignNameFromHref(doc) || String(doc?.title || "").trim() || "roll20-chat";
  }

  function normalizeSpeakerName(raw) {
    const compact = String(raw || "").replace(/\s+/g, " ").trim();
    if (!compact) return "";
    if (/^:+$/.test(compact)) return compact;
    return compact.replace(/:+$/, "").trim();
  }

  function getDirectMessageChildBySelector(messageEl, selector) {
    return Array.from(messageEl?.children || []).find((child) => child.matches?.(selector));
  }

  function getMessageSpeakerName(messageEl) {
    const byEl = getDirectMessageChildBySelector(messageEl, "span.by");
    return normalizeSpeakerName(byEl?.textContent || "");
  }

  function getMessageAvatarImage(messageEl) {
    const avatarWrap = Array.from(messageEl?.children || []).find((child) =>
      child.classList?.contains("avatar")
    );
    if (!avatarWrap?.querySelector) return null;
    return avatarWrap.querySelector("img");
  }

  function getMessageTimestamp(messageEl) {
    const tstampEl = getDirectMessageChildBySelector(messageEl, "span.tstamp");
    return String(tstampEl?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function extractInlineColorValue(rawStyle) {
    const matched = String(rawStyle || "").match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    if (!matched?.[1]) return "";
    return String(matched[1]).trim();
  }

  function getMessageTextColor(messageEl) {
    const directSpans = Array.from(messageEl?.children || []).filter((child) =>
      child.matches?.("span")
    );
    const textSpan = directSpans.find((child) => {
      if (child.matches?.("span.by") || child.matches?.("span.tstamp")) return false;
      if (child.classList?.contains("inlinerollresult")) return false;
      return true;
    });
    if (!textSpan) return "";

    const fromAttr = extractInlineColorValue(textSpan.getAttribute?.("style"));
    if (fromAttr) return fromAttr;

    const fromStyle = String(textSpan.style?.color || "").trim();
    if (fromStyle) return fromStyle;

    return "";
  }

  function hasDescStyle(messageEl) {
    return !!messageEl?.classList?.contains?.("desc");
  }

  function hasEmoteStyle(messageEl) {
    if (!messageEl?.classList) return false;
    return (
      messageEl.classList.contains("emote") ||
      messageEl.classList.contains("em") ||
      messageEl.classList.contains("emas")
    );
  }

  function classListHasPrefix(node, prefix) {
    if (!node?.classList || !prefix) return false;
    for (const token of node.classList) {
      if (String(token || "").startsWith(prefix)) return true;
    }
    return false;
  }

  function resolveRoleForMessage(messageEl) {
    const classList = messageEl?.classList;
    let role = "character";

    if (classList?.contains?.("private")) role = "secret";

    if (classList) {
      for (const className of SYSTEM_CLASS_NAMES) {
        if (classList.contains(className)) {
          role = "system";
          break;
        }
      }
    }

    const bySpan = messageEl?.querySelector?.("span.by");
    const next = bySpan?.nextElementSibling || null;
    const isDice =
      classListHasPrefix(next, DICE_TEMPLATE_CLASS_PREFIX) ||
      !!messageEl?.querySelector?.(`[class*="${DICE_TEMPLATE_CLASS_PREFIX}"]`);
    if (isDice) return "dice";

    return role;
  }

  function resolveMessageContext(current, previous) {
    const prev = previous || {};
    const now = current || {};
    const normalizedSpeaker = normalizeSpeakerName(now.speaker || "");
    const currentAvatarSrc = String(now.avatarSrc || "").trim();
    const currentSpeakerImageUrl = String(now.speakerImageUrl || "").trim();
    const currentTimestamp = String(now.timestamp || "").replace(/\s+/g, " ").trim();
    const inheritedAvatarSrc = currentAvatarSrc || String(prev.avatarSrc || "");
    const inheritedSpeakerImageUrl =
      currentSpeakerImageUrl || String(prev.speakerImageUrl || "") || inheritedAvatarSrc;
    const inheritedTimestamp = currentTimestamp || String(prev.timestamp || "");

    return {
      speaker: normalizedSpeaker || String(prev.speaker || ""),
      avatarSrc: inheritedAvatarSrc,
      speakerImageUrl: inheritedSpeakerImageUrl,
      timestamp: inheritedTimestamp,
    };
  }

  function shouldInheritMessageContext(role, options = {}) {
    if (options.hasDescStyle || options.hasEmoteStyle) return false;
    if (String(role || "").toLowerCase() === "system") return false;
    return true;
  }

  function toAbsoluteUrl(value, baseUrl = "") {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const fallbackBase =
      baseUrl ||
      String(getDefaultDocument()?.baseURI || "") ||
      (typeof location !== "undefined" ? String(location.href || "") : "");
    try {
      return new URL(raw, fallbackBase || undefined).href;
    } catch (error) {
      return raw;
    }
  }

  function normalizeMessageText(raw) {
    if (typeof chatJsonApi.normalizeMessageText === "function") {
      return chatJsonApi.normalizeMessageText(raw);
    }
    return String(raw || "").replace(/\s+/g, " ").trim();
  }

  function extractMessageText(messageEl) {
    const clone = messageEl?.cloneNode?.(true);
    if (!clone) return normalizeMessageText(messageEl?.textContent || "");

    clone.querySelectorAll?.("span.by, span.tstamp, .avatar").forEach((node) => node.remove?.());

    if (hasDescStyle(messageEl) && typeof chatJsonApi.joinDescAnchorLines === "function") {
      const descWithLineBreaks = chatJsonApi.joinDescAnchorLines(clone.innerHTML || "", "\n");
      if (descWithLineBreaks) return descWithLineBreaks;
    }

    return normalizeMessageText(clone.textContent || "");
  }

  function getInlineMessageImageUrl(messageEl, doc = getDefaultDocument()) {
    const clone = messageEl?.cloneNode?.(true);
    if (!clone) return null;
    clone.querySelectorAll?.(".avatar, span.by, span.tstamp").forEach((node) => node.remove?.());
    const imageEl = clone.querySelector?.("img[src]");
    if (!imageEl?.getAttribute) return null;
    const rawSrc = String(imageEl.getAttribute("src") || "").trim();
    if (!rawSrc) return null;
    return toAbsoluteUrl(rawSrc, String(doc?.baseURI || ""));
  }

  function isHiddenPlaceholderMessage(messageEl) {
    const rawText = String(messageEl?.textContent || "");
    if (typeof chatJsonApi.isHiddenMessagePlaceholderText === "function") {
      return chatJsonApi.isHiddenMessagePlaceholderText(rawText);
    }
    return rawText.includes("This message has been hidden");
  }

  function buildChatJsonEntry(payload) {
    if (typeof chatJsonApi.buildChatJsonEntry === "function") {
      return chatJsonApi.buildChatJsonEntry(payload);
    }
    return payload;
  }

  function buildChatJsonDocument(payload) {
    if (typeof chatJsonApi.buildChatJsonDocument === "function") {
      return chatJsonApi.buildChatJsonDocument(payload);
    }
    return {
      schemaVersion: 1,
      ebookView: {
        titlePage: {
          scenarioTitle: String(payload?.scenarioTitle || ""),
          ruleType: "",
          gm: "",
          pl: "",
          writer: "",
          copyright: "",
          identifier: "",
          extraMetaItems: [],
        },
      },
      lines: Array.isArray(payload?.lines) ? payload.lines : [],
    };
  }

  function collectMessages(doc) {
    if (typeof chatJsonApi.collectJsonExportMessages === "function") {
      return chatJsonApi.collectJsonExportMessages(doc);
    }
    return Array.from(doc?.querySelectorAll?.("div.message") || []);
  }

  function estimateDomNodes(node) {
    const children = Array.from(node?.children || []);
    return 1 + children.reduce((count, child) => count + estimateDomNodes(child), 0);
  }

  function measureSafariExport({ doc = getDefaultDocument() } = {}) {
    const messages = collectMessages(doc);
    return {
      messageCount: messages.length,
      domNodeEstimate: messages.reduce((total, messageEl) => total + estimateDomNodes(messageEl), 0),
      filenameBase: getDownloadNameBase(doc),
      titleCandidate: extractCampaignNameFromHref(doc) || String(doc?.title || "").trim() || "roll20-chat",
    };
  }

  function buildSafariExportPayload({ doc = getDefaultDocument() } = {}) {
    const messages = collectMessages(doc);
    const lines = [];
    let previousMessageContext = {
      speaker: "",
      avatarSrc: "",
      speakerImageUrl: "",
      timestamp: "",
    };

    messages.forEach((messageEl, index) => {
      if (isHiddenPlaceholderMessage(messageEl)) return;

      const role = resolveRoleForMessage(messageEl);
      const rawSpeaker = getMessageSpeakerName(messageEl);
      const rawTimestamp = getMessageTimestamp(messageEl);
      const avatarImage = getMessageAvatarImage(messageEl);
      const rawCurrentSrc = String(avatarImage?.getAttribute?.("src") || "").trim();
      const currentSrc = rawCurrentSrc ? toAbsoluteUrl(rawCurrentSrc, String(doc?.baseURI || "")) : "";
      const rawResolvedAvatarUrl = String(
        avatarImage?.currentSrc || avatarImage?.src || rawCurrentSrc || ""
      ).trim();
      const resolvedAvatarUrl = rawResolvedAvatarUrl
        ? toAbsoluteUrl(rawResolvedAvatarUrl, String(doc?.baseURI || ""))
        : "";
      const canInherit = shouldInheritMessageContext(role, {
        hasDescStyle: hasDescStyle(messageEl),
        hasEmoteStyle: hasEmoteStyle(messageEl),
        hasAvatar: !!avatarImage,
      });
      const fallbackContext = canInherit
        ? previousMessageContext
        : { speaker: "", avatarSrc: "", speakerImageUrl: "", timestamp: "" };
      const resolvedContext = resolveMessageContext(
        {
          speaker: rawSpeaker,
          avatarSrc: currentSrc,
          speakerImageUrl: resolvedAvatarUrl || currentSrc,
          timestamp: rawTimestamp,
        },
        fallbackContext
      );
      const speaker = resolvedContext.speaker;
      const speakerImageUrl = resolvedContext.speakerImageUrl || resolvedContext.avatarSrc;
      const effectiveTimestamp = String(resolvedContext.timestamp || "")
        .replace(/\s+/g, " ")
        .trim();
      const dice =
        typeof chatJsonApi.parseRoll20DicePayload === "function"
          ? chatJsonApi.parseRoll20DicePayload({
              role,
              html: messageEl?.innerHTML || "",
            })
          : null;
      const roleForEntry = dice ? "dice" : role;
      const messageId =
        messageEl?.getAttribute?.("data-messageid") ||
        messageEl?.id ||
        messageEl?.getAttribute?.("id") ||
        "";

      lines.push(
        buildChatJsonEntry({
          id:
            typeof chatJsonApi.resolveMessageId === "function"
              ? chatJsonApi.resolveMessageId({ id: messageId }, index)
              : String(messageId || index + 1),
          speaker,
          role: roleForEntry,
          timestamp: effectiveTimestamp,
          textColor: getMessageTextColor(messageEl),
          text: extractMessageText(messageEl),
          imageUrl: getInlineMessageImageUrl(messageEl, doc),
          speakerImageUrl: speakerImageUrl || null,
          dice,
        })
      );

      if (canInherit) {
        previousMessageContext = {
          speaker,
          avatarSrc: resolvedContext.avatarSrc,
          speakerImageUrl: speakerImageUrl || "",
          timestamp: effectiveTimestamp,
        };
      }
    });

    const documentPayload = buildChatJsonDocument({
      scenarioTitle: extractCampaignNameFromHref(doc),
      lines,
    });
    const rawJsonText = JSON.stringify(documentPayload, null, 2);
    const jsonText =
      typeof chatJsonApi.normalizeImgurLinksInJsonText === "function"
        ? chatJsonApi.normalizeImgurLinksInJsonText(rawJsonText)
        : rawJsonText;

    return {
      jsonText,
      filenameBase: getDownloadNameBase(doc),
    };
  }

  function createRuntimeMessageHandler({
    measureSafariExport: measure = measureSafariExport,
    buildSafariExportPayload: buildPayload = buildSafariExportPayload,
  } = {}) {
    return async (message) => {
      if (message?.type === SAFARI_PING_MESSAGE) {
        return { ok: true };
      }

      if (message?.type === SAFARI_MEASURE_MESSAGE) {
        try {
          return {
            ok: true,
            ...measure(),
          };
        } catch (error) {
          return {
            ok: false,
            errorMessage:
              error?.message ? String(error.message) : "Roll20 DOM 계측 중 오류가 발생했습니다.",
          };
        }
      }

      if (message?.type === SAFARI_EXPORT_JSON_MESSAGE) {
        try {
          const payload = buildPayload();
          return {
            ok: true,
            jsonText: String(payload?.jsonText || ""),
            filenameBase: String(payload?.filenameBase || "roll20-chat"),
          };
        } catch (error) {
          return {
            ok: false,
            errorMessage:
              error?.message ? String(error.message) : "JSON 생성 중 오류가 발생했습니다.",
          };
        }
      }

      return undefined;
    };
  }

  const runtime =
    typeof browser !== "undefined"
      ? browser.runtime
      : typeof chrome !== "undefined"
        ? chrome.runtime
        : null;

  if (runtime?.onMessage?.addListener) {
    runtime.onMessage.addListener(createRuntimeMessageHandler());
  }

  const api = {
    SAFARI_PING_MESSAGE,
    SAFARI_MEASURE_MESSAGE,
    SAFARI_EXPORT_JSON_MESSAGE,
    parseCampaignNameFromHref,
    extractCampaignNameFromHref,
    getDownloadNameBase,
    measureSafariExport,
    buildSafariExportPayload,
    createRuntimeMessageHandler,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  window.Roll20SafariExportContent = api;
})();
