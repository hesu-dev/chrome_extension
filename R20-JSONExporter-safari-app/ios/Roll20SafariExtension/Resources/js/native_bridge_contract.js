(function () {
  const contract = {
    APP_GROUP_ID: "group.com.reha.readinglog.sync",
    INBOX_RELATIVE_PATH: "roll20/inbox",
    PENDING_RELATIVE_PATH: "roll20/pending",
    FILE_EXTENSION: ".json",
    NATIVE_BRIDGE_CHANNEL: "com.reha.r20safariexport.bridge",
    MESSAGE_TYPES: {
      storagePreflight: "R20_SAFARI_STORAGE_PREFLIGHT",
      writeInboxExport: "R20_SAFARI_WRITE_INBOX_EXPORT",
    },
    STORAGE_LIMITS: {
      minFreeBytesForWrite: 256 * 1024 * 1024,
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = contract;
    return;
  }

  window.Roll20SafariNativeBridgeContract = contract;
})();
