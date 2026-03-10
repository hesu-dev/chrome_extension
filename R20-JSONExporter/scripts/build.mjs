import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { stageChromeRelease } = require("./lib/release_layout.js");

const result = stageChromeRelease();

console.log(`Chrome release staged at ${result.releaseRoot}`);
console.log(`Manifest: ${result.manifestPath}`);
console.log(`Shared core bundle: ${result.vendorPath}`);
