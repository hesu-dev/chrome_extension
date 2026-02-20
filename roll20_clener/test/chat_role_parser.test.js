const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveRoleForMessage } = require("../js/content/export/chat_role_parser.js");

function buildMockMessage(innerHtml) {
  const html = String(innerHtml || "");
  return {
    querySelector(selector) {
      if (selector === "span.by") return null;
      const classContains = String(selector || "").match(/^\[class\*="([^"]+)"\]$/);
      if (classContains?.[1]) {
        const needle = classContains[1];
        const pattern = new RegExp(`class="[^"]*${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"]*"`, "i");
        return pattern.test(html) ? {} : null;
      }
      return null;
    },
    classList: {
      contains() {
        return false;
      },
      [Symbol.iterator]: function* () {},
    },
  };
}

test("resolveRoleForMessage treats coc templates as dice", () => {
  const root = buildMockMessage('<div class="sheet-rolltemplate-coc-1"></div>');
  assert.equal(resolveRoleForMessage(root), "dice");
});

test("resolveRoleForMessage treats insane templates as dice", () => {
  const root = buildMockMessage('<div class="sheet-rolltemplate-Insane"></div>');
  assert.equal(resolveRoleForMessage(root), "dice");
});

test("resolveRoleForMessage treats InsDice templates as dice", () => {
  const root = buildMockMessage('<div class="sheet-rolltemplate-InsDice"></div>');
  assert.equal(resolveRoleForMessage(root), "dice");
});
