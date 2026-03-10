import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";

const require = createRequire(import.meta.url);
const { CHROME_RELEASE_ROOT, FIREFOX_RELEASE_ROOT } = require("./lib/release_layout.js");

for (const [label, releaseRoot, zipName] of [
  ["Chrome", CHROME_RELEASE_ROOT, "chrome.zip"],
  ["Firefox", FIREFOX_RELEASE_ROOT, "firefox-mobile.zip"],
]) {
  if (!releaseRoot) continue;
  const zipPath = path.resolve(releaseRoot, "..", zipName);
  const result = spawnSync("zip", ["-rq", zipPath, "."], {
    cwd: releaseRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  console.log(`${label} release zipped at ${zipPath}`);
}
