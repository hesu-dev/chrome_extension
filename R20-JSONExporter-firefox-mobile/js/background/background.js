(function () {
  browser.runtime.onInstalled.addListener(() => {
    browser.storage.local.set({
      firefoxMobileShellReady: true,
    });
  });
})();
