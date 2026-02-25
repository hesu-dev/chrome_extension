const test = require("node:test");
const assert = require("node:assert/strict");

const { buildChatJsonEntry } = require("../js/content/export/chat_json_export.js");

test("buildChatJsonEntry maps speakerImageUrl to input.speakerImages.avatar.url", () => {
  const entry = buildChatJsonEntry({
    id: "1",
    speaker: "KP",
    role: "character",
    text: "hello",
    speakerImageUrl: "https://imgur.com/abc.png",
  });

  assert.deepEqual(entry.input.speakerImages, {
    avatar: {
      url: "https://imgur.com/abc.png",
    },
  });
  assert.equal("speakerImageUrl" in entry.input, false);
});

test("buildChatJsonEntry omits speakerImages when speakerImageUrl is empty", () => {
  const entry = buildChatJsonEntry({
    id: "1",
    speaker: "KP",
    role: "character",
    text: "hello",
    speakerImageUrl: "",
  });

  assert.equal("speakerImages" in entry.input, false);
});
