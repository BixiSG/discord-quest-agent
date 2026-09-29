// Drives dev/play.html in headless Chromium and saves screenshots.
// Needs dev/serve.py running on :8765. Usage: node tools/shots.mjs [outdir]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }

const out = process.argv[2] ?? "docs/shots";
mkdirSync(out, { recursive: true });
const base = "http://127.0.0.1:8765/arpg/dev/play.html";
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errors.push(m.text()); });

const shadow = sel => page.locator(`#hollowmarch-root >> ${sel}`);
await page.goto(base + "?reset=1");
await page.waitForSelector("#hollowmarch-root", { state: "attached" });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/01-create.png` });
await shadow("button.btn.hot").click({ force: true });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/02-battle.png` });
// Jump ahead: pretend we were away 3 hours.
await page.evaluate(() => window.__hollowmarch.close());
await page.waitForTimeout(300);
await page.goto(base + "?away=180");
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/03-away.png` });
await shadow(".modal .btn").last().click({ force: true });
for (const [tab, name] of [["Gear", "04-gear"], ["Hero", "05-hero"], ["Skills", "06-skills"], ["World", "07-world"], ["Menu", "08-menu"]]) {
    await shadow(`.tabs button:text("${tab}")`).click({ force: true });
    await page.waitForTimeout(500);
    if (tab === "Gear") { const c = shadow(".stash .cell:not(.empty)").first(); if (await c.count()) { await c.click({ force: true }); await page.waitForTimeout(300); } }
    await page.screenshot({ path: `${out}/${name}.png` });
}
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
