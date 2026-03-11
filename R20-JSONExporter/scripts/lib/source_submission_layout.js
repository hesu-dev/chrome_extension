const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(PROJECT_ROOT, "..");
const SOURCE_SUBMISSION_STAGE_ROOT = path.join(PROJECT_ROOT, "release", "firefox-source-submission");
const SOURCE_SUBMISSION_ZIP_PATH = path.join(PROJECT_ROOT, "release", "firefox-mobile-source.zip");
const SOURCE_SUBMISSION_README_TEMPLATE_PATH = path.join(
  PROJECT_ROOT,
  "docs",
  "firefox-source-submission-README.md"
);
const SOURCE_SUBMISSION_ITEMS = [
  "R20-JSONExporter",
  "R20-JSONExporter-firefox-mobile",
  "roll20-json-core",
];

function shouldSkipSourceEntry(entryName) {
  return (
    entryName === ".DS_Store" ||
    entryName === ".git" ||
    entryName === "node_modules" ||
    entryName === "release" ||
    entryName.endsWith(".zip")
  );
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursiveFiltered(sourcePath, targetPath) {
  const entryName = path.basename(sourcePath);
  if (shouldSkipSourceEntry(entryName)) {
    return;
  }

  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    ensureDir(targetPath);
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursiveFiltered(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function stageSourceSubmissionBundle() {
  fs.rmSync(SOURCE_SUBMISSION_STAGE_ROOT, { recursive: true, force: true });
  ensureDir(SOURCE_SUBMISSION_STAGE_ROOT);

  fs.copyFileSync(
    SOURCE_SUBMISSION_README_TEMPLATE_PATH,
    path.join(SOURCE_SUBMISSION_STAGE_ROOT, "README.md")
  );

  for (const item of SOURCE_SUBMISSION_ITEMS) {
    const sourcePath = path.join(REPO_ROOT, item);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source submission input is missing: ${sourcePath}`);
    }
    copyRecursiveFiltered(sourcePath, path.join(SOURCE_SUBMISSION_STAGE_ROOT, item));
  }

  return {
    stageRoot: SOURCE_SUBMISSION_STAGE_ROOT,
    zipPath: SOURCE_SUBMISSION_ZIP_PATH,
  };
}

module.exports = {
  SOURCE_SUBMISSION_STAGE_ROOT,
  SOURCE_SUBMISSION_ZIP_PATH,
  SOURCE_SUBMISSION_README_TEMPLATE_PATH,
  SOURCE_SUBMISSION_ITEMS,
  shouldSkipSourceEntry,
  stageSourceSubmissionBundle,
};
