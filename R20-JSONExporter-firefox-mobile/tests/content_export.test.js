const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildFirefoxExportPayload,
  collectAvatarMappingsFromDoc,
  createRuntimeMessageHandler,
  FIREFOX_EXPORT_JSON_MESSAGE,
  FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE,
  FIREFOX_GET_AVATAR_MAPPINGS_MESSAGE,
  FIREFOX_PING_MESSAGE,
} = require("../js/content/core/content.js");

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

function matchesSelector(tagName, classNames, selector) {
  if (selector === "span") return tagName === "span";
  if (selector === "img") return tagName === "img";
  if (selector === "span.by") return tagName === "span" && classNames.includes("by");
  if (selector === "span.tstamp") return tagName === "span" && classNames.includes("tstamp");
  return false;
}

function createChild({
  tagName = "span",
  classNames = [],
  textContent = "",
  styleColor = "",
  imgSrc = "",
  imgCurrentSrc = "",
} = {}) {
  return {
    textContent,
    classList: createClassList(classNames),
    style: {
      color: styleColor,
    },
    getAttribute(name) {
      if (name === "style" && styleColor) return `color: ${styleColor}`;
      if (name === "src" && imgSrc) return imgSrc;
      return "";
    },
    matches(selector) {
      return matchesSelector(tagName, classNames, selector);
    },
    querySelector(selector) {
      if (selector === "img" && imgSrc) {
        return {
          currentSrc: imgCurrentSrc || imgSrc,
          src: imgCurrentSrc || imgSrc,
          getAttribute(name) {
            return name === "src" ? imgSrc : "";
          },
        };
      }
      return null;
    },
  };
}

function createMessage({
  classNames = ["message"],
  speaker = "",
  timestamp = "",
  text = "",
  html = "",
  avatarSrc = "",
  avatarCurrentSrc = "",
  textColor = "",
  messageId = "",
} = {}) {
  const children = [];
  if (avatarSrc) {
    children.push(
      createChild({
        tagName: "div",
        classNames: ["avatar"],
        imgSrc: avatarSrc,
        imgCurrentSrc: avatarCurrentSrc,
      })
    );
  }
  if (speaker) {
    children.push(createChild({ classNames: ["by"], textContent: speaker }));
  }
  if (timestamp) {
    children.push(createChild({ classNames: ["tstamp"], textContent: timestamp }));
  }
  children.push(createChild({ textContent: text, styleColor: textColor }));

  return {
    id: messageId,
    innerHTML: html || text,
    textContent: `${speaker} ${timestamp} ${text}`.trim(),
    style: {},
    classList: createClassList(classNames),
    children,
    cloneNode() {
      return {
        innerHTML: html || text,
        textContent: text,
        querySelectorAll() {
          return [];
        },
        querySelector() {
          return null;
        },
      };
    },
    getAttribute(name) {
      if (name === "data-messageid" || name === "id") return messageId;
      return "";
    },
    querySelector(selector) {
      if (selector === "span.by") {
        return children.find((child) => child.matches("span.by")) || null;
      }
      if (selector === `[class*="sheet-rolltemplate-"]`) {
        return String(html || "").includes("sheet-rolltemplate-") ? {} : null;
      }
      return null;
    },
  };
}

function createDocument({ title = "Roll20 Chat", hrefs = [], messages = [] } = {}) {
  return {
    title,
    baseURI: "https://app.roll20.net/editor/",
    defaultView: {
      getComputedStyle(node) {
        return {
          display: node.style?.display || "",
        };
      },
    },
    querySelectorAll(selector) {
      if (selector === 'a[href*="/campaigns/details/"]') {
        return hrefs.map((href) => ({
          getAttribute(name) {
            return name === "href" ? href : "";
          },
        }));
      }
      if (selector === "div.message") {
        return messages;
      }
      return [];
    },
  };
}

test("buildFirefoxExportPayload serializes the current DOM into schema v1 json", () => {
  const visibleMessage = createMessage({
    classNames: ["message"],
    speaker: " KP: ",
    timestamp: "8:15 PM",
    text: " 테스트   메시지 ",
    textColor: "#ff00aa",
    avatarSrc: "https://example.com/avatar.png",
    messageId: "msg-1",
  });
  const hiddenPlaceholder = createMessage({
    classNames: ["message", "general"],
    text: "This message has been hidden by the GM.",
    messageId: "msg-hidden",
  });
  const doc = createDocument({
    hrefs: ["https://app.roll20.net/campaigns/details/12345/%EC%84%B8%EC%85%98A"],
    messages: [visibleMessage, hiddenPlaceholder],
  });

  const payload = buildFirefoxExportPayload({ doc });
  const parsed = JSON.parse(payload.jsonText);

  assert.equal(payload.filenameBase, "세션A");
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.ebookView.titlePage.scenarioTitle, "세션A");
  assert.equal(parsed.lines.length, 1);
  assert.equal(parsed.lines[0].id, "msg-1");
  assert.equal(parsed.lines[0].speaker, "KP");
  assert.equal(parsed.lines[0].role, "character");
  assert.equal(parsed.lines[0].timestamp, "오후 8:15");
  assert.equal(parsed.lines[0].textColor, "color: #ff00aa");
  assert.equal(parsed.lines[0].text.trim(), "테스트 메시지");
  assert.equal(
    parsed.lines[0].input.speakerImages.avatar.url,
    "https://example.com/avatar.png"
  );
});

test("collectAvatarMappingsFromDoc preserves original and redirected avatar urls", () => {
  const doc = createDocument({
    messages: [
      createMessage({
        speaker: "KP",
        avatarSrc: "https://app.roll20.net/users/avatar/abc/123",
        avatarCurrentSrc: "https://cdn.example.com/avatar-final.png",
      }),
    ],
  });

  const mappings = collectAvatarMappingsFromDoc(doc);

  assert.deepEqual(mappings, [
    {
      id: "KP|||https://app.roll20.net/users/avatar/abc/123|||https://cdn.example.com/avatar-final.png",
      name: "KP",
      avatarUrl: "https://cdn.example.com/avatar-final.png",
      originalUrl: "https://app.roll20.net/users/avatar/abc/123",
    },
  ]);
});

test("collectAvatarMappingsFromDoc keeps distinct variants for the same speaker and original url", () => {
  const doc = createDocument({
    messages: [
      createMessage({
        speaker: "KP",
        avatarSrc: "https://app.roll20.net/users/avatar/abc/123",
        avatarCurrentSrc: "https://cdn.example.com/avatar-a.png",
      }),
      createMessage({
        speaker: "KP",
        avatarSrc: "https://app.roll20.net/users/avatar/abc/123",
        avatarCurrentSrc: "https://cdn.example.com/avatar-b.png",
      }),
    ],
  });

  const mappings = collectAvatarMappingsFromDoc(doc);

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

test("buildFirefoxExportPayload direct export keeps per-line redirected avatars without metadata output", () => {
  const doc = createDocument({
    messages: [
      createMessage({
        speaker: "KP",
        timestamp: "8:15 PM",
        text: "테스트",
        avatarSrc: "https://app.roll20.net/users/avatar/abc/123",
        avatarCurrentSrc: "https://cdn.example.com/avatar-a.png",
        messageId: "msg-1",
      }),
      createMessage({
        speaker: "KP",
        timestamp: "8:16 PM",
        text: "다음",
        avatarSrc: "https://app.roll20.net/users/avatar/abc/123",
        avatarCurrentSrc: "https://cdn.example.com/avatar-b.png",
        messageId: "msg-1b",
      }),
    ],
  });

  const payload = buildFirefoxExportPayload({
    doc,
    includeAvatarLinkMeta: true,
  });
  const parsed = JSON.parse(payload.jsonText);

  assert.equal(
    parsed.lines[0].input.speakerImages.avatar.url,
    "https://cdn.example.com/avatar-a.png"
  );
  assert.equal(
    parsed.lines[1].input.speakerImages.avatar.url,
    "https://cdn.example.com/avatar-b.png"
  );
  assert.equal(parsed.lines[0].input.avatarLinkMeta, undefined);
  assert.equal(parsed.lines[1].input.avatarLinkMeta, undefined);
});

test("buildFirefoxExportPayload mapped export keeps user replacement", () => {
  const doc = createDocument({
    messages: [
      createMessage({
        speaker: "KP",
        text: "테스트",
        avatarSrc: "https://app.roll20.net/users/avatar/abc/123",
        avatarCurrentSrc: "https://cdn.example.com/avatar-final.png",
        messageId: "msg-2",
      }),
    ],
  });

  const payload = buildFirefoxExportPayload({
    doc,
    replacements: [
      {
        id: "KP|||https://app.roll20.net/users/avatar/abc/123|||https://cdn.example.com/avatar-final.png",
        name: "KP",
        originalUrl: "https://app.roll20.net/users/avatar/abc/123",
        avatarUrl: "https://cdn.example.com/avatar-final.png",
        newUrl: "https://images.example.com/custom-avatar.png",
      },
    ],
  });
  const parsed = JSON.parse(payload.jsonText);

  assert.equal(
    parsed.lines[0].input.speakerImages.avatar.url,
    "https://images.example.com/custom-avatar.png"
  );
  assert.equal(parsed.lines[0].input.avatarLinkMeta, undefined);
});

test("runtime message handler returns export payloads, mappings, and ping responses", async () => {
  const handler = createRuntimeMessageHandler({
    buildFirefoxExportPayload() {
      return {
        jsonText: '{"schemaVersion":1}',
        filenameBase: "session-a",
      };
    },
    collectAvatarMappingsFromDoc() {
      return [{ id: "map-1" }];
    },
  });

  const ping = await handler({ type: FIREFOX_PING_MESSAGE });
  const mappings = await handler({ type: FIREFOX_GET_AVATAR_MAPPINGS_MESSAGE });
  const exportResult = await handler({ type: FIREFOX_EXPORT_JSON_MESSAGE });
  const exportMappedResult = await handler({
    type: FIREFOX_EXPORT_JSON_WITH_AVATAR_REPLACEMENTS_MESSAGE,
    replacements: [{ id: "map-1" }],
  });

  assert.deepEqual(ping, { ok: true });
  assert.deepEqual(mappings, {
    ok: true,
    mappings: [{ id: "map-1" }],
  });
  assert.deepEqual(exportResult, {
    ok: true,
    jsonText: '{"schemaVersion":1}',
    filenameBase: "session-a",
  });
  assert.deepEqual(exportMappedResult, {
    ok: true,
    jsonText: '{"schemaVersion":1}',
    filenameBase: "session-a",
  });
});
