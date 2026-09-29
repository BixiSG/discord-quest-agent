// Imports an endgame save into dev/play.html and screenshots the late-game views.
// Usage: node tools/shots-endgame.mjs <save.txt> <outdir>
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const [savePath, out = "docs/shots"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const text = readFileSync(savePath, "utf8");
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
const sh = sel => page.locator(`#hollowmarch-root >> ${sel}`);
await page.goto("http://127.0.0.1:8765/arpg/dev/play.html?reset=1");
await page.waitForSelector("#hollowmarch-root", { state: "attached" });
await sh("button.btn.hot").click({ force: true });
await page.waitForTimeout(800);
await sh('.tabs button[data-v="menu"]').click({ force: true });
await sh('textarea[placeholder^="Paste"]').fill(text);
await sh('button:text("Import")').click({ force: true });
await page.waitForTimeout(3000);
const back = sh('.modal button');
if (await back.count()) await back.last().click({ force: true });
for (const [v, name] of [["atlas", "11-atlas"], ["tree", "12-tree-late"], ["hero", "13-hero-late"], ["gear", "14-gear-late"]]) {
    await sh(`.tabs button[data-v="${v}"]`).click({ force: true });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${name}.png` });
}
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
