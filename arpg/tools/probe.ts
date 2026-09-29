// Long-run health report: plays a hero with the balance bot (which also claims
// contracts) and prints, every few hours, the stash, the relic case, dust and
// currency, deaths by map tier, and how long contracts took.
// Usage: node tools/run-ts.mjs tools/probe.ts [hours=48] [class=vanguard] [seed=777]

import { advance } from "../src/core/sim/engine";
import { newGame } from "../src/core/game";
import { baseOf, levelReq } from "../src/core/items";
import { claimContract } from "../src/core/contracts";
import { autoXpCap } from "../src/core/maps";
import { botTune } from "./bot";

const HOUR = 3600e3;
const [hoursArg = "48", cls = "vanguard", seedArg = "777"] = process.argv.slice(2);
const hours = Number(hoursArg);
const start = Date.now() - hours * HOUR;
const g = newGame({ name: "Probe", cls, now: start, seed: Number(seedArg) });
const deaths: Record<string, number> = {};
const born = new Map<object, number>();
const took: Record<string, number[]> = {};
const ev = {
    death: () => {
        const r = g.activity.run!;
        const k = r.map ? `${r.map.pinnacle ? "pin" : "T" + r.map.tier}${r.pack >= r.packs && r.boss ? "b" : ""}` : "road";
        deaths[k] = (deaths[k] ?? 0) + 1;
    },
};
const every = hours <= 8 ? 1 : 4;
for (let t = start, next = every; t < start + hours * HOUR;) {
    t += 5 * 60e3;
    advance(g, t, ev);
    botTune(g);
    for (const c of g.contracts.list) if (!born.has(c)) born.set(c, g.simTo);
    for (let i = 0; i < g.contracts.list.length; i++) {
        const c = g.contracts.list[i]!;
        if (c.n >= c.target) { (took[c.kind] ??= []).push((g.simTo - born.get(c)!) / 60e3); claimContract(g, i); }
    }
    if ((t - start) / HOUR >= next) {
        next += every;
        const behind = g.stash.filter(it => baseOf(it).level < g.hero.level - 10).length;
        const locked = g.stash.filter(it => levelReq(it) > g.hero.level).length;
        const cur = Object.entries(g.currency).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(", ");
        console.log(`${((t - start) / HOUR).toFixed(0)}h L${g.hero.level} ${g.activity.mode === "map" ? `maps (cap ${g.activity.autoCap || "-"}, xp cap ${autoXpCap(g)})` : g.activity.zone}`
            + ` | stash ${g.stash.length}/${g.stashCap} (behind ${behind}, need level ${locked}) case ${g.relics.length} codex ${Object.keys(g.codex).length}`
            + ` | swapped ${g.totals.swapped ?? 0} dust ${Math.round(g.dust)} | ${cur}`);
        console.log(`    deaths ${g.totals.deaths}: ${Object.entries(deaths).map(([k, v]) => `${k}:${v}`).join(" ") || "none"}`);
        const worn = Object.values(g.hero.equipment).flatMap(x => x?.stones ?? []);
        console.log(`    stones: pouch ${Object.values(g.stones ?? {}).reduce((a, b) => a + b, 0)} (${Object.entries(g.stones ?? {}).map(([k, v]) => `${k}x${v}`).join(" ")}), worn ${worn.filter(Boolean).length}/${worn.length} [${worn.join(",")}] market seq ${g.market?.seq ?? 0}`);
        for (const k in deaths) delete deaths[k];
    }
}
for (const [k, v] of Object.entries(took)) {
    v.sort((a, b) => a - b);
    console.log(`contracts ${k.padEnd(9)} ${String(v.length).padStart(3)} done, median ${v[Math.floor(v.length / 2)]!.toFixed(0)} min, max ${Math.max(...v).toFixed(0)} min`);
}
