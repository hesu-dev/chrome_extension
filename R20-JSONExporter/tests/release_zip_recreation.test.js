const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { rebuildReleaseZip } = require("../scripts/lib/release_zip.js");

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

test("rebuilding a release zip removes files that no longer exist in the staged release", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "r20-release-zip-"));
  const releaseRoot = path.join(tempRoot, "release");
  const zipPath = path.join(tempRoot, "chrome.zip");

  fs.mkdirSync(releaseRoot, { recursive: true });
  writeFile(path.join(releaseRoot, "old.txt"), "old");
  rebuildReleaseZip({ releaseRoot, zipPath });

  fs.rmSync(path.join(releaseRoot, "old.txt"), { force: true });
  writeFile(path.join(releaseRoot, "new.txt"), "new");
  rebuildReleaseZip({ releaseRoot, zipPath });

  const unzipResult = spawnSync("unzip", ["-l", zipPath], {
    encoding: "utf8",
  });

  assert.equal(unzipResult.status, 0, unzipResult.stderr);
  assert.match(unzipResult.stdout, /new\.txt/);
  assert.doesNotMatch(unzipResult.stdout, /old\.txt/);
});
