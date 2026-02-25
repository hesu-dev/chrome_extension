import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const releaseDir = path.join(rootDir, "release");
const pkgPath = path.join(rootDir, "package.json");

async function main() {
  const pkgRaw = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(pkgRaw);
  const version = pkg.version || "0.0.0";
  const zipName = `roll20_clener-v${version}.zip`;
  const zipPath = path.join(releaseDir, zipName);

  await mkdir(releaseDir, { recursive: true });

  await execFileAsync("zip", ["-r", zipPath, "."], { cwd: distDir });

  console.log(`Package created: ${zipPath}`);
}

await main();
