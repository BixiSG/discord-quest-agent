// Bundles tools/balance.ts for node and runs it with the given arguments.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "hm-")), "balance.mjs");
await build({ entryPoints: ["tools/balance.ts"], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "error" });
const r = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
