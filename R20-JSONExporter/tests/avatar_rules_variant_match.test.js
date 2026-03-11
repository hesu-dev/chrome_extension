const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildReplacementMaps,
  findReplacementForMessage,
} = require("../js/content/avatar/avatar_rules.js");

test("avatar replacement matching keeps distinct variants for the same speaker and original url", () => {
  const maps = buildReplacementMaps([
    {
      id: "KP|||https://app.roll20.net/users/avatar/abc/123|||https://cdn.example.com/a.png",
      name: "KP",
      originalUrl: "https://app.roll20.net/users/avatar/abc/123",
      avatarUrl: "https://cdn.example.com/a.png",
      newUrl: "https://images.example.com/custom-a.png",
    },
    {
      id: "KP|||https://app.roll20.net/users/avatar/abc/123|||https://cdn.example.com/b.png",
      name: "KP",
      originalUrl: "https://app.roll20.net/users/avatar/abc/123",
      avatarUrl: "https://cdn.example.com/b.png",
      newUrl: "https://images.example.com/custom-b.png",
    },
  ]);

  assert.equal(
    findReplacementForMessage({
      name: "KP",
      currentSrc: "https://app.roll20.net/users/avatar/abc/123",
      currentAvatarUrl: "https://cdn.example.com/a.png",
    }, maps),
    "https://images.example.com/custom-a.png"
  );
  assert.equal(
    findReplacementForMessage({
      name: "KP",
      currentSrc: "https://app.roll20.net/users/avatar/abc/123",
      currentAvatarUrl: "https://cdn.example.com/b.png",
    }, maps),
    "https://images.example.com/custom-b.png"
  );
});
