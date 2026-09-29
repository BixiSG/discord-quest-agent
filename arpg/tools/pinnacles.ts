// Pinnacle check: fights each pinnacle three times on a copy of a saved hero
// and prints win/death, time and boss life left. "invest" first hones and
// drills every worn piece and fills the sockets with Radiant stones (what an
// engaged player could reach). "dawn=N" puts the hero N dawns on (the world
// tougher, one perk per dawn: damage, life, then the rest), "level=N" sets the
// level (passives are not re-spent). Usage:
//   node tools/run-ts.mjs tools/pinnacles.ts <HM1 export file> [invest] [dawn=N] [level=N]
// (make one with tools/make-save.ts)

import { readFileSync } from "node:fs";
import { importText, unwrap } from "../src/core/save";
import { validateState } from "../src/core/validate";
import { PINNACLES, MONSTERS, monsterLife, monsterDamage } from "../src/core/data";
import { STEP_MS, step } from "../src/core/sim/engine";
import { sheetOf } from "../src/core/game";
import { SLOTS } from "../src/core/types";
import { hone, honeCost } from "../src/core/crafting";
import { addStone, autoSetStones, drillCost, drillSocket } from "../src/core/sockets";
import { STONE_ORDER } from "../src/core/data";
const s0 = validateState(unwrap<any>(importText(readFileSync(process.argv[2]!, "utf8"))).state);
const arg = (k: string) => process.argv.slice(3).find(a => a.startsWith(k + "="))?.split("=")[1];
const dawn = Number(arg("dawn") ?? 0), level = Number(arg("level") ?? 0);
if (dawn > 0) { s0.hero.dawn = { level: dawn, perks: ["brightember", "steadyflame", "firstlight", "keeneye", "oldroads"].slice(0, dawn) }; s0.hero.rev++; }
if (level > 0) { s0.hero.level = level; s0.hero.rev++; }
if (process.argv.includes("invest")) {
  // An engaged player: every piece honed to 20, drilled to its cap, and the best Radiant stone per socket.
  s0.dust = 1e9;
  for (const k of SLOTS) { const it = s0.hero.equipment[k]; if (!it) continue; while (honeCost(it) !== null) hone(s0, it.uid); while (drillCost(it) !== null) drillSocket(s0, it.uid); }
  for (const id of STONE_ORDER) addStone(s0, id + ":4", 20);
  autoSetStones(s0);
  s0.hero.rev++;
}
const sh = sheetOf(s0);
console.log(`hero L${s0.hero.level} D${dawn} dps ${Math.round(sh.skill.dps)} life ${Math.round(sh.life)} es ${Math.round(sh.es)} ehp ${JSON.stringify(Object.fromEntries(Object.entries(sh.ehp).map(([k, v]) => [k, Math.round(v as number)])))}`);
for (const p of Object.values(PINNACLES)) {
  const d = MONSTERS[p.boss]!;
  let res: string[] = [];
  for (let i = 0; i < 3; i++) {
    const s = structuredClone(s0);
    s.sigils[p.sigil] = p.cost; s.activity.pinnacle = p.id; s.activity.mode = "map"; s.activity.run = null; s.activity.autoPush = false; s.activity.runIndex += 1000 + i * 7919;
    let r = ""; const ev = { death: () => { r ||= "death"; }, runDone: () => { r ||= "win"; } };
    let k = 0; let bossLifeLeft = 0;
    for (; k < 9000 && !r; k++) { step(s, ev); s.simTo += STEP_MS; const b = (s.activity as { run: { monsters: { life: number; maxLife: number }[] } | null }).run?.monsters[0]; if (b) bossLifeLeft = b.life / b.maxLife; }
    res.push(`${r || "timeout"}@${(k / 10).toFixed(0)}s boss${(bossLifeLeft * 100).toFixed(0)}%`);
  }
  console.log(`${p.id} L${p.level} life ${Math.round(monsterLife(p.level) * d.life)} hit ~${Math.round(monsterDamage(p.level) * d.damage)} :: ${res.join(", ")}`);
}
