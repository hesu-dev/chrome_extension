(function () {
  function stripHeadCssAndJs(html) {
    const source = String(html || "");
    return source.replace(/<head\b([^>]*)>([\s\S]*?)<\/head>/i, (full, attrs, inner) => {
      const cleaned = String(inner || "")
        .replace(/<script\b[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[\s\S]*?<\/style>/gi, "")
        .replace(
          /<link\b[^>]*(?:rel\s*=\s*["'][^"']*stylesheet[^"']*["']|as\s*=\s*["']style["'])[^>]*\/?>/gi,
          ""
        );
      return `<head${attrs}>${cleaned}</head>`;
    });
  }

  function stripArchiveToolbarAndHeader(html) {
    let output = String(html || "");

    output = output.replace(/<script\b[\s\S]*?<\/script>/gi, "");
    output = output.replace(
      /<div\b[^>]*>[\s\S]*?id=["'](?:paginateToggle|whisperToggle|rollResultsToggle)["'][\s\S]*?<\/div>/gi,
      ""
    );
    output = output.replace(
      /<div\b[^>]*style=["'][^"']*margin\s*:\s*10px[^"']*["'][^>]*>\s*<ul\b[^>]*class=["'][^"']*\bpagination\b[^"']*["'][\s\S]*?<\/ul>\s*<\/div>/gi,
      ""
    );
    output = output.replace(/<ul\b[^>]*class=["'][^"']*\bpagination\b[^"']*["'][\s\S]*?<\/ul>/gi, "");
    output = output.replace(/<button\b[^>]*id=["'](?:paginateToggle|whisperToggle|rollResultsToggle)["'][\s\S]*?<\/button>/gi, "");
    output = output.replace(
      /<form\b[^>]*action=["'][^"']*\/campaigns\/chatarchive\/[^"']*["'][\s\S]*?<\/form>/gi,
      ""
    );
    output = output.replace(
      /<form\b[^>]*>[\s\S]*?id=["'](?:pagenumber|onepage|hidewhispers|hiderollresults)["'][\s\S]*?<\/form>/gi,
      ""
    );
    output = output.replace(
      /<div\b[^>]*id=["']dicerollerdialog["'][\s\S]*?<\/small>\s*<\/div>/gi,
      ""
    );
    output = output.replace(/<div\b[^>]*id=["']monica-content-root["'][\s\S]*?<\/div>/gi, "");

    output = output.replace(/<h1\b[^>]*class=["'][^"']*\bpull-left\b[^"']*["'][\s\S]*?<\/h1>/gi, "");
    output = output.replace(/<a\b[^>]*href=["'][^"']*\/campaigns\/details\/[^"']*["'][\s\S]*?<\/a>/gi, "");
    output = output.replace(/<div\b[^>]*class=["'][^"']*\bclear\b[^"']*["'][^>]*>\s*<\/div>/gi, "");

    output = output.replace(
      /<span\b[^>]*title=["'][^"']*(?:Shows Chat Archives on multiple pages\.|Whispers include|GM Rolls include)[^"']*["'][\s\S]*?<\/span>/gi,
      ""
    );

    return output;
  }

  function injectInlineCssIntoHead(html, inlineCssText) {
    const cssText = String(inlineCssText || "").trim();
    if (!cssText) return String(html || "");

    const safeCss = cssText.replace(/<\/style/gi, "<\\/style");
    const styleBlock = `<style data-roll20-cleaner-inline="archive-base-css">${safeCss}</style>`;
    const source = String(html || "");

    if (/<head\b[^>]*>/i.test(source)) {
      return source.replace(/<head\b([^>]*)>/i, (full, attrs) => `<head${attrs}>${styleBlock}`);
    }

    if (/<body\b[^>]*>/i.test(source)) {
      return source.replace(/<body\b/i, `<head>${styleBlock}</head><body`);
    }

    return `<head>${styleBlock}</head>${source}`;
  }

  function sanitizeArchiveExportHtml(html, options = {}) {
    const stripped = stripArchiveToolbarAndHeader(stripHeadCssAndJs(html));
    return injectInlineCssIntoHead(stripped, options?.inlineCssText);
  }

  const api = {
    sanitizeArchiveExportHtml,
    stripHeadCssAndJs,
    stripArchiveToolbarAndHeader,
    injectInlineCssIntoHead,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof window !== "undefined") {
    window.Roll20CleanerArchiveHtml = window.Roll20CleanerArchiveHtml || {};
    Object.assign(window.Roll20CleanerArchiveHtml, api);
  }
})();
