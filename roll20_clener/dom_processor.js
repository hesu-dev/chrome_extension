// dom_processor.js

(function () {
    const { toAbsoluteUrl, mapLimit, fetchDataUrl } = window.Roll20CleanerUtils;
    const perf = window.Roll20CleanerPerf || {};
    // Roll20CleanerStyle might not be fully initialized if this script runs before it, 
    // but the functions are called later. Phew.

    const ROOT_CLASS = "roll20-cleaner-enabled";
    const PREV_DISPLAY_ATTR = "data-roll20-cleaner-prev-display";
    const COLOR_HIDE_ATTR = "data-roll20-cleaner-color-hide";
    const TEXT_HIDE_ATTR = "data-roll20-cleaner-text-hide";

    function estimateElementCount(root) {
        if (!root || root.nodeType !== 1) return 0;
        const descendants = root.querySelectorAll ? root.querySelectorAll("*").length : 0;
        return descendants + 1;
    }

    function applyVisibilityAndStyle(originalNode, cloneNode, styleMode, estimatedNodes) {
        const style = getComputedStyle(originalNode);
        if (style.display === "none") {
            cloneNode.remove();
            return false;
        }

        if (window.Roll20CleanerStyle && window.Roll20CleanerStyle.copyComputedStyle) {
            window.Roll20CleanerStyle.copyComputedStyle(originalNode, cloneNode, {
                mode: styleMode,
                estimatedNodes,
            });
        }
        return true;
    }

    function processVisibleNodes(originalNode, cloneNode, options = {}) {
        if (originalNode.nodeType !== 1) return { processedNodes: 0, estimatedNodes: 0, styleMode: "full" };

        const estimatedNodes = options.estimatedNodes || estimateElementCount(originalNode);
        const styleMode = perf.resolveStyleMode
            ? perf.resolveStyleMode({ estimatedNodes, requestedMode: options.styleMode || "full" })
            : (options.styleMode || "full");

        const stack = [{ original: originalNode, clone: cloneNode }];
        let processedNodes = 0;

        while (stack.length) {
            const pair = stack.pop();
            if (!pair) break;
            const original = pair.original;
            const clone = pair.clone;

            if (original.nodeType !== 1) continue;
            processedNodes += 1;

            const visible = applyVisibilityAndStyle(original, clone, styleMode, estimatedNodes);
            if (!visible) continue;

            const originalChildren = original.childNodes;
            const cloneChildren = clone.childNodes;
            for (let i = originalChildren.length - 1; i >= 0; i -= 1) {
                const originalChild = originalChildren[i];
                const cloneChild = cloneChildren[i];
                if (!cloneChild || originalChild.nodeType !== 1) continue;
                stack.push({ original: originalChild, clone: cloneChild });
            }
        }

        return { processedNodes, estimatedNodes, styleMode };
    }

    async function processVisibleNodesBatched(originalNode, cloneNode, options = {}) {
        if (originalNode.nodeType !== 1) return { processedNodes: 0, estimatedNodes: 0, styleMode: "full" };

        const estimatedNodes = options.estimatedNodes || estimateElementCount(originalNode);
        const styleMode = perf.resolveStyleMode
            ? perf.resolveStyleMode({ estimatedNodes, requestedMode: options.styleMode || "auto" })
            : (options.styleMode || "balanced");
        const chunkSize = Math.max(100, Number(options.chunkSize) || 400);
        const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;

        const stack = [{ original: originalNode, clone: cloneNode }];
        let processedNodes = 0;

        while (stack.length) {
            const pair = stack.pop();
            if (!pair) break;
            const original = pair.original;
            const clone = pair.clone;

            if (original.nodeType !== 1) continue;
            processedNodes += 1;

            const visible = applyVisibilityAndStyle(original, clone, styleMode, estimatedNodes);
            if (visible) {
                const originalChildren = original.childNodes;
                const cloneChildren = clone.childNodes;
                for (let i = originalChildren.length - 1; i >= 0; i -= 1) {
                    const originalChild = originalChildren[i];
                    const cloneChild = cloneChildren[i];
                    if (!cloneChild || originalChild.nodeType !== 1) continue;
                    stack.push({ original: originalChild, clone: cloneChild });
                }
            }

            if (processedNodes % chunkSize === 0) {
                if (onProgress) {
                    onProgress({ processedNodes, estimatedNodes, styleMode });
                }
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }

        if (onProgress) {
            onProgress({ processedNodes, estimatedNodes, styleMode });
        }

        return { processedNodes, estimatedNodes, styleMode };
    }

    function removeSheetTemplateAreaNewlines(root) {
        const areas = root.querySelectorAll("div.sheet-template-area");
        areas.forEach((area) => {
            const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
            const textNodes = [];
            let node = walker.nextNode();
            while (node) {
                textNodes.push(node);
                node = walker.nextNode();
            }

            textNodes.forEach((textNode) => {
                const raw = textNode.nodeValue || "";
                const normalized = raw.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ");
                if (normalized.trim() === "") {
                    textNode.nodeValue = "";
                    return;
                }
                textNode.nodeValue = normalized.trim();
            });

            // Cleanup empty nodes
            const cleanupWalker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
            let cleanupNode = cleanupWalker.nextNode();
            const removable = [];
            while (cleanupNode) {
                if ((cleanupNode.nodeValue || "").trim() === "") {
                    removable.push(cleanupNode);
                }
                cleanupNode = cleanupWalker.nextNode();
            }
            removable.forEach(n => n.remove());
        });
    }

    function buildLoadedImageUrlMap() {
        const map = new Map();
        const imgs = document.querySelectorAll("img[src]");
        imgs.forEach((img) => {
            const rawSrc = img.getAttribute("src") || "";
            const absSrc = toAbsoluteUrl(rawSrc);
            const current = img.currentSrc || img.src || "";
            if (!absSrc || !current) return;
            map.set(absSrc, current);
        });
        return map;
    }

    async function inlineElementSource(doc, selector, attrName, concurrency = 6) {
        const nodes = Array.from(doc.querySelectorAll(selector));
        const byUrl = new Map();
        for (const node of nodes) {
            const src = node.getAttribute(attrName);
            if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
            const absoluteUrl = toAbsoluteUrl(src);
            if (!absoluteUrl) continue;
            if (!byUrl.has(absoluteUrl)) byUrl.set(absoluteUrl, []);
            byUrl.get(absoluteUrl).push(node);
        }

        const urls = Array.from(byUrl.keys());
        let processed = 0;
        await mapLimit(urls, concurrency, async (absoluteUrl) => {
            try {
                const dataUrl = await fetchDataUrl(absoluteUrl);
                const targets = byUrl.get(absoluteUrl) || [];
                targets.forEach((node) => node.setAttribute(attrName, dataUrl));
            } catch (error) {
                // Keep original source if fetch fails.
            } finally {
                processed += 1;
            }
        });
        return urls.length ? processed / urls.length : 1;
    }

    async function inlineImages(doc) {
        await inlineElementSource(doc, "img[src]", "src", 8);
        await inlineElementSource(doc, 'input[type="image"][src]', "src", 8);
    }

    async function inlineScripts(doc) {
        const { fetchText } = window.Roll20CleanerUtils;
        const createEl = (tag) => (doc.ownerDocument || document).createElement(tag);
        const scripts = Array.from(doc.querySelectorAll("script[src]"));
        for (const script of scripts) {
            const src = script.getAttribute("src");
            const absoluteUrl = toAbsoluteUrl(src);
            if (!absoluteUrl) continue;
            try {
                const jsText = await fetchText(absoluteUrl);
                const inlineScript = createEl("script");
                const type = script.getAttribute("type");
                if (type) inlineScript.setAttribute("type", type);
                inlineScript.setAttribute("data-roll20-cleaner-source", absoluteUrl);
                inlineScript.textContent = jsText;
                script.replaceWith(inlineScript);
            } catch (e) { }
        }
    }

    function removeNonSingleFileAttrs(doc) {
        const nodes = doc.querySelectorAll(
            `[${COLOR_HIDE_ATTR}], [${TEXT_HIDE_ATTR}], [${PREV_DISPLAY_ATTR}]`
        );
        nodes.forEach((node) => {
            node.removeAttribute(COLOR_HIDE_ATTR);
            node.removeAttribute(TEXT_HIDE_ATTR);
            node.removeAttribute(PREV_DISPLAY_ATTR);
        });
    }

    async function absolutizeResourceUrls(clone) {
        const loadedImageUrlMap = buildLoadedImageUrlMap();
        const fixAttr = (selector, attr) => {
            const nodes = clone.querySelectorAll(selector);
            nodes.forEach((node) => {
                const raw = node.getAttribute(attr);
                if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return;
                const absolute = toAbsoluteUrl(raw);
                if (!absolute) return;
                if (attr === "src" && node.tagName === "IMG") {
                    const loaded = loadedImageUrlMap.get(absolute);
                    if (loaded) {
                        node.setAttribute(attr, loaded);
                        return;
                    }
                }
                node.setAttribute(attr, absolute);
            });
        };

        fixAttr("img[src]", "src");
        fixAttr("source[src]", "src");
        fixAttr("a[href]", "href");
        fixAttr("link[href]", "href");

        // Process avatars using the Avatar module
        if (window.Roll20CleanerAvatar && window.Roll20CleanerAvatar.processAvatarsInClone) {
            await window.Roll20CleanerAvatar.processAvatarsInClone(clone, loadedImageUrlMap);
        }
    }

    function stripHeadJsAndCss(clone) {
        const head = clone.querySelector("head");
        if (!head) return;
        const targets = head.querySelectorAll(
            'script, style, link[rel*="stylesheet" i], link[as="style" i]'
        );
        targets.forEach((node) => node.remove());
    }

    function sanitizeFilenameBase(name) {
        const value = (name || "").trim();
        const cleaned = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim();
        return cleaned || "roll20-chat";
    }

    async function copyTextToClipboard(text) {
        const value = typeof text === "string" ? text : String(text ?? "");
        if (!value) {
            throw new Error("복사할 HTML이 비어 있습니다.");
        }

        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            try {
                await navigator.clipboard.writeText(value);
                return { method: "clipboard" };
            } catch (error) {
                // Fall through to execCommand fallback.
            }
        }

        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        textarea.style.left = "-9999px";

        const parent = document.body || document.documentElement;
        parent.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const copied = document.execCommand("copy");
        textarea.remove();

        if (!copied) {
            throw new Error("클립보드 복사를 수행하지 못했습니다.");
        }

        return { method: "execCommand" };
    }

    function downloadHtmlInPage(html, filenameBase) {
        const filename = `${sanitizeFilenameBase(filenameBase)}.html`;
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    window.Roll20CleanerData = {
        ROOT_CLASS,
        MESSAGE_SELECTOR: "div.message",
        HIDDEN_TEXT: "This message has been hidden",
        COLOR_HIDE_ATTR,
        TEXT_HIDE_ATTR,
        PREV_DISPLAY_ATTR
    };

    window.Roll20CleanerDom = window.Roll20CleanerDom || {};
    Object.assign(window.Roll20CleanerDom, {
        processVisibleNodes, // Sync fallback
        processVisibleNodesBatched,
        estimateElementCount,
        removeSheetTemplateAreaNewlines,
        inlineImages,
        inlineScripts,
        removeNonSingleFileAttrs,
        absolutizeResourceUrls,
        stripHeadJsAndCss,
        downloadHtmlInPage,
        copyTextToClipboard,
        sanitizeFilenameBase,
        buildLoadedImageUrlMap // Export this for content.js
    });
    console.log("[Roll20Cleaner] Dom Processor loaded");
})();
