const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const avatarRules = require("../js/content/avatar/avatar_rules.js");

function loadAvatarProcessor() {
  const modulePath = path.join(
    __dirname,
    "..",
    "js",
    "content",
    "avatar",
    "avatar_processor.js"
  );
  delete require.cache[require.resolve(modulePath)];

  global.window = {
    Roll20CleanerUtils: {
      toAbsoluteUrl(value) {
        return String(value || "").trim();
      },
      fetchDataUrl: async () => "",
      async mapLimit(items, _limit, iteratee) {
        const results = [];
        for (const item of items) {
          results.push(await iteratee(item));
        }
        return results;
      },
    },
    Roll20CleanerAvatarRules: avatarRules,
  };
  global.chrome = {
    runtime: {
      sendMessage(_payload, callback) {
        callback?.({ ok: false });
      },
      lastError: null,
    },
  };

  return require(modulePath);
}

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

function createAvatarImage({ src, currentSrc }) {
  let currentValue = src;
  return {
    currentSrc: currentSrc || src,
    src: src || "",
    getAttribute(name) {
      return name === "src" ? currentValue : "";
    },
    setAttribute(name, value) {
      if (name === "src") {
        currentValue = String(value || "");
        this.src = currentValue;
      }
    },
  };
}

function createMessage({ speaker, src, currentSrc }) {
  const image = createAvatarImage({ src, currentSrc });
  return {
    children: [
      {
        classList: createClassList(["avatar"]),
        querySelector(selector) {
          return selector === "img" ? image : null;
        },
      },
      {
        classList: createClassList(["by"]),
        textContent: speaker,
        matches(selector) {
          return selector === "span.by";
        },
      },
    ],
    image,
  };
}

test("collectAvatarMappingsFromRoot keeps separate rows for the same speaker and original url when currentSrc differs", async () => {
  const { collectAvatarMappingsFromRoot } = loadAvatarProcessor();
  const first = createMessage({
    speaker: "KP",
    src: "https://app.roll20.net/users/avatar/abc/123",
    currentSrc: "https://cdn.example.com/avatar-a.png",
  });
  const second = createMessage({
    speaker: "KP",
    src: "https://app.roll20.net/users/avatar/abc/123",
    currentSrc: "https://cdn.example.com/avatar-b.png",
  });

  const mappings = await collectAvatarMappingsFromRoot({
    querySelectorAll(selector) {
      return selector === "div.message" ? [first, second] : [];
    },
  });

  assert.deepEqual(mappings, [
    {
      id: "KP|||https://app.roll20.net/users/avatar/abc/123|||https://cdn.example.com/avatar-a.png",
      name: "KP",
      avatarUrl: "https://cdn.example.com/avatar-a.png",
      originalUrl: "https://app.roll20.net/users/avatar/abc/123",
    },
    {
      id: "KP|||https://app.roll20.net/users/avatar/abc/123|||https://cdn.example.com/avatar-b.png",
      name: "KP",
      avatarUrl: "https://cdn.example.com/avatar-b.png",
      originalUrl: "https://app.roll20.net/users/avatar/abc/123",
    },
  ]);
});

test("applyAvatarReplacementsToClone matches replacements by current avatar variant", () => {
  const { applyAvatarReplacementsToClone } = loadAvatarProcessor();
  const first = createMessage({
    speaker: "KP",
    src: "https://app.roll20.net/users/avatar/abc/123",
    currentSrc: "https://cdn.example.com/avatar-a.png",
  });
  const second = createMessage({
    speaker: "KP",
    src: "https://app.roll20.net/users/avatar/abc/123",
    currentSrc: "https://cdn.example.com/avatar-b.png",
  });

  applyAvatarReplacementsToClone(
    {
      querySelectorAll(selector) {
        return selector === "div.message" ? [first, second] : [];
      },
    },
    [
      {
        id: "KP|||https://app.roll20.net/users/avatar/abc/123|||https://cdn.example.com/avatar-a.png",
        name: "KP",
        originalUrl: "https://app.roll20.net/users/avatar/abc/123",
        avatarUrl: "https://cdn.example.com/avatar-a.png",
        newUrl: "https://images.example.com/custom-a.png",
      },
      {
        id: "KP|||https://app.roll20.net/users/avatar/abc/123|||https://cdn.example.com/avatar-b.png",
        name: "KP",
        originalUrl: "https://app.roll20.net/users/avatar/abc/123",
        avatarUrl: "https://cdn.example.com/avatar-b.png",
        newUrl: "https://images.example.com/custom-b.png",
      },
    ]
  );

  assert.equal(first.image.src, "https://images.example.com/custom-a.png");
  assert.equal(second.image.src, "https://images.example.com/custom-b.png");
});
