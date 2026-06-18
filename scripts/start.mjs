import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const executable = join(root, "bin", process.platform === "win32" ? "pocketbase.exe" : "pocketbase");
const host = process.env.HOST ?? "127.0.0.1";
const port = process.env.PORT ?? "8091";

if (!existsSync(executable)) {
  console.error("PocketBase is missing. Run `npm run setup` first.");
  process.exit(1);
}

const child = spawn(executable, [
  "serve",
  `--http=${host}:${port}`,
  "--dir",
  join(root, "pb_data"),
  "--migrationsDir",
  join(root, "pb_migrations"),
  "--publicDir",
  join(root, "pb_public")
], {
  cwd: root,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
