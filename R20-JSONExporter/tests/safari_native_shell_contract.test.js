const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { SAFARI_PROJECT_ROOT } = require("../scripts/lib/release_layout.js");

const appMetadataPath = path.join(SAFARI_PROJECT_ROOT, "app.json");
const runnerEntitlementsPath = path.join(SAFARI_PROJECT_ROOT, "ios", "Runner", "Runner.entitlements");
const appDelegatePath = path.join(SAFARI_PROJECT_ROOT, "ios", "Runner", "AppDelegate.swift");
const extensionInfoPlistPath = path.join(
  SAFARI_PROJECT_ROOT,
  "ios",
  "Roll20SafariExtension",
  "Info.plist"
);
const extensionEntitlementsPath = path.join(
  SAFARI_PROJECT_ROOT,
  "ios",
  "Roll20SafariExtension",
  "Roll20SafariExtension.entitlements"
);
const extensionHandlerPath = path.join(
  SAFARI_PROJECT_ROOT,
  "ios",
  "Roll20SafariExtension",
  "SafariWebExtensionHandler.swift"
);
const bridgeContractPath = path.join(
  SAFARI_PROJECT_ROOT,
  "ios",
  "Shared",
  "safari_bridge_contract.json"
);

test("safari source exposes standalone iOS app shell metadata", () => {
  const metadata = JSON.parse(fs.readFileSync(appMetadataPath, "utf8"));

  assert.deepEqual(metadata.ios, {
    bundleIdentifier: "com.reha.r20safariexport",
    extensionBundleIdentifier: "com.reha.r20safariexport.extension",
    appGroupId: "group.com.reha.readinglog.sync",
    bridgeContractPath: "ios/Shared/safari_bridge_contract.json",
  });
});

test("safari source includes Runner and extension shell files that share the same app group", () => {
  const runnerEntitlements = fs.readFileSync(runnerEntitlementsPath, "utf8");
  const extensionEntitlements = fs.readFileSync(extensionEntitlementsPath, "utf8");
  const bridgeContract = JSON.parse(fs.readFileSync(bridgeContractPath, "utf8"));
  const appDelegateSource = fs.readFileSync(appDelegatePath, "utf8");
  const extensionInfoPlist = fs.readFileSync(extensionInfoPlistPath, "utf8");
  const extensionHandlerSource = fs.readFileSync(extensionHandlerPath, "utf8");

  assert.match(runnerEntitlements, /group\.com\.reha\.readinglog\.sync/);
  assert.match(extensionEntitlements, /group\.com\.reha\.readinglog\.sync/);
  assert.deepEqual(bridgeContract, {
    appGroupId: "group.com.reha.readinglog.sync",
    inboxRelativePath: "roll20/inbox",
    pendingRelativePath: "roll20/pending",
    fileExtension: ".json",
    nativeBridgeChannel: "com.reha.r20safariexport.bridge",
    messages: {
      storagePreflight: "R20_SAFARI_STORAGE_PREFLIGHT",
      writeInboxExport: "R20_SAFARI_WRITE_INBOX_EXPORT",
    },
    minFreeBytesForWrite: 268435456,
  });
  assert.match(appDelegateSource, /Roll20SafariBridgeContract/);
  assert.match(extensionInfoPlist, /com\.apple\.Safari\.web-extension/);
  assert.match(extensionHandlerSource, /class SafariWebExtensionHandler/);
});

test("safari source metadata points at the native bridge contract that release staging will copy", () => {
  const metadata = JSON.parse(fs.readFileSync(appMetadataPath, "utf8"));

  assert.equal(
    path.join(SAFARI_PROJECT_ROOT, metadata.ios.bridgeContractPath),
    bridgeContractPath
  );
});
