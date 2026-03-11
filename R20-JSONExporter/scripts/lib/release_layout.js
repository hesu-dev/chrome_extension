const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(PROJECT_ROOT, "..");
const CORE_ROOT = path.join(REPO_ROOT, "roll20-json-core", "src");
const CHROME_RELEASE_ROOT = path.join(PROJECT_ROOT, "release", "chrome");
const FIREFOX_PROJECT_ROOT = path.join(REPO_ROOT, "R20-JSONExporter-firefox-mobile");
const FIREFOX_RELEASE_ROOT = path.join(PROJECT_ROOT, "release", "firefox-mobile");
const VENDOR_CORE_PATH = "js/vendor/roll20-json-core.js";
const STAGED_ROOT_ITEMS = ["manifest.json", "popup.html", "icons", "css", "js"];

function shouldSkipCopyEntry(entryName) {
  return entryName === ".DS_Store";
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(sourcePath, targetPath) {
  if (shouldSkipCopyEntry(path.basename(sourcePath))) {
    return;
  }
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    ensureDir(targetPath);
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function getSourceManifest() {
  return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "manifest.json"), "utf8"));
}

function getChromeStageManifest() {
  const manifest = getSourceManifest();
  return injectVendorScript(manifest);
}

function getFirefoxSourceManifest() {
  return JSON.parse(fs.readFileSync(path.join(FIREFOX_PROJECT_ROOT, "manifest.json"), "utf8"));
}

function injectVendorScript(manifest) {
  const staged = JSON.parse(JSON.stringify(manifest));
  staged.content_scripts = (staged.content_scripts || []).map((entry) => {
    const scripts = Array.isArray(entry.js) ? entry.js.filter((item) => item !== VENDOR_CORE_PATH) : [];
    return {
      ...entry,
      js: [VENDOR_CORE_PATH, ...scripts],
    };
  });
  return staged;
}

function getFirefoxStageManifest() {
  return injectVendorScript(getFirefoxSourceManifest());
}

function normalizeModuleSpecifier(fromId, specifier) {
  const withExtension = specifier.endsWith(".js") ? specifier : `${specifier}.js`;
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromId), withExtension));
}

function collectCoreModules(moduleId, modules = new Map()) {
  if (modules.has(moduleId)) return modules;
  const sourcePath = path.join(CORE_ROOT, moduleId);
  const rawSource = fs.readFileSync(sourcePath, "utf8");
  const dependencies = [];
  const rewrittenSource = rawSource.replace(
    /require\((['"])(\.{1,2}\/[^'"]+)\1\)/g,
    (_match, _quote, specifier) => {
      const normalized = normalizeModuleSpecifier(moduleId, specifier);
      dependencies.push(normalized);
      return `require("${normalized}")`;
    }
  );
  modules.set(moduleId, rewrittenSource);
  dependencies.forEach((dependencyId) => collectCoreModules(dependencyId, modules));
  return modules;
}

function buildSharedCoreBundle() {
  const modules = collectCoreModules("index.js");
  const moduleFactories = Array.from(modules.entries())
    .map(
      ([moduleId, source]) =>
        `${JSON.stringify(moduleId)}: function(module, exports, require) {\n${source}\n}`
    )
    .join(",\n");

  return `(function () {
  const modules = {
${moduleFactories}
  };
  const cache = {};

  function require(moduleId) {
    if (cache[moduleId]) return cache[moduleId].exports;
    const factory = modules[moduleId];
    if (!factory) {
      throw new Error("Unknown shared-core module: " + moduleId);
    }
    const module = { exports: {} };
    cache[moduleId] = module;
    factory(module, module.exports, require);
    return module.exports;
  }

  const core = require("index.js");
  if (typeof window !== "undefined") {
    window.Roll20JsonCore = Object.assign({}, window.Roll20JsonCore, core.browserContract || core);
  }
})();`;
}

function stageTargetRelease({ sourceRoot, releaseRoot, manifest, items }) {
  fs.rmSync(releaseRoot, { recursive: true, force: true });
  ensureDir(releaseRoot);

  items.forEach((item) => {
    const sourcePath = path.join(sourceRoot, item);
    if (!fs.existsSync(sourcePath)) return;
    copyRecursive(sourcePath, path.join(releaseRoot, item));
  });

  fs.writeFileSync(path.join(releaseRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const vendorPath = path.join(releaseRoot, VENDOR_CORE_PATH);
  ensureDir(path.dirname(vendorPath));
  fs.writeFileSync(vendorPath, `${buildSharedCoreBundle()}\n`);

  return {
    releaseRoot,
    manifestPath: path.join(releaseRoot, "manifest.json"),
    vendorPath,
  };
}

function stageChromeRelease() {
  return stageTargetRelease({
    sourceRoot: PROJECT_ROOT,
    releaseRoot: CHROME_RELEASE_ROOT,
    manifest: getChromeStageManifest(),
    items: STAGED_ROOT_ITEMS,
  });
}

function stageFirefoxRelease() {
  return stageTargetRelease({
    sourceRoot: FIREFOX_PROJECT_ROOT,
    releaseRoot: FIREFOX_RELEASE_ROOT,
    manifest: getFirefoxStageManifest(),
    items: ["manifest.json", "popup.html", "icons", "js"],
  });
}

module.exports = {
  PROJECT_ROOT,
  REPO_ROOT,
  CORE_ROOT,
  CHROME_RELEASE_ROOT,
  FIREFOX_PROJECT_ROOT,
  FIREFOX_RELEASE_ROOT,
  VENDOR_CORE_PATH,
  shouldSkipCopyEntry,
  getSourceManifest,
  getChromeStageManifest,
  getFirefoxSourceManifest,
  getFirefoxStageManifest,
  buildSharedCoreBundle,
  stageChromeRelease,
  stageFirefoxRelease,
};
