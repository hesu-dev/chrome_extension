const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveRoleFromFlags,
  resolveRoleForMessage,
} = require("../chat_role_parser.js");

test("resolveRoleFromFlags default is character", () => {
  assert.equal(resolveRoleFromFlags({}), "character");
});

test("resolveRoleFromFlags sets system when desc/em/emas exists", () => {
  assert.equal(resolveRoleFromFlags({ isSystem: true }), "system");
});

test("resolveRoleFromFlags sets secret when private exists", () => {
  assert.equal(resolveRoleFromFlags({ isSystem: true, isSecret: true }), "secret");
});

test("resolveRoleFromFlags sets dice when rolltemplate follows by span", () => {
  assert.equal(
    resolveRoleFromFlags({ isSystem: true, isSecret: true, isDice: true }),
    "dice"
  );
});

test("resolveRoleForMessage returns dice for coc template class even without by span", () => {
  const root = {
    querySelector: (selector) => {
      if (selector === '[class*="sheet-rolltemplate-coc"]') return {};
      return null;
    },
    classList: [],
  };
  assert.equal(resolveRoleForMessage(root), "dice");
});
