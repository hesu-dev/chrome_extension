const test = require("node:test");
const assert = require("node:assert/strict");

const {
  chunkString,
  createDocumentChunks,
} = require("../html_chunk_serializer.js");

test("chunkString splits text by max chunk size", () => {
  const chunks = chunkString("abcdefghij", 4);
  assert.deepEqual(chunks, ["abcd", "efgh", "ij"]);
});

test("createDocumentChunks serializes with doctype and chunking", () => {
  const chunks = createDocumentChunks({
    doctypeName: "html",
    htmlAttrs: [{ name: "lang", value: "ko" }],
    headAttrs: [],
    bodyAttrs: [],
    headChildHtml: ["<meta charset=\"utf-8\" />"],
    bodyChildHtml: ["<div>hello</div>", "<p>world</p>"],
    maxChunkSize: 20,
  });

  assert.ok(chunks.join("").startsWith("<!DOCTYPE html>\n<html lang=\"ko\">"));
  assert.ok(chunks.join("").includes("<body><div>hello</div><p>world</p></body>"));
  assert.ok(chunks.every((chunk) => chunk.length <= 20));
});
