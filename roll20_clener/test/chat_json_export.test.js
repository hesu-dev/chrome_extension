const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeMessageText,
  resolveMessageId,
  buildChatJsonEntry,
} = require("../chat_json_export.js");

test("normalizeMessageText collapses spaces and trims", () => {
  assert.equal(normalizeMessageText("  hello   world \n test "), "hello world test");
  assert.equal(normalizeMessageText(""), "");
});

test("resolveMessageId prefers explicit id and falls back to index", () => {
  assert.equal(resolveMessageId({ id: "abc" }, 3), "abc");
  assert.equal(resolveMessageId({ id: "" }, 3), "4");
});

test("buildChatJsonEntry maps required keys", () => {
  const row = buildChatJsonEntry({
    id: "12",
    speaker: "Alice",
    role: "character",
    text: "Hi",
    imageUrl: null,
    speakerImageUrl: "https://example.com/a.png",
    nameColor: null,
  });

  assert.deepEqual(row, {
    id: "12",
    speaker: "Alice",
    role: "character",
    text: "Hi",
    imageUrl: null,
    speakerImageUrl: "https://example.com/a.png",
    nameColor: null,
  });
});
