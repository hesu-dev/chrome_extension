import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  stageChromeRelease,
  stageFirefoxWebRelease,
  stageFirefoxRelease,
  stageSafariRelease,
} = require("./lib/release_layout.js");

const chromeResult = stageChromeRelease();
const firefoxWebResult = stageFirefoxWebRelease();
const firefoxMobileResult = stageFirefoxRelease();
const safariResult = stageSafariRelease();

console.log(`Chrome release staged at ${chromeResult.releaseRoot}`);
console.log(`Chrome manifest: ${chromeResult.manifestPath}`);
console.log(`Chrome shared core bundle: ${chromeResult.vendorPath}`);
console.log(`Firefox web release staged at ${firefoxWebResult.releaseRoot}`);
console.log(`Firefox web manifest: ${firefoxWebResult.manifestPath}`);
console.log(`Firefox web shared core bundle: ${firefoxWebResult.vendorPath}`);
console.log(`Firefox mobile release staged at ${firefoxMobileResult.releaseRoot}`);
console.log(`Firefox mobile manifest: ${firefoxMobileResult.manifestPath}`);
console.log(`Firefox mobile shared core bundle: ${firefoxMobileResult.vendorPath}`);
console.log(`Safari release staged at ${safariResult.releaseRoot}`);
console.log(`Safari app metadata: ${safariResult.appMetadataPath}`);
console.log(`Safari shared core bundle: ${safariResult.vendorPath}`);
