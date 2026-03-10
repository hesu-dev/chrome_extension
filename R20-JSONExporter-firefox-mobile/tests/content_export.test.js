const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildFirefoxExportPayload,
  createRuntimeMessageHandler,
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

function createChild({ tagName = "span", classNames = [], textContent = "", styleColor = "", imgSrc = "" } = {}) {
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
  textColor = "",
  messageId = "",
} = {}) {
  const children = [];
  if (avatarSrc) {
    children.push(createChild({ tagName: "div", classNames: ["avatar"], imgSrc: avatarSrc }));
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

test("runtime message handler returns export payloads and ping responses", async () => {
  const handler = createRuntimeMessageHandler({
    buildFirefoxExportPayload() {
      return {
        jsonText: '{"schemaVersion":1}',
        filenameBase: "session-a",
      };
    },
  });

  const ping = await handler({ type: "R20_JSON_EXPORTER_FIREFOX_PING" });
  const exportResult = await handler({ type: "R20_JSON_EXPORTER_FIREFOX_EXPORT_JSON" });

  assert.deepEqual(ping, { ok: true });
  assert.deepEqual(exportResult, {
    ok: true,
    jsonText: '{"schemaVersion":1}',
    filenameBase: "session-a",
  });
});
