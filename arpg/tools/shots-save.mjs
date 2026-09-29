// Imports a save into dev/play.html and screenshots the views asked for.
// Needs dev/serve.py on :8765. Usage:
//   node tools/shots-save.mjs <save.txt> <outdir> [lang=en] [view ...]
// Views are tab ids (hero, gear, forge, skills, tree, world, atlas, log, menu,
// market); "log:echoes" or "log:feats" first picks that chip. Fails on console errors.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const [savePath, out = "/tmp/hm-shots", lang = "en", ...views] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const text = readFileSync(savePath, "utf8");
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: Number(process.env.H ?? 780) } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
const sh = sel => page.locator(`#hollowmarch-root >> ${sel}`);
await page.goto(`http://127.0.0.1:8765/arpg/dev/play.html?reset=1&lang=${lang}`);
await page.waitForSelector("#hollowmarch-root", { state: "attached" });
await sh("button.btn.hot").click({ force: true });
await page.waitForTimeout(800);
await sh('.nav button[data-v="menu"]').click({ force: true });
await sh("textarea:not([readonly])").first().fill(text);
await sh("button[data-act=import]").click({ force: true });
await page.waitForTimeout(3000);
const back = sh(".modal button");
if (await back.count()) await back.last().click({ force: true });
await page.waitForTimeout(300);
// MAX=1 fills the viewport with the window (with H=1400, whole lists fit).
if (process.env.MAX) { await sh(".ctl.mx").click({ force: true }); await page.waitForTimeout(300); }
for (const v of views.length ? views : ["hero", "skills"]) {
    const [tab, chip] = v.split(":");
    await sh(`.nav button[data-v="${tab}"]`).click({ force: true });
    await page.waitForTimeout(500);
    if (chip) { await sh(`.chips button[data-v="${chip}"]`).first().click({ force: true }); await page.waitForTimeout(400); }
    await page.screenshot({ path: `${out}/${v.replace(":", "-")}-${lang}.png` });
}
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
