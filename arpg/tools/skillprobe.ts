// Skill balance probe: plays a hero with the balance bot and, at each checkpoint,
// ranks every skill it could use by score with its best greedy supports
// (the way the bot picks: its clear score), with single-target and pack DPS beside it.
// Usage: node tools/run-ts.mjs tools/skillprobe.ts [class=vanguard] [hours=4,8,16,32] [seed=11]

import { advance } from "../src/core/sim/engine";
import { newGame } from "../src/core/game";
import { deriveSheet, supportSlots } from "../src/core/character";
import { SKILLS, SUPPORTS } from "../src/core/data";
import type { Hero } from "../src/core/state";
import { botTune, clearScore } from "./bot";

const HOUR = 3600e3;
const [cls = "vanguard", hoursArg = "4,8,16,32", seedArg = "11"] = process.argv.slice(2);
const checkpoints = hoursArg.split(",").map(Number);
const start = Date.UTC(2026, 5, 1);
const g = newGame({ name: "Probe", cls, now: start, seed: Number(seedArg) });
const score = clearScore;

/** The bot's greedy support pick for one skill. */
function best(hero: Hero, skill: string): { supports: string[]; score: number } {
    const sup: string[] = [];
    for (let slot = 0; slot < supportSlots(hero.level); slot++) {
        let pick: string | null = null, ps = score({ ...hero, skill, supports: sup });
        for (const s of Object.values(SUPPORTS)) {
            if (s.level > hero.level || sup.includes(s.id)) continue;
            const v = score({ ...hero, skill, supports: [...sup, s.id] });
            if (v > ps * 1.001) { ps = v; pick = s.id; }
        }
        if (!pick) break;
        sup.push(pick);
    }
    return { supports: sup, score: score({ ...hero, skill, supports: sup }) };
}

let t = start;
for (const h of checkpoints) {
    while (t < start + h * HOUR) { t = Math.min(start + h * HOUR, t + 10 * 60e3); advance(g, t); botTune(g); }
    const hero = g.hero;
    console.log(`\n== ${cls} ${h}h: level ${hero.level}, skill ${hero.skill} [${hero.supports.join(", ")}], weapon ${hero.equipment.weapon?.base ?? "-"}`);
    const rows = Object.values(SKILLS).filter(s => s.level <= hero.level).map(s => {
        const b = best(hero, s.id);
        const sh = deriveSheet({ ...hero, skill: s.id, supports: b.supports, rev: -1 });
        return { id: s.id, lvl: s.level, score: b.score, dps: sh.skill.dps, pack: sh.skill.packDps, sus: sh.skill.sustain < sh.skill.speed, ok: !sh.problems.length, sup: b.supports };
    }).filter(r => r.ok).sort((a, b) => b.score - a.score);
    const top = rows[0]?.score ?? 1;
    for (const r of rows) console.log(`  ${r.id.padEnd(12)} L${String(r.lvl).padStart(2)} score ${(r.score / top * 100).toFixed(0).padStart(3)}%  dps ${Math.round(r.dps).toString().padStart(7)}  pack ${Math.round(r.pack).toString().padStart(8)}${r.sus ? " (mana)" : ""}  [${r.sup.join(", ")}]`);
}
