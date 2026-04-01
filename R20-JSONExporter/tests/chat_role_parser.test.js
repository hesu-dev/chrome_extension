const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveRoleForMessage } = require("../js/content/export/chat_role_parser.js");

function createClassList(classNames = []) {
  const values = new Set(classNames);
  return {
    contains(name) {
      return values.has(name);
    },
    [Symbol.iterator]: function* iterator() {
      yield* values.values();
    },
  };
}

function createMessage({ classNames = [], hasDiceTemplate = false } = {}) {
  return {
    classList: createClassList(classNames),
    querySelector(selector) {
      if (selector === "span.by") {
        return hasDiceTemplate
          ? {
              nextElementSibling: {
                classList: createClassList(["sheet-rolltemplate-coc"]),
              },
            }
          : null;
      }
      if (selector === `[class*="sheet-rolltemplate-"]`) {
        return hasDiceTemplate ? {} : null;
      }
      return null;
    },
  };
}

test("resolveRoleForMessage treats desc-styled rows as system", () => {
  assert.equal(resolveRoleForMessage(createMessage({ classNames: ["message", "desc"] })), "system");
});

test("resolveRoleForMessage preserves secret and dice roles", () => {
  assert.equal(resolveRoleForMessage(createMessage({ classNames: ["message", "private"] })), "secret");
  assert.equal(resolveRoleForMessage(createMessage({ classNames: ["message"], hasDiceTemplate: true })), "dice");
});
