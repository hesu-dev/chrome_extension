const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildDownloadFilename,
  downloadJsonPayload,
} = require("../js/background/background.js");

test("buildDownloadFilename normalizes unsafe characters and appends .json", () => {
  assert.equal(buildDownloadFilename('  session:/a?*  '), "session-a.json");
});

test("downloadJsonPayload uses a blob URL and revokes it after download", async () => {
  const calls = [];

  class FakeBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  }

  const result = await downloadJsonPayload(
    {
      jsonText: '{"schemaVersion":1}',
      filenameBase: "session-a",
    },
    {
      BlobCtor: FakeBlob,
      createObjectURL(blob) {
        calls.push({ kind: "blob", blob });
        return "blob:firefox-mobile";
      },
      revokeObjectURL(url) {
        calls.push({ kind: "revoke", url });
      },
      download(options) {
        calls.push({ kind: "download", options });
        return Promise.resolve(1);
      },
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.filename, "session-a.json");
  assert.equal(calls[0].kind, "blob");
  assert.deepEqual(calls[1], {
    kind: "download",
    options: {
      url: "blob:firefox-mobile",
      filename: "session-a.json",
      saveAs: false,
      conflictAction: "uniquify",
    },
  });
  assert.deepEqual(calls[2], {
    kind: "revoke",
    url: "blob:firefox-mobile",
  });
});
