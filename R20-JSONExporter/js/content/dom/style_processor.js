// style_processor.js

(function () {
    const { toAbsoluteUrl, fetchText } = window.Roll20CleanerUtils;
    const perf = window.Roll20CleanerPerf || {};

    const MINIMAL_STYLE_PROPS = [
        "display", "visibility", "opacity",
        "float", "clear",
        "width", "height", "box-sizing",
        "min-width", "max-width", "min-height", "max-height",
        "margin-top", "margin-right", "margin-bottom", "margin-left",
        "padding-top", "padding-right", "padding-bottom", "padding-left",
        "font-family", "font-size", "font-weight", "line-height", "color",
        "white-space", "text-align", "vertical-align",
        "background-color", "background-image", "background-position", "background-size", "background-repeat",
    ];

    const BALANCED_STYLE_PROPS = [
        ...MINIMAL_STYLE_PROPS,
        "position", "top", "right", "bottom", "left", "z-index",
        "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
        "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
        "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
        "border-radius",
        "background-color", "background-image", "background-position", "background-size", "background-repeat", "background-attachment",
        "overflow", "overflow-x", "overflow-y",
        "transform", "transform-origin",
        "justify-content", "align-items", "align-content", "flex-direction", "flex-wrap", "gap", "row-gap", "column-gap",
        "grid-template-columns", "grid-template-rows", "grid-auto-columns", "grid-auto-rows", "grid-auto-flow",
        "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end",
        "place-content", "place-items", "justify-self", "align-self",
        "text-shadow", "box-shadow",
    ];

    function normalizeColor(color) {
        if (!color) return "";
        const swatch = document.createElement("span");
        swatch.style.color = color;
        document.body.appendChild(swatch);
        const normalized = getComputedStyle(swatch).color;
        swatch.remove();
        return normalized;
    }

    function rewriteCssUrls(cssText, baseUrl) {
        return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, quote, rawUrl) => {
            const value = (rawUrl || "").trim();
            if (!value || value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("#")) {
                return full;
            }
            const absolute = toAbsoluteUrl(value, baseUrl);
            if (!absolute) return full;
            return `url("${absolute}")`;
        });
    }

    async function resolveImportedCss(cssText, baseUrl, depth = 0) {
        if (depth > 4) return rewriteCssUrls(cssText, baseUrl);
        const importRegex = /@import\s+(?:url\(\s*)?['"]?([^'")\s]+)['"]?\s*\)?\s*([^;]*);/gi;
        let result = "";
        let lastIndex = 0;
        let match = importRegex.exec(cssText);

        while (match) {
            const full = match[0];
            const importUrl = match[1];
            const media = (match[2] || "").trim();
            result += cssText.slice(lastIndex, match.index);
            lastIndex = match.index + full.length;

            const absoluteImportUrl = toAbsoluteUrl(importUrl, baseUrl);
            if (!absoluteImportUrl) {
                match = importRegex.exec(cssText);
                continue;
            }

            try {
                const importedCss = await fetchText(absoluteImportUrl);
                const resolvedCss = await resolveImportedCss(importedCss, absoluteImportUrl, depth + 1);
                if (media) {
                    result += `@media ${media} {\n${resolvedCss}\n}\n`;
                } else {
                    result += `${resolvedCss}\n`;
                }
            } catch (error) {
                // Keep moving even if one imported stylesheet fails.
            }

            match = importRegex.exec(cssText);
        }

        result += cssText.slice(lastIndex);
        return rewriteCssUrls(result, baseUrl);
    }

    function appendStyleProp(styleParts, computed, prop) {
        const value = computed.getPropertyValue(prop);
        if (!value) return;
        styleParts.push(`${prop}:${value};`);
    }

    // --- New Feature: Copy Computed Styles for Single Node ---
    function copyComputedStyle(originalNode, cloneNode, options = {}) {
        const computed = window.getComputedStyle(originalNode);
        const mode = perf.resolveStyleMode
            ? perf.resolveStyleMode({ estimatedNodes: options.estimatedNodes || 0, requestedMode: options.mode || "full" })
            : (options.mode || "full");
        const parts = [];

        if (mode === "full" && computed.length > 0) {
            for (const prop of computed) {
                appendStyleProp(parts, computed, prop);
            }
        } else {
            const properties = mode === "minimal" ? MINIMAL_STYLE_PROPS : BALANCED_STYLE_PROPS;
            for (const prop of properties) {
                appendStyleProp(parts, computed, prop);
            }
        }

        if (!parts.length) {
            cloneNode.removeAttribute("style");
            return;
        }
        cloneNode.setAttribute("style", parts.join(""));
    }

    async function inlineStyles(doc) {
        const createEl = (tag) => (doc.ownerDocument || document).createElement(tag);
        const links = Array.from(doc.querySelectorAll("link[href]")).filter((link) => {
            const rel = (link.getAttribute("rel") || "").toLowerCase();
            const as = (link.getAttribute("as") || "").toLowerCase();
            return rel.includes("stylesheet") || as === "style";
        });

        for (const link of links) {
            const href = link.getAttribute("href");
            const absoluteUrl = toAbsoluteUrl(href);
            if (!absoluteUrl) continue;
            try {
                const cssText = await fetchText(absoluteUrl);
                const resolvedCss = await resolveImportedCss(cssText, absoluteUrl);
                const styleEl = createEl("style");
                styleEl.setAttribute("data-roll20-cleaner-source", absoluteUrl);
                styleEl.textContent = resolvedCss;
                link.replaceWith(styleEl);
            } catch (error) {
                // Keep original link if fetch fails due to CORS or network issues.
            }
        }

        const styleTags = Array.from(doc.querySelectorAll("style"));
        for (const styleTag of styleTags) {
            const raw = styleTag.textContent || "";
            if (!raw.includes("@import")) continue;
            try {
                styleTag.textContent = await resolveImportedCss(raw, document.baseURI);
            } catch (error) {
                // Leave style as-is if resolving fails.
            }
        }
    }

    window.Roll20CleanerStyle = window.Roll20CleanerStyle || {};
    Object.assign(window.Roll20CleanerStyle, {
        normalizeColor,
        copyComputedStyle,
        inlineStyles
    });
    console.log("[Roll20Cleaner] Style Processor loaded");
})();
