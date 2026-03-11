const test = require("node:test");
const assert = require("node:assert/strict");

const {
  collectAvatarReplacementsFromInputs,
  resolveReadingLogDownloadMode,
} = require("../js/popup/avatar_download_plan.js");

test("collectAvatarReplacementsFromInputs returns only changed replacements when requested", () => {
  const replacements = collectAvatarReplacementsFromInputs(
    [
      {
        dataset: {
          id: "a",
          name: "Alice",
          originalUrl: "https://roll20.net/original-a.png",
          initialUrl: "https://cdn.example.com/final-a.png",
        },
        value: "https://cdn.example.com/final-a.png",
      },
      {
        dataset: {
          id: "b",
          name: "Bob",
          originalUrl: "https://roll20.net/original-b.png",
          initialUrl: "https://cdn.example.com/final-b.png",
        },
        value: "https://img.example.com/override-b.png",
      },
    ],
    { onlyChanged: true }
  );

  assert.deepEqual(replacements, [
    {
      id: "b",
      name: "Bob",
      originalUrl: "https://roll20.net/original-b.png",
      newUrl: "https://img.example.com/override-b.png",
    },
  ]);
});

test("collectAvatarReplacementsFromInputs keeps the current avatar variant when present", () => {
  const replacements = collectAvatarReplacementsFromInputs([
    {
      dataset: {
        id: "a",
        name: "Alice",
        originalUrl: "https://roll20.net/original-a.png",
        avatarUrl: "https://cdn.example.com/final-a.png",
        initialUrl: "https://cdn.example.com/final-a.png",
      },
      value: "https://img.example.com/override-a.png",
    },
  ]);

  assert.deepEqual(replacements, [
    {
      id: "a",
      name: "Alice",
      originalUrl: "https://roll20.net/original-a.png",
      avatarUrl: "https://cdn.example.com/final-a.png",
      newUrl: "https://img.example.com/override-a.png",
    },
  ]);
});

test("collectAvatarReplacementsFromInputs keeps the current avatar variant when present", () => {
  const replacements = collectAvatarReplacementsFromInputs([
    {
      dataset: {
        id: "a",
        name: "Alice",
        originalUrl: "https://roll20.net/original-a.png",
        avatarUrl: "https://cdn.example.com/final-a.png",
        initialUrl: "https://cdn.example.com/final-a.png",
      },
      value: "https://img.example.com/override-a.png",
    },
  ]);

  assert.deepEqual(replacements, [
    {
      id: "a",
      name: "Alice",
      originalUrl: "https://roll20.net/original-a.png",
      avatarUrl: "https://cdn.example.com/final-a.png",
      newUrl: "https://img.example.com/override-a.png",
    },
  ]);
});

test("resolveReadingLogDownloadMode prefers direct download when there are no overrides", () => {
  assert.equal(resolveReadingLogDownloadMode([]), "direct");
  assert.equal(
    resolveReadingLogDownloadMode([
      {
        id: "b",
        name: "Bob",
        originalUrl: "https://roll20.net/original-b.png",
        newUrl: "https://img.example.com/override-b.png",
      },
    ]),
    "mapped"
  );
});
