const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

function rebuildReleaseZip({ releaseRoot, zipPath }) {
  if (!releaseRoot || !zipPath) {
    throw new Error("releaseRoot and zipPath are required.");
  }

  fs.rmSync(zipPath, { force: true });

  const result = spawnSync("zip", ["-rq", zipPath, "."], {
    cwd: releaseRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`zip command failed with status ${result.status ?? 1}.`);
  }
}

module.exports = {
  rebuildReleaseZip,
};
