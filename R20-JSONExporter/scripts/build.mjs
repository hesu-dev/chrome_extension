import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { stageChromeRelease, stageFirefoxRelease } = require("./lib/release_layout.js");

const chromeResult = stageChromeRelease();
const firefoxResult = stageFirefoxRelease();

console.log(`Chrome release staged at ${chromeResult.releaseRoot}`);
console.log(`Chrome manifest: ${chromeResult.manifestPath}`);
console.log(`Chrome shared core bundle: ${chromeResult.vendorPath}`);
console.log(`Firefox release staged at ${firefoxResult.releaseRoot}`);
console.log(`Firefox manifest: ${firefoxResult.manifestPath}`);
console.log(`Firefox shared core bundle: ${firefoxResult.vendorPath}`);
