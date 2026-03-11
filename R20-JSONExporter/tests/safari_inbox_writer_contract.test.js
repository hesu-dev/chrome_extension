const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const safariRoot = path.join(
  __dirname,
  "..",
  "..",
  "R20-JSONExporter-safari-app",
  "ios"
);

const bridgeContractPath = path.join(safariRoot, "Shared", "safari_bridge_contract.json");
const inboxPathsSourcePath = path.join(safariRoot, "Shared", "SafariInboxPaths.swift");
const storageBudgetSourcePath = path.join(safariRoot, "Shared", "SafariStorageBudget.swift");
const inboxWriterSourcePath = path.join(safariRoot, "Shared", "SafariInboxWriter.swift");
const extensionHandlerSourcePath = path.join(
  safariRoot,
  "Roll20SafariExtension",
  "SafariWebExtensionHandler.swift"
);

test("safari bridge contract defines inbox write message types and storage budgets", () => {
  const contract = JSON.parse(fs.readFileSync(bridgeContractPath, "utf8"));

  assert.deepEqual(contract.messages, {
    storagePreflight: "R20_SAFARI_STORAGE_PREFLIGHT",
    writeInboxExport: "R20_SAFARI_WRITE_INBOX_EXPORT",
  });
  assert.equal(contract.maxSingleFileBytes, 8 * 1024 * 1024);
  assert.equal(contract.maxPendingBytes, 64 * 1024 * 1024);
  assert.equal(contract.maxPendingFiles, 20);
  assert.equal(contract.minFreeBytesForWrite, 256 * 1024 * 1024);
});

test("safari shared swift sources include App Group path resolution, storage preflight, and atomic inbox writes", () => {
  const inboxPathsSource = fs.readFileSync(inboxPathsSourcePath, "utf8");
  const storageBudgetSource = fs.readFileSync(storageBudgetSourcePath, "utf8");
  const inboxWriterSource = fs.readFileSync(inboxWriterSourcePath, "utf8");
  const extensionHandlerSource = fs.readFileSync(extensionHandlerSourcePath, "utf8");

  assert.match(
    inboxPathsSource,
    /containerURL\([\s\S]*forSecurityApplicationGroupIdentifier:\s*Roll20SafariBridgeContract\.appGroupId/
  );
  assert.match(inboxPathsSource, /Roll20SafariBridgeContract\.inboxRelativePath/);
  assert.match(storageBudgetSource, /volumeAvailableCapacityForImportantUsageKey/);
  assert.match(storageBudgetSource, /maxSingleFileBytes/);
  assert.match(inboxWriterSource, /write\(to:\s*tempURL/);
  assert.match(inboxWriterSource, /moveItem\(at:\s*tempURL,\s*to:\s*finalURL\)/);
  assert.match(extensionHandlerSource, /SFExtensionMessageKey/);
  assert.match(extensionHandlerSource, /SafariInboxWriter/);
  assert.match(extensionHandlerSource, /MessageType\.writeInboxExport/);
});
