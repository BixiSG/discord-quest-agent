// Dawn loop check: plays a hero with the balance bot (which relights the sun as
// soon as it can) and prints when each sun pinnacle first falls and when each
// dawn begins, with the hero's level at the time.
// Usage: node tools/run-ts.mjs tools/dawns.ts [hours=160] [class=vanguard] [seed=777]
// DUMP=<dir> also writes an HM1 export at each first kill (<class>-<seed>-D<n>-<pinnacle>.txt),
// to take apart with tools/pinnacles.ts.

import { advance } from "../src/core/sim/engine";
import { newGame, sheetOf } from "../src/core/game";
import { claimContract } from "../src/core/contracts";
import { dawnOf } from "../src/core/dawn";
import { SUN_PINNACLES } from "../src/core/echoes";
import { exportText, wrap } from "../src/core/save";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { botTune } from "./bot";

const HOUR = 3600e3;
const [hoursArg = "160", cls = "vanguard", seedArg = "777"] = process.argv.slice(2);
const hours = Number(hoursArg);
const start = Date.UTC(2026, 5, 1); // June: no seasonal event in the way
const g = newGame({ name: "Dawn", cls, now: start, seed: Number(seedArg) });
const events: string[] = [];
let dawn = 0, dawnAt = 0, killed = new Set<string>();
const h = () => ((g.simTo - start) / HOUR).toFixed(1);
for (let t = start; t < start + hours * HOUR;) {
    t += 5 * 60e3;
    advance(g, t);
    for (const p of SUN_PINNACLES) if ((g.pinnacleKills[p] ?? 0) > 0 && !killed.has(p)) {
        killed.add(p);
        events.push(`  ${h()}h D${dawn} ${p} falls (L${g.hero.level}, ${((g.simTo - start) / HOUR - dawnAt).toFixed(1)}h into the dawn)`);
        if (process.env.DUMP) writeFileSync(join(process.env.DUMP, `${cls}-${seedArg}-D${dawn}-${p}.txt`), exportText(wrap(g, g.simTo)));
    }
    botTune(g);
    for (let i = 0; i < g.contracts.list.length; i++) if (g.contracts.list[i]!.n >= g.contracts.list[i]!.target) claimContract(g, i);
    if (dawnOf(g) !== dawn) {
        dawn = dawnOf(g); dawnAt = (g.simTo - start) / HOUR; killed = new Set();
        events.push(`${h()}h -> Dawn ${dawn}`);
    }
}
if (process.env.DUMP) writeFileSync(join(process.env.DUMP, `${cls}-${seedArg}-end.txt`), exportText(wrap(g, g.simTo)));
const s = sheetOf(g);
console.log(`${cls} seed ${seedArg}: ${hours}h, ends D${dawn} L${g.hero.level} dps ${Math.round(s.skill.dps)} life ${Math.round(s.life)} es ${Math.round(s.es)} dust ${Math.round(g.dust)} kills ${JSON.stringify(g.pinnacleKills)}`);
for (const e of events) console.log(e);
