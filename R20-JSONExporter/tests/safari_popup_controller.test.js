const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const popupSourcePath = path.join(
  __dirname,
  "..",
  "..",
  "R20-JSONExporter-safari-app",
  "ios",
  "Roll20SafariExtension",
  "Resources",
  "js",
  "popup.js"
);

const {
  createPopupController,
  formatByteSize,
} = require(popupSourcePath);

function createTextElement() {
  return {
    textContent: "",
  };
}

function createButton() {
  return {
    disabled: false,
    textContent: "Export Roll20 JSON",
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
}

function createPopupDocument() {
  const elements = {
    exportButton: createButton(),
    statusStage: createTextElement(),
    statusMessage: createTextElement(),
    statusFilename: createTextElement(),
    statusMetrics: createTextElement(),
    statusPayload: createTextElement(),
    statusInbox: createTextElement(),
  };

  return {
    getElementById(id) {
      return elements[id] || null;
    },
    elements,
  };
}

test("formatByteSize renders stable human readable sizes", () => {
  assert.equal(formatByteSize(0), "0 B");
  assert.equal(formatByteSize(512), "512 B");
  assert.equal(formatByteSize(1536), "1.5 KB");
});

test("popup controller measures and exports Roll20 JSON through the active tab", async () => {
  const calls = [];
  const nativeCalls = [];
  const api = {
    tabs: {
      async query() {
        return [{ id: 42 }];
      },
      async sendMessage(tabId, payload) {
        calls.push({ tabId, payload });
        if (payload.type === "R20_SAFARI_EXPORT_MEASURE") {
          return {
            ok: true,
            messageCount: 12,
            domNodeEstimate: 84,
            filenameBase: "세션A",
            titleCandidate: "세션A",
          };
        }

        if (payload.type === "R20_SAFARI_EXPORT_JSON") {
          return {
            ok: true,
            filenameBase: "세션A",
            jsonText: '{"schemaVersion":1,"lines":[]}',
          };
        }

        throw new Error(`Unexpected message: ${payload.type}`);
      },
    },
    runtime: {
      async sendNativeMessage(payload) {
        nativeCalls.push(payload);
        if (payload.type === "R20_SAFARI_STORAGE_PREFLIGHT") {
          return {
            ok: true,
            pendingCount: 0,
            pendingBytes: 0,
            freeBytes: 536870912,
          };
        }

        if (payload.type === "R20_SAFARI_WRITE_INBOX_EXPORT") {
          return {
            ok: true,
            savedFileName: "세션A.json",
            pendingCount: 1,
            pendingBytes: 30,
            inboxRelativePath: "roll20/inbox",
          };
        }

        throw new Error(`Unexpected native message: ${payload.type}`);
      },
    },
  };
  const doc = createPopupDocument();
  const controller = createPopupController({
    api,
    doc,
  });

  await controller.handleExportClick();

  assert.deepEqual(
    calls.map((entry) => entry.payload.type),
    ["R20_SAFARI_EXPORT_MEASURE", "R20_SAFARI_EXPORT_JSON"]
  );
  assert.deepEqual(
    nativeCalls.map((entry) => entry.type),
    ["R20_SAFARI_STORAGE_PREFLIGHT", "R20_SAFARI_WRITE_INBOX_EXPORT"]
  );
  assert.equal(doc.elements.statusStage.textContent, "Done");
  assert.match(doc.elements.statusMessage.textContent, /saved to the safari inbox/i);
  assert.equal(doc.elements.statusFilename.textContent, "세션A.json");
  assert.match(doc.elements.statusMetrics.textContent, /12 messages/);
  assert.match(doc.elements.statusPayload.textContent, /30 B/);
  assert.match(doc.elements.statusInbox.textContent, /1 pending export/);
  assert.equal(doc.elements.exportButton.disabled, false);
  assert.equal(doc.elements.exportButton.textContent, "Export Again");
});
