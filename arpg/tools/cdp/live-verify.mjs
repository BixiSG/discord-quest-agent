// Polls the live Discord page (up to ~75 s) until the agent and the game are
// back after a deploy; prints the agent version, the game's state and the
// saved envelope's version.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const expr = `(async () => {
  const hm = window.__hollowmarch, g = hm?.game;
  const s = g?.state ?? g?.ctx?.state;
  let saved = null;
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open("hollowmarch"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const main = await new Promise((res, rej) => { const r = db.transaction("saves", "readonly").objectStore("saves").get("main"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
    saved = main ? { v: main.v, level: main.state?.hero?.level, relics: main.state?.relics?.length ?? null, contracts: main.state?.contracts?.list?.length ?? null } : null;
  } catch (e) { saved = String(e); }
  return { agent: window.__questAgent?.version ?? null, status: window.__questAgent?.status ?? null, addons: window.__questAgent?.addons?.list?.() ?? null,
    gameOpen: !!g?.isOpen, mini: !!g?.isMini, live: s ? { level: s.hero.level, stash: s.stash.length + "/" + s.stashCap, relics: s.relics?.length, codex: Object.keys(s.codex ?? {}).length, contracts: s.contracts?.list?.map(c => c.kind + " " + c.n + "/" + c.target) } : null,
    saved, errors: (window.__qaErrs ?? []).length };
})()`;
for (let i = 0; i < 25; i++) {
  await sleep(3000);
  let targets; try { targets = await (await fetch("http://127.0.0.1:9222/json")).json(); } catch { continue; }
  const page = targets.find(t => t.type === "page" && t.url.startsWith("https://discord.com"));
  if (!page) continue;
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const ok = await new Promise(r => { ws.addEventListener("open", () => r(true)); ws.addEventListener("error", () => r(false)); });
  if (!ok) continue;
  const v = await new Promise(res => { ws.addEventListener("message", m => res(JSON.parse(m.data).result?.result?.value)); ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true, returnByValue: true } })); });
  ws.close();
  console.log(i * 3 + 3 + "s", JSON.stringify(v));
  if (v?.gameOpen && v?.live) break;
}
