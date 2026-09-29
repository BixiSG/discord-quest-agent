// Browser perf audit on dev/play.html: frame times while the game is open and
// the time a 24 h catch-up takes. Needs dev/serve.py on :8765.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const base = "http://127.0.0.1:8765/arpg/dev/play.html";
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
const sh = sel => page.locator(`#hollowmarch-root >> ${sel}`);
await page.goto(base + "?reset=1");
await page.waitForSelector("#hollowmarch-root", { state: "attached" });
await sh("button.btn.hot").click({ force: true });
await page.waitForTimeout(1500);
const frames = await page.evaluate(() => new Promise(res => {
    const ts = []; let long = 0;
    try { new PerformanceObserver(l => { long += l.getEntries().length; }).observe({ type: "longtask", buffered: false }); } catch {}
    const f = t => { ts.push(t); if (ts.length < 300) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]); d.sort((a, b) => a - b); res({ median: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)], long }); } };
    requestAnimationFrame(f);
}));
console.log("frames (ms): median", frames.median.toFixed(1), "p95", frames.p95.toFixed(1), "long tasks", frames.long);
// Work per frame: time the game's own draw + HUD by sampling scripting time.
const metrics = await page.evaluate(async () => { const t0 = performance.now(); let n = 0; await new Promise(r => { const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return n / 3; });
console.log("fps", metrics.toFixed(0));
await page.evaluate(() => window.__hollowmarch.close());
await page.waitForTimeout(500);
const t0 = Date.now();
await page.goto(base + "?away=1440");
await page.waitForSelector("#hollowmarch-root", { state: "attached" });
await page.waitForFunction(() => { const r = document.querySelector("#hollowmarch-root")?.shadowRoot; return !!r && !r.querySelector(".progress") && !!r.querySelector(".modal .kv"); }, null, { timeout: 120000 });
console.log("24 h catch-up incl. page load:", ((Date.now() - t0) / 1000).toFixed(1), "s");
await browser.close();
