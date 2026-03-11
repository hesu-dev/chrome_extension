const test = require("node:test");
const assert = require("node:assert/strict");

const avatarRules = require("../js/content/avatar/avatar_rules.js");
const {
  createAvatarExportResolutionContext,
  resolveAvatarExportUrl,
} = require("../js/content/export/avatar_export_resolution.js");

function normalizeSpeakerName(raw) {
  const compact = String(raw || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (/^:+$/.test(compact)) return compact;
  return compact.replace(/:+$/, "").trim();
}

test("direct export resolves a Roll20 avatar url to the redirected mapping when currentSrc is unavailable", () => {
  const originalUrl = "https://app.roll20.net/users/avatar/3307646/30";
  const redirectedUrl =
    "https://secure.gravatar.com/avatar/0f022f1bc6083b4deaa6b01160e1e7b5?d=identicon&size=30";

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
    },
    {
      buildReplacementMaps: avatarRules.buildReplacementMaps,
      toAbsoluteUrl: (value) => String(value || "").trim(),
      normalizeSpeakerName,
    }
  );

  const resolved = resolveAvatarExportUrl(
    {
      name: "cang",
      currentSrc: originalUrl,
      currentAvatarUrl: originalUrl,
    },
    context,
    {
      findReplacementForMessage: avatarRules.findReplacementForMessage,
      toAbsoluteUrl: (value) => String(value || "").trim(),
      normalizeSpeakerName,
    }
  );

  assert.equal(resolved, redirectedUrl);
});

test("manual avatar replacements override redirected avatar mappings", () => {
  const originalUrl = "https://app.roll20.net/users/avatar/3307646/30";
  const redirectedUrl =
    "https://secure.gravatar.com/avatar/0f022f1bc6083b4deaa6b01160e1e7b5?d=identicon&size=30";
  const customUrl = "https://images.example.com/custom-cang.png";

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
          newUrl: customUrl,
        },
      ],
    },
    {
      buildReplacementMaps: avatarRules.buildReplacementMaps,
      toAbsoluteUrl: (value) => String(value || "").trim(),
      normalizeSpeakerName,
    }
  );

  const resolved = resolveAvatarExportUrl(
    {
      name: "cang",
      currentSrc: originalUrl,
      currentAvatarUrl: redirectedUrl,
    },
    context,
    {
      findReplacementForMessage: avatarRules.findReplacementForMessage,
      toAbsoluteUrl: (value) => String(value || "").trim(),
      normalizeSpeakerName,
    }
  );

  assert.equal(resolved, customUrl);
});
