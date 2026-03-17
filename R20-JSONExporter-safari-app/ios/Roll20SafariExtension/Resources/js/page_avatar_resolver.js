(function () {
  if (globalThis.__readingLogSafariPageAvatarResolverLoaded) {
    return;
  }
  globalThis.__readingLogSafariPageAvatarResolverLoaded = true;

  const REQUEST_TYPE = "READINGLOG_SAFARI_PAGE_AVATAR_RESOLVE_REQUEST";
  const RESPONSE_TYPE = "READINGLOG_SAFARI_PAGE_AVATAR_RESOLVE_RESPONSE";

  function toAbsoluteUrl(value, baseUrl) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      return new URL(raw, baseUrl || window.location.href).href;
    } catch (error) {
      return raw;
    }
  }

  function isRoll20AvatarUrl(url) {
    return /\/users\/avatar\/[^/]+\/\d+/i.test(String(url || ""));
  }

  function logAvatarPage(level, payload) {
    const logger = console?.[level] || console?.log;
    if (typeof logger === "function") {
      logger("[AvatarPage]", payload);
    }
  }

  function resolveAvatarUrlViaImage(absoluteUrl, timeoutMs) {
    return new Promise((resolve) => {
      if (!absoluteUrl || typeof Image !== "function") {
        resolve("");
        return;
      }

      const image = new Image();
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value || "");
      };
      const timer = setTimeout(() => finish(""), Math.max(0, Number(timeoutMs) || 0));
      image.onload = () => finish(image.currentSrc || image.src || "");
      image.onerror = () => finish("");
      image.src = absoluteUrl;
    });
  }

  async function resolveAvatarUrl(originalUrl, { traceId = "" } = {}) {
    const absolute = toAbsoluteUrl(originalUrl);
    if (!absolute || !isRoll20AvatarUrl(absolute)) return absolute;

    try {
      const byImageFirst = toAbsoluteUrl(await resolveAvatarUrlViaImage(absolute, 2500), absolute);
      if (byImageFirst && !isRoll20AvatarUrl(byImageFirst)) return byImageFirst;

      if (typeof fetch === "function") {
        try {
          const manualResponse = await fetch(absolute, {
            method: "GET",
            redirect: "manual",
            credentials: "include",
          });
          const location = manualResponse?.headers?.get?.("location") || "";
          const manualResolved = toAbsoluteUrl(location, absolute);
          if (manualResolved && !isRoll20AvatarUrl(manualResolved)) return manualResolved;
        } catch (error) {
          // Continue to the next strategy.
        }

        try {
          const followedResponse = await fetch(absolute, {
            method: "GET",
            redirect: "follow",
            credentials: "include",
          });
          const followedResolved = toAbsoluteUrl(followedResponse?.url || "", absolute);
          if (followedResolved && !isRoll20AvatarUrl(followedResolved)) return followedResolved;
        } catch (error) {
          // Continue to the next strategy.
        }
      }

      const byImageLast = toAbsoluteUrl(await resolveAvatarUrlViaImage(absolute, 4000), absolute);
      if (byImageLast && !isRoll20AvatarUrl(byImageLast)) return byImageLast;
    } catch (error) {
      // Fall through to the original URL.
    }

    logAvatarPage("warn", {
      traceId,
      stage: "resolve_fallback_original",
      originalUrl: absolute,
    });
    return absolute;
  }

  async function resolveAvatarMappings(avatarCandidates, { traceId = "" } = {}) {
    const candidates = Array.isArray(avatarCandidates) ? avatarCandidates : [];
    const seen = new Set();
    const resolved = [];

    for (const candidate of candidates) {
      const originalUrl = toAbsoluteUrl(candidate?.originalUrl || "");
      if (!originalUrl || seen.has(originalUrl)) continue;
      seen.add(originalUrl);

      const avatarUrl = await resolveAvatarUrl(originalUrl, { traceId });
      logAvatarPage("info", {
        traceId,
        stage: "resolve_one",
        originalUrl,
        avatarUrl: avatarUrl || originalUrl,
        stillRoll20: isRoll20AvatarUrl(avatarUrl || originalUrl),
      });
      resolved.push({
        originalUrl,
        avatarUrl: avatarUrl || originalUrl,
      });
    }

    return resolved;
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const payload = event.data;
    if (payload?.source !== "readinglog-safari-content") return;
    if (payload?.type !== REQUEST_TYPE) return;

    const traceId = String(payload.traceId || "");
    logAvatarPage("info", {
      traceId,
      stage: "request_received",
      candidateCount: Array.isArray(payload.avatarCandidates) ? payload.avatarCandidates.length : 0,
    });
    const resolvedAvatars = await resolveAvatarMappings(payload.avatarCandidates || [], { traceId });
    window.postMessage(
      {
        source: "readinglog-safari-page",
        type: RESPONSE_TYPE,
        requestId: String(payload.requestId || ""),
        traceId,
        resolvedAvatars,
      },
      "*"
    );
  });
})();
