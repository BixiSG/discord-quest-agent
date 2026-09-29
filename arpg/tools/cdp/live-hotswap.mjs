// Deploys a Hollowmarch build to the running Discord without reloading it:
// saves the open game, then evaluates the built file in the discord.com page;
// the hub replaces the addon and the game reopens itself (the reopen flag).
//   node tools/cdp/live-hotswap.mjs ../src/addons/arpg.js
// Why not a reload: when the branch agent is not running, a reload lets the
// old installed agent inject instead (no addons). Check first with live-read.
import { readFileSync } from "node:fs";
const js = readFileSync(process.argv[2], "utf8");
if (/[^\x00-\x7f]/.test(js)) throw new Error("not ASCII");
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find(t => t.type === "page" && t.url.startsWith("https://discord.com"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", m => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
// Save first, so the new instance loads the latest state.
const pre = await send("Runtime.evaluate", { expression: "(async () => { const g = window.__hollowmarch?.game; if (g?.isOpen) await g.save(); return { open: !!g?.isOpen, mini: !!g?.isMini }; })()", awaitPromise: true, returnByValue: true });
console.log("before", pre.result?.result?.value);
const r = await send("Runtime.evaluate", { expression: js, returnByValue: false });
console.log(r.result?.exceptionDetails ? "EXCEPTION " + JSON.stringify(r.result.exceptionDetails).slice(0, 400) : "injected");
ws.close();
