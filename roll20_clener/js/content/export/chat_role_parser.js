(function () {
  const SYSTEM_CLASS_NAMES = ["desc", "em", "emas"];
  const DICE_TEMPLATE_CLASS_PREFIX = "sheet-rolltemplate-coc";

  function classListHasPrefix(node, prefix) {
    if (!node?.classList || !prefix) return false;
    for (const token of node.classList) {
      if (String(token || "").startsWith(prefix)) return true;
    }
    return false;
  }

  function hasAnyClass(root, classNames) {
    if (!root || !Array.isArray(classNames) || !classNames.length) return false;
    if (root.classList && typeof root.classList.contains === "function") {
      for (const name of classNames) {
        if (root.classList.contains(name)) return true;
      }
    }
    if (!root.querySelector) return false;
    const selector = classNames.map((name) => `.${name}`).join(",");
    return !!root.querySelector(selector);
  }

  function hasClass(root, className) {
    if (!root || !className) return false;
    if (root.classList && typeof root.classList.contains === "function" && root.classList.contains(className)) {
      return true;
    }
    if (!root.querySelector) return false;
    return !!root.querySelector(`.${className}`);
  }

  function isDiceRole(root) {
    if (!root?.querySelector) return false;

    const bySpan = root.querySelector("span.by");
    if (bySpan) {
      const next = bySpan.nextElementSibling;
      if (classListHasPrefix(next, DICE_TEMPLATE_CLASS_PREFIX)) {
        return true;
      }
    }

    return !!root.querySelector(`[class*="${DICE_TEMPLATE_CLASS_PREFIX}"]`);
  }

  function collectRoleFlags(root) {
    return {
      isSystem: hasAnyClass(root, SYSTEM_CLASS_NAMES),
      isSecret: hasClass(root, "private"),
      isDice: isDiceRole(root),
    };
  }

  function resolveRoleFromFlags(flags = {}) {
    let role = "character";
    if (flags.isSystem) role = "system";
    if (flags.isSecret) role = "secret";
    if (flags.isDice) role = "dice";
    return role;
  }

  function resolveRoleForMessage(root) {
    return resolveRoleFromFlags(collectRoleFlags(root));
  }

  const api = {
    collectRoleFlags,
    resolveRoleFromFlags,
    resolveRoleForMessage,
  };

  if (typeof window !== "undefined") {
    window.Roll20CleanerRoleParser = window.Roll20CleanerRoleParser || {};
    Object.assign(window.Roll20CleanerRoleParser, api);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
