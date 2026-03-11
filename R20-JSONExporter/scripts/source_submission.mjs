import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { rebuildReleaseZip } = require("./lib/release_zip.js");
const { stageSourceSubmissionBundle } = require("./lib/source_submission_layout.js");

const result = stageSourceSubmissionBundle();
rebuildReleaseZip({
  releaseRoot: result.stageRoot,
  zipPath: result.zipPath,
});

console.log(`Firefox source submission staged at ${result.stageRoot}`);
console.log(`Firefox source submission zip created at ${result.zipPath}`);
