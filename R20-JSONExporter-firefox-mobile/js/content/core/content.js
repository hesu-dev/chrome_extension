(function () {
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "R20_JSON_EXPORTER_FIREFOX_PING") {
      return Promise.resolve({ ok: true });
    }
    return undefined;
  });
})();
