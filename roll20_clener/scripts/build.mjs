import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const manifestPath = path.join(rootDir, "manifest.json");

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyEntry(relativePath) {
  const sourcePath = path.join(rootDir, relativePath);
  const destinationPath = path.join(distDir, relativePath);
  await cp(sourcePath, destinationPath, { recursive: true });
}

async function main() {
  const manifestRaw = await readFile(manifestPath, "utf8");
  JSON.parse(manifestRaw);

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const entriesToCopy = ["manifest.json", "popup.html", "css", "js"];

  for (const entry of entriesToCopy) {
    const fullPath = path.join(rootDir, entry);
    if (await pathExists(fullPath)) {
      await copyEntry(entry);
    }
  }

  console.log("Build complete: dist directory refreshed.");
}

await main();
