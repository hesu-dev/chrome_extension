(function () {
  const FIREFOX_DOWNLOAD_JSON_MESSAGE = "R20_JSON_EXPORTER_FIREFOX_DOWNLOAD_JSON";

  function buildDownloadFilename(filenameBase) {
    const cleaned = String(filenameBase || "roll20-chat")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    const base = cleaned || "roll20-chat";
    return base.toLowerCase().endsWith(".json") ? base : `${base}.json`;
  }

  async function downloadJsonPayload(
    { jsonText = "", filenameBase = "roll20-chat" } = {},
    {
      BlobCtor = typeof Blob !== "undefined" ? Blob : null,
      createObjectURL = (blob) => URL.createObjectURL(blob),
      revokeObjectURL = (url) => URL.revokeObjectURL(url),
      download = (options) => browser.downloads.download(options),
    } = {}
  ) {
    if (typeof BlobCtor !== "function") {
      throw new Error("Blob 생성기를 찾지 못했습니다.");
    }
    if (typeof createObjectURL !== "function" || typeof revokeObjectURL !== "function") {
      throw new Error("브라우저 URL API를 찾지 못했습니다.");
    }
    if (typeof download !== "function") {
      throw new Error("다운로드 API를 찾지 못했습니다.");
    }

    const filename = buildDownloadFilename(filenameBase);
    const blob = new BlobCtor([String(jsonText || "")], {
      type: "application/json;charset=utf-8",
    });
    const url = createObjectURL(blob);

    try {
      await download({
        url,
        filename,
        saveAs: false,
        conflictAction: "uniquify",
      });
      return {
        ok: true,
        filename,
      };
    } finally {
      revokeObjectURL(url);
    }
  }

  function createBackgroundMessageHandler() {
    return async (message) => {
      if (message?.type !== FIREFOX_DOWNLOAD_JSON_MESSAGE) {
        return undefined;
      }

      try {
        return await downloadJsonPayload({
          jsonText: message?.jsonText || "",
          filenameBase: message?.filenameBase || "roll20-chat",
        });
      } catch (error) {
        return {
          ok: false,
          errorMessage: error?.message ? String(error.message) : "다운로드를 시작하지 못했습니다.",
        };
      }
    };
  }

  if (typeof browser !== "undefined" && browser.runtime?.onInstalled) {
    browser.runtime.onInstalled.addListener(() => {
      browser.storage?.local?.set?.({
        firefoxMobileShellReady: true,
      });
    });
  }

  if (typeof browser !== "undefined" && browser.runtime?.onMessage) {
    browser.runtime.onMessage.addListener(createBackgroundMessageHandler());
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      FIREFOX_DOWNLOAD_JSON_MESSAGE,
      buildDownloadFilename,
      downloadJsonPayload,
      createBackgroundMessageHandler,
    };
  }
})();
