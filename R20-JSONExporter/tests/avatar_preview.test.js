const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveAvatarPreviewUrl,
  syncAvatarPreviewWithInput,
  bindAvatarPreviewInput,
} = require("../js/popup/avatar_preview.js");

function createInput({ value = "", initialUrl = "", avatarUrl = "" } = {}) {
  const listeners = new Map();
  return {
    value,
    dataset: {
      initialUrl,
      avatarUrl,
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    emit(type) {
      const handler = listeners.get(type);
      if (handler) handler();
    },
  };
}

function createPreview() {
  return {
    src: "",
    removed: false,
    removeAttribute(name) {
      if (name === "src") {
        this.src = "";
        this.removed = true;
      }
    },
  };
}

test("resolveAvatarPreviewUrl prefers the current input value", () => {
  const input = createInput({
    value: "https://images.example.com/new.png",
    initialUrl: "https://images.example.com/original.png",
  });

  assert.equal(
    resolveAvatarPreviewUrl(input),
    "https://images.example.com/new.png"
  );
});

test("syncAvatarPreviewWithInput clears the preview when input is empty", () => {
  const input = createInput({
    value: "",
    initialUrl: "https://images.example.com/original.png",
  });
  const preview = createPreview();

  const nextUrl = syncAvatarPreviewWithInput(input, preview);

  assert.equal(nextUrl, "");
  assert.equal(preview.src, "");
  assert.equal(preview.removed, true);
});

test("bindAvatarPreviewInput updates the preview when the user changes the avatar url", () => {
  const input = createInput({
    value: "https://images.example.com/original.png",
    initialUrl: "https://images.example.com/original.png",
  });
  const preview = createPreview();

  bindAvatarPreviewInput(input, preview);
  input.value = "https://images.example.com/fixed.png";
  input.emit("input");

  assert.equal(preview.src, "https://images.example.com/fixed.png");
});
