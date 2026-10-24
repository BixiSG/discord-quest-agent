// Renders the README / social images with a headless Chrome over CDP.
//   1. python dev/serve.py                      (serves the repo on :8765)
//   2. chrome --headless=new --remote-debugging-port=9339 --mute-audio --user-data-dir=<tmp>
//   3. node dev/promo/shoot.mjs [hud|promo|all]
// "hud" captures the panel from dev/harness.html into docs/*.png; "promo" renders
// dev/promo/*.html (which embed those captures) into docs/banner.png and docs/social-preview.png.
import { writeFileSync } from "node:fs";

const CDP = "http://127.0.0.1:9339", BASE = "http://127.0.0.1:8765";
const what = process.argv[2] ?? "all";

async function session() {
    const tab = await (await fetch(CDP + "/json/new?about:blank", { method: "PUT" })).json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
    let id = 0;
    const pending = new Map(), waiters = [];
    ws.onmessage = m => {
        const msg = JSON.parse(m.data);
        if (msg.id && pending.has(msg.id)) { const [ok, fail] = pending.get(msg.id); pending.delete(msg.id); msg.error ? fail(new Error(msg.error.message)) : ok(msg.result); }
        else for (const w of waiters.splice(0)) w(msg);
    };
    const send = (method, params = {}) => new Promise((ok, fail) => { pending.set(++id, [ok, fail]); ws.send(JSON.stringify({ id, method, params })); });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const evaluate = async expr => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
    return {
        send, evaluate, sleep,
        async open(url, w, h, scale = 2) {
            await send("Page.enable");
            await send("Network.setCacheDisabled", { cacheDisabled: true });
            await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: scale, mobile: false });
            await send("Page.navigate", { url });
            await sleep(600);
            await evaluate("document.fonts ? document.fonts.ready.then(() => true) : true");
        },
        async shot(file, clip) {
            const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
            writeFileSync(file, Buffer.from(r.data, "base64"));
            console.log("wrote", file);
        },
        async rect(sel) {
            return evaluate(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
        },
        close: () => { ws.close(); return fetch(CDP + "/json/close/" + tab.id); }
    };
}

/** The panel after the harness has settled; the open animation is skipped. */
async function panel(s, query, w = 900, h = 1000) {
    await s.open(`${BASE}/dev/harness.html?${query}`, w, h);
    await s.sleep(3500);
    // Transparent page behind the panel, so its rounded corners stay clean.
    await s.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    await s.evaluate(`(() => { const st = document.createElement("style"); st.textContent = "body{background:transparent!important}#qb-panel{animation:none!important;top:16px!important;right:16px!important;left:auto!important}"; document.head.appendChild(st); })()`);
}
const pad = (r, p) => ({ x: r.x - p, y: r.y - p, width: r.width + 2 * p, height: r.height + 2 * p });

async function hud() {
    const s = await session();
    // Quests, hovering the first ready-to-claim row so its Claim / Dismiss buttons show.
    await panel(s, "reset=1");
    await s.evaluate("__questAgent.ui.toggle(true)");
    await s.sleep(500);
    const row = await s.rect("#qb-panel .qb-row");
    await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: row.x + row.width / 2, y: row.y + row.height / 2 });
    await s.sleep(400);
    await s.shot("docs/panel.png", await s.rect("#qb-panel"));
    // Stats and Settings (a tall viewport so Settings needs no scrolling).
    await panel(s, "view=stats");
    await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 900 });
    await s.shot("docs/stats.png", await s.rect("#qb-panel"));
    await panel(s, "view=settings", 900, 1950);
    await s.shot("docs/settings.png", await s.rect("#qb-panel"));
    // The title-bar button with its badge, on the mock title bar.
    await panel(s, "", 600, 300);
    await s.evaluate(`document.body.style.setProperty("background", "#313338", "important")`);
    await s.shot("docs/button.png", pad(await s.rect(".trailing_x1"), 10));
    await s.close();
}

async function promo() {
    const s = await session();
    await s.open(`${BASE}/dev/promo/banner.html`, 1280, 560, 1.5); // 1.5x: sharp on HiDPI, under 1 MB
    await s.sleep(800);
    await s.shot("docs/banner.png");
    // GitHub's social card: 1280 x 640, kept at 1x so it stays well under 1 MB.
    await s.open(`${BASE}/dev/promo/social.html`, 1280, 640, 1);
    await s.sleep(800);
    await s.shot("docs/social-preview.png");
    await s.close();
}

if (what === "hud" || what === "all") await hud();
if (what === "promo" || what === "all") await promo();
