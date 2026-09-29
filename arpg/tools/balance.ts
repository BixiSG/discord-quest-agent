// Headless balance simulator: plays fresh heroes for simulated hours and
// prints progress per checkpoint. Usage: npm run balance -- [hours] [seeds] [class]

import { advance, type SimEvents } from "../src/core/sim/engine";
import { newGame, sheetOf } from "../src/core/game";
import { ZONES } from "../src/core/data";
import { botTune } from "./bot";

const HOUR = 3600e3;
const args = process.argv.slice(2);
const hours = Number(args[0] ?? 8);
const seeds = Number(args[1] ?? 3);
const cls = args[2] ?? "vanguard";
const checkpoints = [0.25, 0.5, 1, 2, 4, 8, 12, 24, 48, 96, 168].filter(h => h <= hours);

const f = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? (n / 1e3).toFixed(0) + "k" : n >= 100 ? n.toFixed(0) : n.toFixed(1);

for (let s = 1; s <= seeds; s++) {
    const g = newGame({ name: "Bal", cls, now: 0, seed: 1000 + s });
    let deaths = 0, kills = 0, bossKills = 0;
    const ev: SimEvents = { death: () => deaths++, kill: m => { kills++; if (m.def in { tidewarden: 1, keeper: 1 }) bossKills++; } };
    console.log(`\n== ${cls} seed ${s}`);
    botTune(g);
    console.log("hours  lvl  zone                      dps      pack    life   ehpPhys  ehpCold  deaths  kills  stash dust");
    const t0 = performance.now();
    let t = 0;
    for (const h of checkpoints) {
        // The bot re-tunes the build every 10 simulated minutes.
        while (t < h * HOUR) { t = Math.min(h * HOUR, t + 10 * 60e3); advance(g, t, ev); botTune(g); }
        const sh = sheetOf(g);
        console.log([String(h).padStart(5), String(g.hero.level).padStart(4), ZONES[g.activity.zone]!.name.padEnd(24),
            f(sh.skill.dps).padStart(8), f(sh.skill.packDps).padStart(8), f(sh.life).padStart(7), f(sh.ehp.phys).padStart(8), f(sh.ehp.cold).padStart(8),
            String(deaths).padStart(7), String(kills).padStart(6), String(g.stash.length).padStart(6), String(g.dust).padStart(5)].join(" "));
    }
    console.log(`sim speed: ${(hours * HOUR / (performance.now() - t0) / 1000).toFixed(0)}x real time per ms... ${((performance.now() - t0) / 1000).toFixed(2)} s for ${hours} h; boss kills ${bossKills}`);
}
