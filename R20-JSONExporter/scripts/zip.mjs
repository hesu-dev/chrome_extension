import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";

const require = createRequire(import.meta.url);
const { CHROME_RELEASE_ROOT } = require("./lib/release_layout.js");

const zipPath = path.resolve(CHROME_RELEASE_ROOT, "..", "chrome.zip");
const result = spawnSync("zip", ["-rq", zipPath, "."], {
  cwd: CHROME_RELEASE_ROOT,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Chrome release zipped at ${zipPath}`);
