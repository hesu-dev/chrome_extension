import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  CHROME_RELEASE_ROOT,
  FIREFOX_WEB_RELEASE_ROOT,
  FIREFOX_RELEASE_ROOT,
  SAFARI_RELEASE_ROOT,
} = require("./lib/release_layout.js");
const { rebuildReleaseZip } = require("./lib/release_zip.js");

for (const [label, releaseRoot, zipName] of [
  ["Chrome", CHROME_RELEASE_ROOT, "chrome.zip"],
  ["Firefox web", FIREFOX_WEB_RELEASE_ROOT, "firefox-web.zip"],
  ["Firefox mobile", FIREFOX_RELEASE_ROOT, "firefox-mobile.zip"],
]) {
  if (!releaseRoot) continue;
  const zipPath = path.resolve(releaseRoot, "..", zipName);
  try {
    rebuildReleaseZip({ releaseRoot, zipPath });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`${label} release zipped at ${zipPath}`);
}

console.log(`Safari release is staged as a folder at ${SAFARI_RELEASE_ROOT} (no zip generated)`);
