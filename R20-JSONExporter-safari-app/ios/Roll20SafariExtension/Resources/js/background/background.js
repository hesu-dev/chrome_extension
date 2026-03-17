(function () {
  const runtimeApi =
    typeof browser !== "undefined" && browser?.runtime
      ? browser
      : typeof chrome !== "undefined" && chrome?.runtime
        ? chrome
        : null;

  if (!runtimeApi?.runtime?.onMessage?.addListener) {
    return;
  }

  function logAvatarBackground(level, payload) {
    const logger = console?.[level] || console?.log;
    if (typeof logger === "function") {
      logger("[AvatarBackground]", payload);
    }
  }

  function isRoll20AvatarUrl(url) {
    return /\/users\/avatar\/[^/]+\/\d+/i.test(String(url || ""));
  }

  async function resolveRedirectUrl(targetUrl, { traceId = "" } = {}) {
    const absolute = String(targetUrl || "").trim();
    if (!absolute) return "";

    try {
      logAvatarBackground("info", { traceId, stage: "head_start", url: absolute });
      const headResponse = await fetch(absolute, {
        method: "HEAD",
        redirect: "follow",
        credentials: "include",
      });
      const headResolved = String(headResponse?.url || "").trim();
      logAvatarBackground("info", {
        traceId,
        stage: "head_done",
        url: absolute,
        resolved: headResolved,
      });
      if (headResolved && !isRoll20AvatarUrl(headResolved)) {
        return headResolved;
      }
    } catch (error) {
      logAvatarBackground("warn", {
        traceId,
        stage: "head_error",
        url: absolute,
        error: String(error?.message || error),
      });
      // Fallback to GET when HEAD is not available.
    }

    try {
      logAvatarBackground("info", { traceId, stage: "get_start", url: absolute });
      const getResponse = await fetch(absolute, {
        method: "GET",
        redirect: "follow",
        credentials: "include",
      });
      const getResolved = String(getResponse?.url || "").trim();
      logAvatarBackground("info", {
        traceId,
        stage: "get_done",
        url: absolute,
        resolved: getResolved,
      });
      if (getResolved && !isRoll20AvatarUrl(getResolved)) {
        return getResolved;
      }
    } catch (error) {
      logAvatarBackground("warn", {
        traceId,
        stage: "get_error",
        url: absolute,
        error: String(error?.message || error),
      });
      // Fall through to the empty response below.
    }

    logAvatarBackground("warn", { traceId, stage: "resolve_failed", url: absolute });
    return "";
  }

  runtimeApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "R20_SAFARI_RESOLVE_REDIRECT_URL") {
      return undefined;
    }

    const traceId = String(message?.traceId || "");
    logAvatarBackground("info", {
      traceId,
      stage: "message_received",
      url: String(message?.url || ""),
    });

    resolveRedirectUrl(message?.url, { traceId })
      .then((finalUrl) => {
        logAvatarBackground("info", {
          traceId,
          stage: "message_respond",
          ok: !!finalUrl,
          finalUrl: finalUrl || "",
        });
        sendResponse({
          ok: !!finalUrl,
          finalUrl: finalUrl || "",
        });
      })
      .catch((error) => {
        logAvatarBackground("error", {
          traceId,
          stage: "message_error",
          url: String(message?.url || ""),
          error: String(error?.message || error),
        });
        sendResponse({
          ok: false,
          finalUrl: "",
        });
      });

    return true;
  });
})();
