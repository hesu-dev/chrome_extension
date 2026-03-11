const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAvatarLinkMetaIndex,
  resolveAvatarLinkMeta,
} = require("../js/content/export/avatar_link_meta.js");

test("resolveAvatarLinkMeta preserves original and redirected avatar urls", () => {
  const index = createAvatarLinkMetaIndex([
    {
      name: "Alice",
      originalUrl: "https://app.roll20.net/users/avatar/alice/123",
      avatarUrl: "https://secure.gravatar.com/avatar/alice-final",
    },
  ]);

  const resolved = resolveAvatarLinkMeta(
    {
      speaker: "Alice",
      currentSrc: "https://app.roll20.net/users/avatar/alice/123",
    },
    index
  );

  assert.deepEqual(resolved, {
    originalUrl: "https://app.roll20.net/users/avatar/alice/123",
    redirectedUrl: "https://secure.gravatar.com/avatar/alice-final",
    effectiveUrl: "https://secure.gravatar.com/avatar/alice-final",
  });
});
