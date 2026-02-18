// performance_utils.js

(function (root, factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    root.Roll20CleanerPerf = root.Roll20CleanerPerf || {};
    Object.assign(root.Roll20CleanerPerf, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const AUTO_MODE_FULL_THRESHOLD = 8000;
    const AUTO_MODE_MINIMAL_THRESHOLD = 200000;

    function toSafeInt(value) {
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) return 0;
        return Math.floor(num);
    }

    function getUtf8ByteLength(text) {
        const value = typeof text === "string" ? text : String(text ?? "");
        if (typeof TextEncoder !== "undefined") {
            return new TextEncoder().encode(value).length;
        }
        return value.length;
    }

    function computeThreeXTarget(baseBytes) {
        return toSafeInt(baseBytes) * 3;
    }

    function resolveStyleMode({ estimatedNodes = 0, requestedMode = "auto" } = {}) {
        const mode = (requestedMode || "auto").toLowerCase();
        if (mode !== "auto") return mode;

        const nodes = toSafeInt(estimatedNodes);
        if (nodes >= AUTO_MODE_MINIMAL_THRESHOLD) return "minimal";
        if (nodes >= AUTO_MODE_FULL_THRESHOLD) return "balanced";
        return "full";
    }

    function shouldBlockClipboardCopy({ htmlBytes = 0, maxBytes = 0 } = {}) {
        const payload = toSafeInt(htmlBytes);
        const limit = toSafeInt(maxBytes);
        if (!limit) return false;
        return payload > limit;
    }

    return {
        getUtf8ByteLength,
        computeThreeXTarget,
        resolveStyleMode,
        shouldBlockClipboardCopy,
        AUTO_MODE_FULL_THRESHOLD,
        AUTO_MODE_MINIMAL_THRESHOLD,
    };
});
