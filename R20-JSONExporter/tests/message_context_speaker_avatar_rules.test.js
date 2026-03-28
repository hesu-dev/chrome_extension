const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveMessageContext } = require("../js/content/export/message_context_parser.js");

test("resolveMessageContext inherits avatar data when the current speaker is blank", () => {
  const resolved = resolveMessageContext(
    {
      speaker: "",
      avatarSrc: "",
      speakerImageUrl: "",
      timestamp: "",
    },
    {
      speaker: "KP",
      avatarSrc: "https://example.com/original.png",
      speakerImageUrl: "https://example.com/final.png",
      timestamp: "8:15 PM",
    }
  );

  assert.equal(resolved.speaker, "KP");
  assert.equal(resolved.avatarSrc, "https://example.com/original.png");
  assert.equal(resolved.speakerImageUrl, "https://example.com/final.png");
});

test("resolveMessageContext inherits avatar data when the current speaker matches the previous speaker", () => {
  const resolved = resolveMessageContext(
    {
      speaker: "KP:",
      avatarSrc: "",
      speakerImageUrl: "",
      timestamp: "8:16 PM",
    },
    {
      speaker: "KP",
      avatarSrc: "https://example.com/original.png",
      speakerImageUrl: "https://example.com/final.png",
      timestamp: "8:15 PM",
    }
  );

  assert.equal(resolved.speaker, "KP");
  assert.equal(resolved.avatarSrc, "https://example.com/original.png");
  assert.equal(resolved.speakerImageUrl, "https://example.com/final.png");
});

test("resolveMessageContext clears avatar inheritance when the speaker changes", () => {
  const resolved = resolveMessageContext(
    {
      speaker: "PL",
      avatarSrc: "",
      speakerImageUrl: "",
      timestamp: "8:16 PM",
    },
    {
      speaker: "KP",
      avatarSrc: "https://example.com/original.png",
      speakerImageUrl: "https://example.com/final.png",
      timestamp: "8:15 PM",
    }
  );

  assert.equal(resolved.speaker, "PL");
  assert.equal(resolved.avatarSrc, "");
  assert.equal(resolved.speakerImageUrl, "");
});
