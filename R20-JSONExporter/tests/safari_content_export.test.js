const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const safariContentPath = path.join(
  __dirname,
  "..",
  "..",
  "R20-JSONExporter-safari-app",
  "ios",
  "Roll20SafariExtension",
  "Resources",
  "js",
  "content.js"
);

const {
  SAFARI_MEASURE_MESSAGE,
  SAFARI_EXPORT_JSON_MESSAGE,
  measureSafariExport,
  buildSafariExportPayload,
  createRuntimeMessageHandler,
} = require(safariContentPath);

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
    children: [],
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
        children: [],
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

test("measureSafariExport reports current DOM counts and resolved filename", () => {
  const doc = createDocument({
    hrefs: ["https://app.roll20.net/campaigns/details/12345/%EC%84%B8%EC%85%98A"],
    messages: [
      createMessage({
        speaker: "KP:",
        timestamp: "8:15 PM",
        text: "테스트 메시지",
        messageId: "msg-1",
      }),
      createMessage({
        speaker: "PL:",
        timestamp: "8:16 PM",
        text: "두번째 메시지",
        messageId: "msg-2",
      }),
    ],
  });

  const metrics = measureSafariExport({ doc });

  assert.equal(metrics.messageCount, 2);
  assert.equal(metrics.filenameBase, "세션A");
  assert.equal(metrics.titleCandidate, "세션A");
  assert.ok(metrics.domNodeEstimate >= 8);
});

test("buildSafariExportPayload serializes the current DOM into schema v1 json", () => {
  const visibleMessage = createMessage({
    classNames: ["message"],
    speaker: " KP: ",
    timestamp: "8:15 PM",
    text: " 테스트   메시지 ",
    textColor: "#ff00aa",
    avatarSrc: "https://example.com/avatar.png",
    messageId: "msg-1",
  });
  const doc = createDocument({
    hrefs: ["https://app.roll20.net/campaigns/details/12345/%EC%84%B8%EC%85%98A"],
    messages: [visibleMessage],
  });

  const payload = buildSafariExportPayload({ doc });
  const parsed = JSON.parse(payload.jsonText);

  assert.equal(payload.filenameBase, "세션A");
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.ebookView.titlePage.scenarioTitle, "세션A");
  assert.equal(parsed.lines.length, 1);
  assert.equal(parsed.lines[0].id, "msg-1");
  assert.equal(parsed.lines[0].speaker, "KP");
  assert.equal(parsed.lines[0].role, "character");
  assert.equal(parsed.lines[0].timestamp, "오후 8:15");
  assert.equal(parsed.lines[0].textColor, "#ff00aa");
  assert.equal(parsed.lines[0].text.trim(), "테스트 메시지");
  assert.equal(
    parsed.lines[0].input.speakerImages.avatar.url,
    "https://example.com/avatar.png"
  );
});

test("runtime message handler returns measurement and export payloads", async () => {
  const handler = createRuntimeMessageHandler({
    measureSafariExport() {
      return {
        messageCount: 24,
        domNodeEstimate: 120,
        filenameBase: "session-a",
        titleCandidate: "session-a",
      };
    },
    buildSafariExportPayload() {
      return {
        jsonText: '{"schemaVersion":1}',
        filenameBase: "session-a",
      };
    },
  });

  const measurement = await handler({ type: SAFARI_MEASURE_MESSAGE });
  const exportResult = await handler({ type: SAFARI_EXPORT_JSON_MESSAGE });

  assert.deepEqual(measurement, {
    ok: true,
    messageCount: 24,
    domNodeEstimate: 120,
    filenameBase: "session-a",
    titleCandidate: "session-a",
  });
  assert.deepEqual(exportResult, {
    ok: true,
    jsonText: '{"schemaVersion":1}',
    filenameBase: "session-a",
  });
});
