// Bundles a TypeScript tool for node and runs it: node tools/run-ts.mjs <file.ts> [args...]
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [entry, ...args] = process.argv.slice(2);
const out = join(mkdtempSync(join(tmpdir(), "hm-")), "tool.mjs");
await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "error" });
const r = spawnSync(process.execPath, [out, ...args], { stdio: "inherit" });
process.exit(r.status ?? 1);
