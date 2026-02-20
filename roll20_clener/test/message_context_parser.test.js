const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeSpeakerName,
  resolveMessageContext,
  shouldInheritMessageContext,
} = require("../js/content/export/message_context_parser.js");

test("normalizeSpeakerName trims spaces and trailing colon", () => {
  assert.equal(normalizeSpeakerName("  GM:  "), "GM");
});

test("normalizeSpeakerName preserves pure-colon speaker markers", () => {
  assert.equal(normalizeSpeakerName("::"), "::");
  assert.equal(normalizeSpeakerName(" ::: "), ":::");
});

test("resolveMessageContext keeps current speaker/avatar when present", () => {
  const result = resolveMessageContext(
    { speaker: "GM:", avatarSrc: "https://example.com/a.png" },
    { speaker: "OLD", avatarSrc: "https://example.com/old.png" }
  );

  assert.deepEqual(result, {
    speaker: "GM",
    avatarSrc: "https://example.com/a.png",
    speakerImageUrl: "https://example.com/a.png",
  });
});

test("resolveMessageContext inherits previous speaker/avatar when omitted", () => {
  const result = resolveMessageContext(
    { speaker: "", avatarSrc: "" },
    { speaker: "GM", avatarSrc: "https://example.com/a.png" }
  );

  assert.deepEqual(result, {
    speaker: "GM",
    avatarSrc: "https://example.com/a.png",
    speakerImageUrl: "https://example.com/a.png",
  });
});

test("resolveMessageContext prefers previously replaced speakerImageUrl", () => {
  const result = resolveMessageContext(
    { speaker: "", avatarSrc: "", speakerImageUrl: "" },
    {
      speaker: "GM",
      avatarSrc: "https://roll20.net/original.png",
      speakerImageUrl: "https://cdn.example.com/replaced.png",
    }
  );

  assert.deepEqual(result, {
    speaker: "GM",
    avatarSrc: "https://roll20.net/original.png",
    speakerImageUrl: "https://cdn.example.com/replaced.png",
  });
});

test("shouldInheritMessageContext returns true for system role", () => {
  assert.equal(shouldInheritMessageContext("system"), true);
  assert.equal(shouldInheritMessageContext("dice"), true);
  assert.equal(shouldInheritMessageContext("character"), true);
  assert.equal(shouldInheritMessageContext("system", { hasDescStyle: true }), false);
  assert.equal(shouldInheritMessageContext("character", { hasAvatar: true }), false);
  assert.equal(shouldInheritMessageContext("system", { hasEmoteStyle: true }), false);
});
