// npm run balance -- [hours] [seeds] [class]
import { spawnSync } from "node:child_process";
const r = spawnSync(process.execPath, ["tools/run-ts.mjs", "tools/balance.ts", ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
