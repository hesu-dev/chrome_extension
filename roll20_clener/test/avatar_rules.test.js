const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildReplacementMaps,
  findReplacementForMessage,
} = require("../avatar_rules.js");

function toAbsoluteUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `https://app.roll20.net${url}`;
  return `https://app.roll20.net/${url}`;
}

function normalizeSpeakerName(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim().replace(/:+$/, "").trim();
}

test("buildReplacementMaps keeps only /users/avatar/ rules and normalizes absolute URLs", () => {
  const maps = buildReplacementMaps(
    [
      {
        name: "Alice",
        originalUrl: "/users/avatar/3307646/30",
        newUrl: "https://files.d20.io/images/new-thumb.png?size=30",
      },
      {
        name: "Bob",
        originalUrl: "https://example.com/not-avatar.png",
        newUrl: "https://files.d20.io/images/other.png",
      },
    ],
    { toAbsoluteUrl, normalizeSpeakerName }
  );

  assert.equal(maps.byPair.size, 1);
  assert.equal(maps.byOriginal.size, 1);
  assert.equal(
    maps.byPair.get("Alice|||https://app.roll20.net/users/avatar/3307646/30"),
    "https://files.d20.io/images/new-thumb.png?size=30"
  );
});

test("findReplacementForMessage prefers name+original pair, then original-only fallback", () => {
  const maps = buildReplacementMaps(
    [
      {
        name: "Alice",
        originalUrl: "/users/avatar/3307646/30",
        newUrl: "https://files.d20.io/images/alice.png",
      },
      {
        name: "Carol",
        originalUrl: "/users/avatar/3307646/30",
        newUrl: "https://files.d20.io/images/shared.png",
      },
    ],
    { toAbsoluteUrl, normalizeSpeakerName }
  );

  const pair = findReplacementForMessage(
    {
      name: "Alice",
      currentSrc: "/users/avatar/3307646/30",
    },
    maps,
    { toAbsoluteUrl, normalizeSpeakerName }
  );
  assert.equal(pair, "https://files.d20.io/images/alice.png");

  const fallback = findReplacementForMessage(
    {
      name: "Unknown",
      currentSrc: "/users/avatar/3307646/30",
    },
    maps,
    { toAbsoluteUrl, normalizeSpeakerName }
  );
  assert.equal(fallback, "https://files.d20.io/images/alice.png");
});

test("buildReplacementMaps ignores non-http image replacement URLs", () => {
  const maps = buildReplacementMaps(
    [
      {
        name: "Alice",
        originalUrl: "/users/avatar/3307646/30",
        newUrl: "javascript:alert(1)",
      },
    ],
    { toAbsoluteUrl, normalizeSpeakerName }
  );

  assert.equal(maps.byPair.size, 0);
  assert.equal(maps.byOriginal.size, 0);
});
