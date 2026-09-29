// Headless-Chrome screenshots over CDP (the built-in browser pane crops and
// times out on this PC). Runs a scenario script against a page served over http:
//   node tools/cdp/shoot.mjs tools/cdp/example-tabs.mjs      (W=1180 H=820 LANGX=ru ...)
// The scenario exports default async ({ nav, ev, shot, sleep, click, send }) => {}.
// shot(name, selector) clips to an element inside the game's shadow root
// (default ".win"); PNGs land in dev/out/shots (git-ignored). Chrome runs with
// --mute-audio and is killed at the end. Serve the repo root first, e.g.
//   python -m http.server 8778 --bind 127.0.0.1   (from the repo root)
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CDP_PORT ?? 9335);
const W = Number(process.env.W ?? 1280), H = Number(process.env.H ?? 860);
const out = resolve(here, "../../../dev/out/shots");
mkdirSync(out, { recursive: true });
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
    "--headless=new", `--remote-debugging-port=${PORT}`, "--mute-audio", "--force-device-scale-factor=1", `--window-size=${W},${H}`,
    `--user-data-dir=${join(tmpdir(), "hm-cdp-profile")}`, "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets = null;
for (let i = 0; i < 50 && !targets; i++) { await sleep(200); try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { } }
const page = targets.find(t => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener("message", m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === "Runtime.exceptionThrown") logs.push("EXC " + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text));
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) logs.push(msg.params.type + " " + msg.params.args.map(a => a.value ?? a.description).join(" "));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable");
await send("Page.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
const ev = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    return r.result?.result?.value;
};
const nav = async (url) => { await send("Page.navigate", { url }); await sleep(1500); };
/** Screenshot of the game window (clip to .win in the shadow root), or the full page. */
const shot = async (name, sel = ".win") => {
    const rect = await ev(`(() => { const r = document.querySelector('#hollowmarch-root')?.shadowRoot?.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; })()`);
    const params = { format: "png" };
    if (rect) params.clip = { ...rect, scale: 1 };
    const r = await send("Page.captureScreenshot", params);
    writeFileSync(join(out, name + ".png"), Buffer.from(r.result.data, "base64"));
};
/** Click inside the game's shadow root by selector (index picks among matches). */
const click = async (sel, i = 0, opts = {}) => ev(`(() => { const el = document.querySelector('#hollowmarch-root').shadowRoot.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!el) return false; el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: ${!!opts.shift} })); return true; })()`);
try {
    const mod = await import(pathToFileURL(resolve(process.argv[2])).href);
    await mod.default({ nav, ev, shot, sleep, click, send });
} catch (e) { console.error("SCRIPT ERROR", e); }
console.log(logs.length ? "PAGE LOGS:\n" + logs.join("\n") : "no page errors");
ws.close();
chrome.kill();
