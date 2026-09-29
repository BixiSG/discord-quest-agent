// Plays a hero with the balance bot and writes an HM1 export, for screenshots
// and manual testing. Usage: node tools/run-ts.mjs tools/make-save.ts <hours> <class> <out> [nowMs]

import { writeFileSync } from "node:fs";
import { advance } from "../src/core/sim/engine";
import { newGame } from "../src/core/game";
import { exportText, wrap } from "../src/core/save";
import { botTune } from "./bot";

const [hours = "24", cls = "strider", out = "/tmp/hm-save.txt", nowArg] = process.argv.slice(2);
const HOUR = 3600e3;
const end = Number(nowArg ?? Date.now());
const start = end - Number(hours) * HOUR;
const g = newGame({ name: "Ashling", cls, now: start, seed: 4242 });
botTune(g);
for (let t = start; t < end; ) { t = Math.min(end, t + 10 * 60e3); advance(g, t); botTune(g); }
writeFileSync(out, exportText(wrap(g, end)));
console.log(`level ${g.hero.level}, ${g.maps.length} maps, atlas ${g.atlas.points}, zone ${g.activity.zone}, mode ${g.activity.mode}`);
