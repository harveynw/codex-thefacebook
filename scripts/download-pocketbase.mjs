import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { chmod, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const binDir = join(root, "bin");
const executable = join(binDir, process.platform === "win32" ? "pocketbase.exe" : "pocketbase");

if (existsSync(executable)) {
  console.log(`PocketBase already exists at ${executable}`);
  process.exit(0);
}

const platformMap = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows"
};

const archMap = {
  arm64: "arm64",
  x64: "amd64"
};

const platform = platformMap[process.platform];
const arch = archMap[process.arch];

if (!platform || !arch) {
  throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
}

mkdirSync(binDir, { recursive: true });

const releaseRes = await fetch("https://api.github.com/repos/pocketbase/pocketbase/releases/latest", {
  headers: { "User-Agent": "thefacebook-pocketbase-prototype" }
});

if (!releaseRes.ok) {
  throw new Error(`Could not fetch latest PocketBase release: ${releaseRes.status} ${releaseRes.statusText}`);
}

const release = await releaseRes.json();
const tag = release.tag_name;
const asset = release.assets.find((candidate) => {
  const name = candidate.name.toLowerCase();
  return name.includes(platform) && name.includes(arch) && name.endsWith(".zip");
});

if (!asset) {
  throw new Error(`No PocketBase asset found for ${platform}_${arch} in ${tag}`);
}

const zipPath = join(binDir, asset.name);
console.log(`Downloading PocketBase ${tag} for ${platform}_${arch}...`);

const downloadRes = await fetch(asset.browser_download_url, {
  headers: { "User-Agent": "thefacebook-pocketbase-prototype" }
});

if (!downloadRes.ok) {
  throw new Error(`Could not download PocketBase: ${downloadRes.status} ${downloadRes.statusText}`);
}

await pipeline(downloadRes.body, createWriteStream(zipPath));
await execFileAsync("unzip", ["-o", zipPath, "-d", binDir]);
await chmod(executable, 0o755);
await rm(zipPath);

console.log(`PocketBase installed at ${executable}`);
