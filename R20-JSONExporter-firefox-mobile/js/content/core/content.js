(function () {
  const FIREFOX_PING_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_PING";
  const FIREFOX_EXPORT_JSON_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON";
  const FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE =
    "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS";
  const FIREFOX_GET_AVATAR_MAPPINGS_MESSAGE =
    "R20_JSON_EXPORTER_FIREFOX_GET_AVATAR_MAPPINGS";
  const FIREFOX_EXPORT_PROGRESS_MESSAGE =
    "R20_JSON_EXPORTER_FIREFOX_EXPORT_PROGRESS";
  const FIREFOX_OPEN_READINGLOG_APP_MESSAGE =
    "R20_JSON_EXPORTER_FIREFOX_OPEN_READINGLOG_APP";
  const FIREFOX_DOWNLOAD_STREAM_START_MESSAGE =
    "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_STREAM_START";
  const FIREFOX_DOWNLOAD_STREAM_CHUNK_MESSAGE =
    "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_STREAM_CHUNK";
  const FIREFOX_DOWNLOAD_STREAM_FINISH_MESSAGE =
    "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_STREAM_FINISH";
  const SYSTEM_CLASS_NAMES = ["desc", "emote", "em", "emas"];
  const DICE_TEMPLATE_CLASS_PREFIX = "sheet-rolltemplate-";
  const chatJsonApi =
    typeof module !== "undefined" && module.exports
      ? require("../export/chat_json_export.js")
      : window.Roll20CleanerChatJson || window.Roll20JsonCore?.chatJson || {};
  const avatarRulesApi =
    typeof module !== "undefined" && module.exports
      ? require("../export/avatar_rules.js")
      : window.Roll20CleanerAvatarRules || {};
  const avatarExportResolutionApi =
    typeof module !== "undefined" && module.exports
      ? require("../export/avatar_export_resolution.js")
      : window.Roll20CleanerAvatarExportResolution || {};
  const messageContextApi =
    typeof module !== "undefined" && module.exports
      ? require("../export/message_context_parser.js")
      : window.Roll20CleanerMessageContext || {};

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
    if (typeof messageContextApi.normalizeSpeakerName === "function") {
      return messageContextApi.normalizeSpeakerName(raw);
    }
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
    if (typeof messageContextApi.resolveMessageContext === "function") {
      return messageContextApi.resolveMessageContext(current, previous);
    }
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
    if (typeof messageContextApi.shouldInheritMessageContext === "function") {
      return messageContextApi.shouldInheritMessageContext(role, options);
    }
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

    if (
      hasDescStyle(messageEl) &&
      typeof chatJsonApi.joinDescAnchorLines === "function"
    ) {
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

  function collectAvatarMappingsFromDoc(doc = getDefaultDocument()) {
    const messages = collectMessages(doc);
    const byVariant = new Map();

    messages.forEach((messageEl) => {
      const name = getMessageSpeakerName(messageEl);
      const avatarImage = getMessageAvatarImage(messageEl);
      const rawOriginalSrc = String(avatarImage?.getAttribute?.("src") || "").trim();
      if (!name || !rawOriginalSrc) return;

      const originalUrl = toAbsoluteUrl(rawOriginalSrc, String(doc?.baseURI || ""));
      if (!originalUrl) return;
      const redirectedRaw =
        String(avatarImage?.currentSrc || avatarImage?.src || rawOriginalSrc).trim();
      const avatarUrl =
        toAbsoluteUrl(redirectedRaw, String(doc?.baseURI || "")) || originalUrl;
      const variantKey = `${name}|||${originalUrl}|||${avatarUrl}`;
      if (byVariant.has(variantKey)) return;

      byVariant.set(variantKey, {
        id: variantKey,
        name,
        avatarUrl,
        originalUrl,
      });
    });

    return Array.from(byVariant.values());
  }

  function reportExportProgress(onProgress, percent, detail, extras = {}) {
    if (typeof onProgress !== "function") return;
    onProgress({
      percent,
      detail,
      ...extras,
    });
  }

  function measureJsonByteLength(text) {
    const safeText = String(text || "");
    if (typeof TextEncoder === "function") {
      return new TextEncoder().encode(safeText).length;
    }
    if (typeof Blob !== "undefined") {
      return new Blob([safeText]).size;
    }
    return safeText.length;
  }

  function createExportProgressNotifier(sessionId, browserApi = typeof browser !== "undefined" ? browser : null) {
    if (!sessionId || typeof browserApi?.runtime?.sendMessage !== "function") {
      return null;
    }
    return ({ percent = 0, detail = "", ...extras } = {}) =>
      browserApi.runtime
        .sendMessage({
          type: FIREFOX_EXPORT_PROGRESS_MESSAGE,
          sessionId,
          percent,
          detail,
          ...extras,
        })
        .catch?.(() => undefined);
  }

  function inferFirefoxRuleTypeFromRule(rule = "") {
    const normalized = String(rule || "")
      .trim()
      .toLowerCase();
    if (!normalized) return "";
    if (normalized.includes("insane")) return "Insane";
    if (normalized.includes("coc")) return "COC";
    return "";
  }

  function createFirefoxReplacementMaps({
    doc = getDefaultDocument(),
    replacements = [],
    avatarMappings = null,
  } = {}) {
    const resolvedAvatarMappings =
      Array.isArray(avatarMappings) && avatarMappings.length
        ? avatarMappings
        : collectAvatarMappingsFromDoc(doc);
    const replacementMaps =
      typeof avatarExportResolutionApi.createAvatarExportResolutionContext === "function"
        ? avatarExportResolutionApi.createAvatarExportResolutionContext(
            {
              avatarMappings: resolvedAvatarMappings,
              replacements,
            },
            {
              buildReplacementMaps: avatarRulesApi.buildReplacementMaps,
              toAbsoluteUrl: (value) => toAbsoluteUrl(value, String(doc?.baseURI || "")),
              normalizeSpeakerName,
            }
          )
        : null;
    return {
      avatarMappings: resolvedAvatarMappings,
      replacementMaps,
    };
  }

  function analyzeFirefoxMessagesForStream(messages = []) {
    let lineCount = 0;
    let detectedRuleType = "";

    messages.forEach((messageEl) => {
      if (isHiddenPlaceholderMessage(messageEl)) return;
      lineCount += 1;
      if (detectedRuleType) return;
      const role = resolveRoleForMessage(messageEl);
      const dice =
        typeof chatJsonApi.parseRoll20DicePayload === "function"
          ? chatJsonApi.parseRoll20DicePayload({
              role,
              html: messageEl?.innerHTML || "",
            })
          : null;
      detectedRuleType = inferFirefoxRuleTypeFromRule(dice?.rule || "");
    });

    return {
      lineCount,
      ruleType: detectedRuleType,
    };
  }

  function buildFirefoxMessageEntry({
    messageEl,
    index = 0,
    doc = getDefaultDocument(),
    replacementMaps = null,
    previousMessageContext = {
      speaker: "",
      avatarSrc: "",
      speakerImageUrl: "",
      timestamp: "",
    },
  } = {}) {
    if (isHiddenPlaceholderMessage(messageEl)) {
      return {
        skipped: true,
        nextContext: previousMessageContext,
        detectedRuleType: "",
      };
    }

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
    const effectiveSpeakerImageUrl = resolvedContext.speakerImageUrl || resolvedContext.avatarSrc;
    const speakerImageUrl =
      typeof avatarExportResolutionApi.resolveAvatarExportUrl === "function"
        ? avatarExportResolutionApi.resolveAvatarExportUrl(
            {
              name: speaker,
              currentSrc: resolvedContext.avatarSrc,
              currentAvatarUrl: effectiveSpeakerImageUrl,
            },
            replacementMaps,
            {
              findReplacementForMessage: avatarRulesApi.findReplacementForMessage,
              toAbsoluteUrl: (value) => toAbsoluteUrl(value, String(doc?.baseURI || "")),
              normalizeSpeakerName,
            }
          )
        : effectiveSpeakerImageUrl || resolvedContext.avatarSrc;
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

    const entry = buildChatJsonEntry({
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
    });

    return {
      skipped: false,
      entry,
      detectedRuleType: inferFirefoxRuleTypeFromRule(dice?.rule || ""),
      nextContext: canInherit
        ? {
            speaker,
            avatarSrc: resolvedContext.avatarSrc,
            speakerImageUrl: speakerImageUrl || "",
            timestamp: effectiveTimestamp,
          }
        : previousMessageContext,
    };
  }

  function buildFirefoxJsonDocumentPrefix({ scenarioTitle = "", ruleType = "" } = {}) {
    const prefixPayload = {
      schemaVersion: 1,
      ebookView: {
        titlePage: {
          scenarioTitle: String(scenarioTitle || ""),
          ruleType: String(ruleType || ""),
          gm: "",
          pl: "",
          writer: "",
          copyright: "",
          identifier: "",
          extraMetaItems: [],
        },
      },
    };
    return `${JSON.stringify(prefixPayload).replace(/}$/, "")},"lines":[`;
  }

  function normalizeFirefoxJsonChunk(rawChunk = "") {
    const safeChunk = String(rawChunk || "");
    if (typeof chatJsonApi.normalizeImgurLinksInJsonText === "function") {
      return chatJsonApi.normalizeImgurLinksInJsonText(safeChunk);
    }
    return safeChunk;
  }

  function resolveDownloadTransferStage(
    progressRatio = 0,
    { processedLineCount = 0, lineCount = 0 } = {}
  ) {
    const ratio = Math.max(0, Math.min(1, Number(progressRatio) || 0));
    const percent = Math.max(50, Math.min(99, 50 + Math.floor(ratio * 49)));
    const safeLineCount = Math.max(0, Number(lineCount) || 0);
    const safeProcessedLineCount = Math.max(0, Number(processedLineCount) || 0);
    if (ratio >= 1) {
      return {
        percent: 99,
        detail: "파일 데이터를 모두 옮겼습니다. 저장 요청을 준비하고 있습니다.",
      };
    }
    if (safeLineCount > 0 && safeProcessedLineCount > 0) {
      return {
        percent,
        detail: `대사 ${safeLineCount}줄 중 ${Math.min(
          safeLineCount,
          safeProcessedLineCount
        )}줄을 파일에 옮기고 있습니다.`,
      };
    }
    return { percent, detail: "파일로 옮길 데이터를 준비하고 있습니다." };
  }

  function buildFirefoxExportPayload({
    doc = getDefaultDocument(),
    replacements = [],
    avatarMappings = null,
    includeAvatarLinkMeta = false,
    onProgress = null,
  } = {}) {
    reportExportProgress(onProgress, 10, "프로필 이미지 정보를 확인하는 중입니다.");
    const messages = collectMessages(doc);
    const lines = [];
    const { replacementMaps } = createFirefoxReplacementMaps({
      doc,
      replacements,
      avatarMappings,
    });
    reportExportProgress(
      onProgress,
      20,
      Array.isArray(replacements) && replacements.length > 0
        ? "바꿀 이미지 링크를 반영하는 중입니다."
        : "이미지 링크를 정리하는 중입니다."
    );
    const analysis = analyzeFirefoxMessagesForStream(messages);
    reportExportProgress(onProgress, 30, "규칙 종류와 대사 개수를 확인하는 중입니다.", {
      lineCount: analysis.lineCount,
    });
    reportExportProgress(onProgress, 40, "대사와 주사위 내용을 읽는 중입니다.");
    let previousMessageContext = {
      speaker: "",
      avatarSrc: "",
      speakerImageUrl: "",
      timestamp: "",
    };
    let detectedRuleType = String(analysis.ruleType || "");

    messages.forEach((messageEl, index) => {
      const messageResult = buildFirefoxMessageEntry({
        messageEl,
        index,
        doc,
        replacementMaps,
        previousMessageContext,
      });
      previousMessageContext = messageResult.nextContext || previousMessageContext;
      if (messageResult.skipped) return;
      if (!detectedRuleType && messageResult.detectedRuleType) {
        detectedRuleType = messageResult.detectedRuleType;
      }
      lines.push(messageResult.entry);
    });
    const documentPayload = buildChatJsonDocument({
      scenarioTitle: extractCampaignNameFromHref(doc),
      lines,
    });
    if (detectedRuleType) {
      documentPayload.ebookView.titlePage.ruleType = detectedRuleType;
    }
    const rawJsonText = JSON.stringify(documentPayload);
    const jsonText = normalizeFirefoxJsonChunk(rawJsonText);
    const jsonByteLength = measureJsonByteLength(jsonText);
    const lineCount = lines.length;
    reportExportProgress(onProgress, 50, "JSON 파일 내용을 정리하는 중입니다.", {
      jsonByteLength,
      lineCount,
    });

    return {
      jsonText,
      filenameBase: getDownloadNameBase(doc),
      jsonByteLength,
      lineCount,
    };
  }

  async function streamFirefoxDownloadDocument({
    doc = getDefaultDocument(),
    replacements = [],
    avatarMappings = null,
    sessionId = "",
    onProgress = null,
    browserApi = typeof browser !== "undefined" ? browser : null,
    chunkTargetByteLength = 64 * 1024,
  } = {}) {
    const runtimeApi = browserApi?.runtime;
    if (typeof runtimeApi?.sendMessage !== "function") {
      throw new Error("다운로드를 준비할 브라우저 API를 찾지 못했습니다.");
    }

    const safeSessionId = String(sessionId || "").trim();
    if (!safeSessionId) {
      throw new Error("다운로드 세션을 찾지 못했습니다.");
    }

    reportExportProgress(onProgress, 10, "프로필 이미지 정보를 확인하는 중입니다.");
    const messages = collectMessages(doc);
    const { replacementMaps } = createFirefoxReplacementMaps({
      doc,
      replacements,
      avatarMappings,
    });
    reportExportProgress(
      onProgress,
      20,
      Array.isArray(replacements) && replacements.length > 0
        ? "바꿀 이미지 링크를 반영하는 중입니다."
        : "이미지 링크를 정리하는 중입니다."
    );
    const analysis = analyzeFirefoxMessagesForStream(messages);
    reportExportProgress(onProgress, 30, "규칙 종류와 대사 개수를 확인하는 중입니다.", {
      lineCount: analysis.lineCount,
    });
    reportExportProgress(onProgress, 40, "대사와 주사위 내용을 읽는 중입니다.");

    const filenameBase = getDownloadNameBase(doc);
    ensureStreamResponse(
      await runtimeApi.sendMessage({
        type: FIREFOX_DOWNLOAD_STREAM_START_MESSAGE,
        sessionId: safeSessionId,
        filenameBase,
      }),
      "다운로드를 준비하지 못했습니다."
    );

    reportExportProgress(onProgress, 50, "파일로 옮길 데이터를 준비하고 있습니다.", {
      lineCount: analysis.lineCount,
    });

    let totalByteLength = 0;
    let pendingChunkParts = [];
    let pendingChunkByteLength = 0;
    let previousMessageContext = {
      speaker: "",
      avatarSrc: "",
      speakerImageUrl: "",
      timestamp: "",
    };
    let streamedLineCount = 0;
    let pendingChunkLineCount = 0;
    let lastReportedPercent = 50;
    let isFirstEntry = true;

    const appendChunkText = (value) => {
      const safeValue = String(value || "");
      if (!safeValue) return;
      pendingChunkParts.push(safeValue);
      const byteLength = measureJsonByteLength(safeValue);
      pendingChunkByteLength += byteLength;
      totalByteLength += byteLength;
    };

    const flushChunk = async ({ reportProgress = false } = {}) => {
      if (pendingChunkParts.length === 0) return;
      const chunkText = pendingChunkParts.join("");
      const chunkLineCount = pendingChunkLineCount;
      pendingChunkParts = [];
      pendingChunkByteLength = 0;
      pendingChunkLineCount = 0;
      ensureStreamResponse(
        await runtimeApi.sendMessage({
          type: FIREFOX_DOWNLOAD_STREAM_CHUNK_MESSAGE,
          sessionId: safeSessionId,
          chunkText,
        }),
        "다운로드용 데이터를 저장하지 못했습니다."
      );
      streamedLineCount += chunkLineCount;
      if (reportProgress) {
        const stage = resolveDownloadTransferStage(
          analysis.lineCount > 0 ? streamedLineCount / analysis.lineCount : 1,
          {
            processedLineCount: streamedLineCount,
            lineCount: analysis.lineCount,
          }
        );
        if (stage.percent !== lastReportedPercent || stage.percent === 99) {
          lastReportedPercent = stage.percent;
          reportExportProgress(onProgress, stage.percent, stage.detail, {
            lineCount: analysis.lineCount,
            jsonByteLength: totalByteLength,
          });
        }
      }
    };

    // Re-run the message pass with progress-aware flushing to keep memory lower.
    pendingChunkParts = [];
    pendingChunkByteLength = 0;
    totalByteLength = 0;
    streamedLineCount = 0;
    pendingChunkLineCount = 0;
    lastReportedPercent = 50;
    isFirstEntry = true;
    previousMessageContext = {
      speaker: "",
      avatarSrc: "",
      speakerImageUrl: "",
      timestamp: "",
    };

    appendChunkText(
      normalizeFirefoxJsonChunk(
        buildFirefoxJsonDocumentPrefix({
          scenarioTitle: extractCampaignNameFromHref(doc),
          ruleType: analysis.ruleType,
        })
      )
    );

    for (let index = 0; index < messages.length; index += 1) {
      const messageResult = buildFirefoxMessageEntry({
        messageEl: messages[index],
        index,
        doc,
        replacementMaps,
        previousMessageContext,
      });
      previousMessageContext = messageResult.nextContext || previousMessageContext;
      if (messageResult.skipped) continue;

      const entryJson = JSON.stringify(messageResult.entry);
      appendChunkText(
        normalizeFirefoxJsonChunk(`${isFirstEntry ? "" : ","}${entryJson}`)
      );
      isFirstEntry = false;
      pendingChunkLineCount += 1;
      if (pendingChunkByteLength >= chunkTargetByteLength) {
        await flushChunk({ reportProgress: true });
      }
    }

    appendChunkText("]}");
    await flushChunk({ reportProgress: true });
    if (analysis.lineCount === 0 || lastReportedPercent < 99) {
      const finalStage = resolveDownloadTransferStage(1, {
        processedLineCount: analysis.lineCount,
        lineCount: analysis.lineCount,
      });
      reportExportProgress(onProgress, finalStage.percent, finalStage.detail, {
        jsonByteLength: totalByteLength,
        lineCount: analysis.lineCount,
      });
    }

    const finishResponse = await runtimeApi.sendMessage({
      type: FIREFOX_DOWNLOAD_STREAM_FINISH_MESSAGE,
      sessionId: safeSessionId,
    });
    ensureStreamResponse(finishResponse, "다운로드를 시작하지 못했습니다.");

    return {
      ok: true,
      filename: String(finishResponse?.filename || ""),
      usedFallbackFilename: !!finishResponse?.usedFallbackFilename,
      filenameBase,
      jsonByteLength: totalByteLength,
      lineCount: analysis.lineCount,
    };
  }

  function buildReadingLogPageScriptSource(deeplinkUrl = "") {
    const safeUrl = String(deeplinkUrl || "").trim();
    if (!safeUrl) {
      throw new Error("ReadingLog 앱을 열지 못했습니다.");
    }
    const serializedUrl = JSON.stringify(safeUrl);
    return `
      (() => {
        const anchor = document.createElement("a");
        anchor.href = ${serializedUrl};
        anchor.rel = "noopener";
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        try {
          anchor.click();
        } finally {
          anchor.remove();
        }
      })();
    `;
  }

  function openReadingLogAppFromDocument(
    deeplinkUrl = "",
    { doc = getDefaultDocument() } = {}
  ) {
    const safeUrl = String(deeplinkUrl || "").trim();
    if (!safeUrl) {
      throw new Error("ReadingLog 앱을 열지 못했습니다.");
    }
    if (
      typeof doc?.createElement !== "function" ||
      !doc?.body ||
      typeof doc.body.appendChild !== "function" ||
      !doc?.documentElement ||
      typeof doc.documentElement.appendChild !== "function"
    ) {
      throw new Error("ReadingLog 앱을 열지 못했습니다.");
    }
    const script = doc.createElement("script");
    script.type = "text/javascript";
    script.textContent = buildReadingLogPageScriptSource(safeUrl);
    try {
      doc.documentElement.appendChild(script);
      return safeUrl;
    } finally {
      if (typeof script.remove === "function") {
        script.remove();
      }
    }
  }

  function createRuntimeMessageHandler({
    buildFirefoxExportPayload: buildPayload = buildFirefoxExportPayload,
    collectAvatarMappingsFromDoc: collectMappings = collectAvatarMappingsFromDoc,
    streamFirefoxDownloadDocument: streamDownload = streamFirefoxDownloadDocument,
    openReadingLogAppFromDocument: openReadingLogApp = openReadingLogAppFromDocument,
  } = {}) {
    return async (message) => {
      if (message?.type === FIREFOX_PING_MESSAGE) {
        return { ok: true };
      }

      if (message?.type === FIREFOX_GET_AVATAR_MAPPINGS_MESSAGE) {
        try {
          return {
            ok: true,
            mappings: collectMappings(),
          };
        } catch (error) {
          return {
            ok: false,
            errorMessage:
              error?.message
                ? String(error.message)
                : "이미지 링크 목록을 불러오는 중 오류가 발생했습니다.",
          };
        }
      }

      if (message?.type === FIREFOX_OPEN_READINGLOG_APP_MESSAGE) {
        try {
          return {
            ok: true,
            deeplinkUrl: openReadingLogApp(String(message?.deeplinkUrl || "")),
          };
        } catch (error) {
          return {
            ok: false,
            errorMessage:
              error?.message ? String(error.message) : "ReadingLog 앱을 열지 못했습니다.",
          };
        }
      }

      if (message?.type === FIREFOX_EXPORT_JSON_MESSAGE) {
        try {
          const notifyProgress = createExportProgressNotifier(String(message?.sessionId || ""));
          const avatarMappings = collectMappings();
          if (message?.delivery === "background-download") {
            const downloadResult = await streamDownload({
              avatarMappings,
              sessionId: String(message?.sessionId || ""),
              onProgress: notifyProgress,
              browserApi: typeof browser !== "undefined" ? browser : null,
            });
            return {
              ok: true,
              deliveredBy: "background-download",
              method: "download",
              filename: String(downloadResult?.filename || ""),
              usedFallbackFilename: !!downloadResult?.usedFallbackFilename,
              jsonByteLength: Number(downloadResult?.jsonByteLength || 0),
              lineCount: Number(downloadResult?.lineCount || 0),
            };
          }
          const payload = buildPayload({
            avatarMappings,
            includeAvatarLinkMeta: true,
            onProgress: notifyProgress,
          });
          return {
            ok: true,
            jsonText: String(payload?.jsonText || ""),
            filenameBase: String(payload?.filenameBase || "roll20-chat"),
            jsonByteLength: Number(payload?.jsonByteLength || 0),
            lineCount: Number(payload?.lineCount || 0),
          };
        } catch (error) {
          return {
            ok: false,
            errorMessage:
              error?.message ? String(error.message) : "JSON 생성 중 오류가 발생했습니다.",
          };
        }
      }

      if (message?.type === FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE) {
        try {
          const notifyProgress = createExportProgressNotifier(String(message?.sessionId || ""));
          const avatarMappings = collectMappings();
          const replacements = Array.isArray(message?.replacements) ? message.replacements : [];
          if (message?.delivery === "background-download") {
            const downloadResult = await streamDownload({
              replacements,
              avatarMappings,
              sessionId: String(message?.sessionId || ""),
              onProgress: notifyProgress,
              browserApi: typeof browser !== "undefined" ? browser : null,
            });
            return {
              ok: true,
              deliveredBy: "background-download",
              method: "download",
              filename: String(downloadResult?.filename || ""),
              usedFallbackFilename: !!downloadResult?.usedFallbackFilename,
              jsonByteLength: Number(downloadResult?.jsonByteLength || 0),
              lineCount: Number(downloadResult?.lineCount || 0),
            };
          }
          const payload = buildPayload({
            replacements,
            avatarMappings,
            onProgress: notifyProgress,
          });
          return {
            ok: true,
            jsonText: String(payload?.jsonText || ""),
            filenameBase: String(payload?.filenameBase || "roll20-chat"),
            jsonByteLength: Number(payload?.jsonByteLength || 0),
            lineCount: Number(payload?.lineCount || 0),
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

  if (typeof browser !== "undefined" && browser.runtime?.onMessage) {
    browser.runtime.onMessage.addListener(createRuntimeMessageHandler());
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      FIREFOX_PING_MESSAGE,
      FIREFOX_EXPORT_JSON_MESSAGE,
      FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE,
      FIREFOX_GET_AVATAR_MAPPINGS_MESSAGE,
      FIREFOX_EXPORT_PROGRESS_MESSAGE,
      FIREFOX_OPEN_READINGLOG_APP_MESSAGE,
      FIREFOX_DOWNLOAD_STREAM_START_MESSAGE,
      FIREFOX_DOWNLOAD_STREAM_CHUNK_MESSAGE,
      FIREFOX_DOWNLOAD_STREAM_FINISH_MESSAGE,
      parseCampaignNameFromHref,
      extractCampaignNameFromHref,
      buildFirefoxExportPayload,
      collectAvatarMappingsFromDoc,
      reportExportProgress,
      measureJsonByteLength,
      createExportProgressNotifier,
      buildReadingLogPageScriptSource,
      openReadingLogAppFromDocument,
      resolveDownloadTransferStage,
      streamFirefoxDownloadDocument,
      createRuntimeMessageHandler,
    };
  }
})();
    const ensureStreamResponse = (response, fallbackMessage) => {
      if (response?.ok === false) {
        throw new Error(response?.errorMessage || fallbackMessage);
      }
    };
