// Read-only look at the live Discord client (CDP port 9222): is the game open,
// the agent version, and a copy of the hero's save in dev/out/live-save.json
// (feed it to an offline migration check before deploying a new save version).
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = join(dirname(fileURLToPath(import.meta.url)), "../../../dev/out");
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find(t => t.type === "page" && t.url.startsWith("https://discord.com"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", m => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const expr = `(async () => {
  const hm = window.__hollowmarch;
  const out = { hm: !!hm, open: !!hm?.game?.isOpen, mini: !!hm?.game?.isMini, agent: window.__questAgent?.version ?? null,
    addons: (() => { try { return window.__questAgent?.addons?.list?.() ?? null; } catch (e) { return String(e); } })() };
  const dbs = (await indexedDB.databases?.()) ?? [];
  if (!dbs.some(d => d.name === "hollowmarch")) return { ...out, save: null, note: "no db" };
  const db = await new Promise((res, rej) => { const r = indexedDB.open("hollowmarch"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const get = k => new Promise((res, rej) => { const r = db.transaction("saves", "readonly").objectStore("saves").get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const main = await get("main");
  db.close();
  return { ...out, save: main ? JSON.stringify(main) : null };
})()`;
const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
const v = r.result?.result?.value;
if (!v) { console.log(JSON.stringify(r).slice(0, 500)); process.exit(1); }
if (v.save) writeFileSync(join(here, "live-save.json"), v.save);
console.log({ ...v, save: v.save ? `${v.save.length} chars` : null });
ws.close();
