const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildReplacementMaps,
  findReplacementForMessage,
  createAvatarExportResolutionContext,
  resolveAvatarExportUrl,
} = require("../src/exporter/avatar_resolution_context.js");

test("avatar resolution prefers editor override over redirected and original urls", () => {
  const originalUrl = "https://app.roll20.net/users/avatar/3307646/30";
  const redirectedUrl =
    "https://secure.gravatar.com/avatar/4cc5afb1aed693ed41db0792316e621c?d=identicon&size=30";
  const overrideUrl = "https://images.example.com/custom-avatar.png";

  const context = createAvatarExportResolutionContext(
    {
      avatarMappings: [
        {
          id: `cang|||${originalUrl}|||${redirectedUrl}`,
          name: "cang",
          originalUrl,
          avatarUrl: redirectedUrl,
        },
      ],
      replacements: [
        {
          id: `cang|||${originalUrl}|||${redirectedUrl}`,
          name: "cang",
          originalUrl,
          avatarUrl: redirectedUrl,
          newUrl: overrideUrl,
        },
      ],
    },
    {
      buildMaps: buildReplacementMaps,
      toAbsoluteUrl: (value) => String(value || "").trim(),
      normalizeSpeakerName: (value) => String(value || "").trim(),
    }
  );

  const result = resolveAvatarExportUrl(
    {
      name: "cang",
      currentSrc: originalUrl,
      currentAvatarUrl: redirectedUrl,
    },
    context,
    {
      findReplacement: findReplacementForMessage,
      toAbsoluteUrl: (value) => String(value || "").trim(),
      normalizeSpeakerName: (value) => String(value || "").trim(),
    }
  );

  assert.equal(result, overrideUrl);
});

test("avatar resolution falls back to redirected url when no override exists", () => {
  const originalUrl = "https://app.roll20.net/users/avatar/3307646/30";
  const redirectedUrl =
    "https://secure.gravatar.com/avatar/4cc5afb1aed693ed41db0792316e621c?d=identicon&size=30";

  const context = createAvatarExportResolutionContext(
    {
      avatarMappings: [
        {
          id: `cang|||${originalUrl}|||${redirectedUrl}`,
          name: "cang",
          originalUrl,
          avatarUrl: redirectedUrl,
        },
      ],
      replacements: [],
    },
    {
      buildMaps: buildReplacementMaps,
      toAbsoluteUrl: (value) => String(value || "").trim(),
      normalizeSpeakerName: (value) => String(value || "").trim(),
    }
  );

  const result = resolveAvatarExportUrl(
    {
      name: "cang",
      currentSrc: originalUrl,
      currentAvatarUrl: originalUrl,
    },
    context,
    {
      findReplacement: findReplacementForMessage,
      toAbsoluteUrl: (value) => String(value || "").trim(),
      normalizeSpeakerName: (value) => String(value || "").trim(),
    }
  );

  assert.equal(result, redirectedUrl);
});
