// utils.js

const INLINE_FETCH_TIMEOUT_MS = 10000;

function toAbsoluteUrl(url, baseUrl = document.baseURI) {
    try {
        return new URL(url, baseUrl).href;
    } catch (error) {
        return "";
    }
}

function fetchText(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INLINE_FETCH_TIMEOUT_MS);
    return fetch(url, {
        credentials: "include",
        signal: controller.signal,
    })
        .finally(() => clearTimeout(timeoutId))
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.text();
        });
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to convert blob to data URL"));
        reader.readAsDataURL(blob);
    });
}

async function fetchDataUrl(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INLINE_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            credentials: "include",
            signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        return await blobToDataUrl(blob);
    } catch (error) {
        throw error;
    }
}

async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let index = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
            const current = index;
            index += 1;
            results[current] = await worker(items[current], current);
        }
    });
    await Promise.all(runners);
    return results;
}

function reportBundleProgress(requestId, percent, label) {
    if (!requestId) return;
    chrome.runtime.sendMessage({
        type: "BUNDLE_PROGRESS",
        requestId,
        percent,
        label,
    });
}

// Make functions available globally
// Make functions available globally
window.Roll20CleanerUtils = window.Roll20CleanerUtils || {};
Object.assign(window.Roll20CleanerUtils, {
    toAbsoluteUrl,
    fetchText,
    blobToDataUrl,
    fetchDataUrl,
    mapLimit,
    reportBundleProgress,
    INLINE_FETCH_TIMEOUT_MS,
});
console.log("[Roll20Cleaner] Utils loaded");
