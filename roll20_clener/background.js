chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    {
      colorFilterEnabled: false,
      hiddenTextEnabled: false,
      targetColor: "#aaaaaa",
    },
    (values) => {
      chrome.storage.sync.set(values);
    }
  );
});
