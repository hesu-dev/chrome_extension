// avatar_processor.js

(function () {
    const { toAbsoluteUrl, fetchDataUrl, mapLimit } = window.Roll20CleanerUtils;

    const avatarRedirectCache = new Map();
    const avatarDataUrlCache = new Map();

    function isRoll20AvatarUrl(url) {
        return /\/users\/avatar\/[^/]+\/\d+/i.test(url || "");
    }

    function resolveRedirectViaBackground(url) {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(
                    { type: "RESOLVE_REDIRECT_URL", url },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            resolve("");
                            return;
                        }
                        resolve(response?.ok ? response.finalUrl || "" : "");
                    }
                );
            } catch (e) {
                resolve("");
            }
        });
    }

    function resolveAvatarUrlViaImage(absoluteUrl, timeoutMs = 1500) {
        return new Promise((resolve) => {
            const img = new Image();
            let done = false;
            const finish = (value) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve(value || "");
            };
            img.onload = () => finish(img.currentSrc || img.src || "");
            img.onerror = () => finish("");
            const timer = setTimeout(() => finish(""), timeoutMs);
            img.src = absoluteUrl;
        });
    }

    async function resolveAvatarUrl(url, loadedImageUrlMap) {
        const absolute = toAbsoluteUrl(url);
        if (!absolute) return "";
        const loaded = loadedImageUrlMap?.get(absolute);
        if (loaded && !isRoll20AvatarUrl(loaded)) return loaded;
        if (!isRoll20AvatarUrl(absolute)) return absolute;
        if (avatarRedirectCache.has(absolute)) return avatarRedirectCache.get(absolute);

        try {
            // 1. Try via Background Script (Strongest method, bypasses CORS)
            const backgroundResolved = await resolveRedirectViaBackground(absolute);
            if (backgroundResolved && !isRoll20AvatarUrl(backgroundResolved)) {
                avatarRedirectCache.set(absolute, backgroundResolved);
                return backgroundResolved;
            }

            // Try image loading first. It often exposes currentSrc with redirected final URL.
            const byImageFirst = await resolveAvatarUrlViaImage(absolute, 2500);
            if (byImageFirst && !isRoll20AvatarUrl(byImageFirst)) {
                avatarRedirectCache.set(absolute, byImageFirst);
                return byImageFirst;
            }

            // Manual redirect can expose Location on same-origin redirect responses.
            try {
                const response = await fetch(absolute, {
                    method: "GET",
                    redirect: "manual",
                    credentials: "include",
                });
                const location = response.headers.get("location");
                const resolved = location ? toAbsoluteUrl(location, absolute) : "";
                if (resolved && !isRoll20AvatarUrl(resolved)) {
                    avatarRedirectCache.set(absolute, resolved);
                    return resolved;
                }
            } catch (error) {
                // Continue to next strategy.
            }

            // Follow redirect and read response.url when possible.
            try {
                const response = await fetch(absolute, {
                    method: "GET",
                    redirect: "follow",
                    credentials: "include",
                });
                const resolved = response.url ? toAbsoluteUrl(response.url) : "";
                if (resolved && !isRoll20AvatarUrl(resolved)) {
                    avatarRedirectCache.set(absolute, resolved);
                    return resolved;
                }
            } catch (error) {
                // Continue to next strategy.
            }

            // Last try with a slightly longer image timeout.
            const byImage = await resolveAvatarUrlViaImage(absolute, 4000);
            if (byImage && !isRoll20AvatarUrl(byImage)) {
                avatarRedirectCache.set(absolute, byImage);
                return byImage;
            }
        } catch (error) {
            // Fall through to fallback below.
        }

        avatarRedirectCache.set(absolute, absolute);
        return absolute;
    }

    function fetchUrlAsDataUrlViaBackground(url) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { type: "FETCH_URL_AS_DATA_URL", url },
                (response) => {
                    const dataUrl = response?.ok ? response?.dataUrl || "" : "";
                    resolve(dataUrl);
                }
            );
        });
    }

    async function convertAvatarToDataUrl(url) {
        const absolute = toAbsoluteUrl(url);
        if (!absolute) return "";

        // Background service worker fetch is less constrained by page CORS context.
        const fromBg = await fetchUrlAsDataUrlViaBackground(absolute);
        if (fromBg) return fromBg;

        try {
            return await fetchDataUrl(absolute);
        } catch (error) {
            return "";
        }
    }

    async function resolveAvatarDataUrl(url, loadedImageUrlMap) {
        const absolute = toAbsoluteUrl(url);
        if (!absolute) return "";
        if (avatarDataUrlCache.has(absolute)) return avatarDataUrlCache.get(absolute);

        const resolved = await resolveAvatarUrl(absolute, loadedImageUrlMap);
        const target = resolved || absolute;
        const dataUrl = await convertAvatarToDataUrl(target);
        const fallback = dataUrl || target;
        avatarDataUrlCache.set(absolute, fallback);
        return fallback;
    }

    function normalizeSpeakerName(raw) {
        const text = (raw || "").replace(/\s+/g, " ").trim();
        return text.replace(/:+$/, "").trim();
    }

    function getMessageSpeakerName(messageEl) {
        const byEl = Array.from(messageEl.children).find(
            (child) => child.matches?.("span.by")
        );
        return normalizeSpeakerName(byEl?.textContent || "");
    }

    function getMessageAvatarImg(messageEl) {
        const avatarWrap = Array.from(messageEl.children).find(
            (child) => child.classList?.contains("avatar")
        );
        if (!avatarWrap) return null;
        return avatarWrap.querySelector("img");
    }

    async function collectAvatarMappingsFromRoot(root, loadedImageUrlMap) {
        const messages = root.querySelectorAll("div.message");
        const byPair = new Map();

        // 1. Collect all unique pairs first to avoid redundant DOM reads later
        // and identifying unique URLs to resolve.
        const pendingResolutions = new Set();
        const messageData = [];

        for (const messageEl of messages) {
            const name = getMessageSpeakerName(messageEl);
            const imgEl = getMessageAvatarImg(messageEl);
            if (!name || !imgEl) continue;

            const src = imgEl.getAttribute("src") || "";
            if (!src) continue;

            messageData.push({ name, src });

            // Only add to pending if we haven't resolved it yet and it looks like a Roll20 URL
            const absolute = toAbsoluteUrl(src);
            if (absolute && isRoll20AvatarUrl(absolute) && !avatarRedirectCache.has(absolute)) {
                pendingResolutions.add(absolute);
            }
        }

        // 2. Resolve specific unique URLs in parallel
        const uniqueUrls = Array.from(pendingResolutions);
        if (uniqueUrls.length > 0) {
            await mapLimit(uniqueUrls, 6, async (url) => {
                await resolveAvatarUrl(url, loadedImageUrlMap);
            });
        }

        // 3. Build the result map using cached/resolved values
        for (const { name, src } of messageData) {
            const absolute = toAbsoluteUrl(src);
            // resolveAvatarUrl now just hits cache or returns absolute if not cached (shouldn't happen for the ones we just did)
            // But we call it safe:
            let finalSrc = absolute;
            if (avatarRedirectCache.has(absolute)) {
                finalSrc = avatarRedirectCache.get(absolute);
            } else if (loadedImageUrlMap && loadedImageUrlMap.has(absolute)) {
                finalSrc = loadedImageUrlMap.get(absolute);
            }

            const pairKey = `${name}|||${finalSrc}`;
            if (!byPair.has(pairKey)) {
                byPair.set(pairKey, {
                    id: pairKey,
                    name,
                    avatarUrl: finalSrc,
                    originalUrl: finalSrc,
                });
            }
        }

        return Array.from(byPair.values());
    }

    function applyAvatarReplacementsToClone(clone, replacements) {
        const normalizedReplacements = new Map();
        (Array.isArray(replacements) ? replacements : []).forEach((item) => {
            const name = normalizeSpeakerName(item?.name || "");
            const originalUrl = toAbsoluteUrl(item?.originalUrl || "");
            const newUrl = (item?.newUrl || "").trim();
            if (!name || !originalUrl || !newUrl) return;
            normalizedReplacements.set(`${name}|||${originalUrl}`, newUrl);
        });

        if (!normalizedReplacements.size) return;

        const messageNodes = clone.querySelectorAll("div.message");
        messageNodes.forEach((messageEl) => {
            const name = getMessageSpeakerName(messageEl);
            const imgEl = getMessageAvatarImg(messageEl);
            if (!name || !imgEl) return;
            const currentSrc = toAbsoluteUrl(imgEl.getAttribute("src") || "");
            const replacement = normalizedReplacements.get(`${name}|||${currentSrc}`);
            if (replacement) imgEl.setAttribute("src", replacement);
        });
    }

    async function processAvatarsInClone(clone, loadedImageUrlMap) {
        // Resolve Roll20 avatar redirect URLs to their final absolute URL (e.g., gravatar).
        const avatarImgs = Array.from(clone.querySelectorAll("img[src]"));
        const avatarTargets = avatarImgs.filter((img) =>
            isRoll20AvatarUrl(img.getAttribute("src") || "")
        );
        await mapLimit(avatarTargets, 8, async (img) => {
            const src = img.getAttribute("src") || "";
            const dataOrUrl = await resolveAvatarDataUrl(src, loadedImageUrlMap);
            if (dataOrUrl) img.setAttribute("src", dataOrUrl);
        });

        // One more pass: if a Roll20 avatar URL remains, try resolving from image currentSrc directly.
        await mapLimit(avatarTargets, 4, async (img) => {
            const src = img.getAttribute("src") || "";
            if (!isRoll20AvatarUrl(src)) return;
            const byImage = await resolveAvatarUrlViaImage(src, 3000);
            if (byImage && !isRoll20AvatarUrl(byImage)) {
                img.setAttribute("src", byImage);
            }
        });
    }

    window.Roll20CleanerAvatar = window.Roll20CleanerAvatar || {};
    Object.assign(window.Roll20CleanerAvatar, {
        isRoll20AvatarUrl,
        resolveAvatarUrl,
        resolveAvatarDataUrl,
        collectAvatarMappingsFromRoot,
        applyAvatarReplacementsToClone,
        processAvatarsInClone
    });
    console.log("[Roll20Cleaner] Avatar Processor loaded");
})();
