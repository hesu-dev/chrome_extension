chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    {
      colorFilterEnabled: false,
      hiddenTextEnabled: false,
      targetColor: "color: #aaaaaa",
    },
    (values) => {
      chrome.storage.sync.set(values);
    }
  );
});

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "RESOLVE_REDIRECT_URL") {
    const targetUrl = message?.url;
    if (!targetUrl || typeof targetUrl !== "string") {
      sendResponse({ ok: false, finalUrl: "" });
      return true;
    }

    fetch(targetUrl, { method: "HEAD", redirect: "follow" })
      .then((response) => {
        sendResponse({ ok: true, finalUrl: response.url });
      })
      .catch(() => {
        // Fallback to GET if HEAD fails
        fetch(targetUrl, { method: "GET", redirect: "follow" })
          .then((response) => {
            sendResponse({ ok: true, finalUrl: response.url });
          })
          .catch((err) => {
            console.error("Resolve redirect failed:", err);
            sendResponse({ ok: false, finalUrl: "" });
          });
      });
    return true;
  }

  if (message?.type === "FETCH_URL_AS_DATA_URL") {
    const targetUrl = message?.url;
    if (!targetUrl || typeof targetUrl !== "string") {
      sendResponse({ ok: false, dataUrl: "" });
      return true;
    }

    fetch(targetUrl, { method: "GET", redirect: "follow" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType =
          response.headers.get("content-type") || "application/octet-stream";
        const buffer = await response.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        sendResponse({
          ok: true,
          dataUrl: `data:${contentType};base64,${base64}`,
        });
      })
      .catch((err) => {
        console.error("Fetch data url failed:", err);
        sendResponse({ ok: false, dataUrl: "" });
      });

    return true;
  }
});
