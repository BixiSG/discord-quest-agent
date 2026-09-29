// Passive tree view: a canvas with pan (drag) and zoom (wheel, buttons).
// Click a lit node to take it; click a taken node to see its refund.

import { ASCENDANCIES, KEYSTONE_TEXT, PASSIVES, type PassiveNode } from "../core/data";
import { allocate, ascPointsLeft, canAllocate, canRefund, chooseAscendancy, pointsLeft, refund, refundCost, takeAscNode } from "../core/passives";
import { h } from "./dom";
import { modText } from "./text";
import { textSprite } from "./gfx/pixfont";
import { pixelize } from "./gfx/pix";
import type { Ctx } from "./views";
import { t, tn } from "../i18n";
import { ascBlurb, ascName, ascNodeName, className, keystoneText, nodeName } from "../i18n/names";
import { tErr } from "../i18n/errors";

// Pan and zoom survive re-renders of the view.
const cam = { x: 0, y: 0, z: 0.55, centred: "" };
/** Background stars in tree space: [x, y, brightness]. Fixed seed, so the sky doesn't reshuffle. */
const STARS: [number, number, number][] = (() => {
    let seed = 7;
    const r = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    return Array.from({ length: 260 }, () => [r() * 3200 - 1600, r() * 2400 - 1200, r()] as [number, number, number]);
})();

const COLORS = { line: "#111111", taken: "#ffc233", open: "#ffffff", locked: "#9a917f", ring: "#19b3a3", keystone: "#ff5a36", notable: "#8b5cf6" };

export function treeView(c: Ctx): HTMLElement {
    const hero = c.state.hero;
    const canvas = h("canvas", { class: "treecv", style: "width:100%;height:460px;display:block;cursor:grab;touch-action:none" });
    // Node details float next to the node (hovered, or pinned by a click) instead of under the map.
    const info = h("div", { class: "card treepop", attrs: { hidden: "", role: "status" } });
    const wrap = h("div", { class: "treewrap" }, canvas, info);
    const pts = pointsLeft(hero);
    const head = h("div", { class: "row" },
        h("span", { class: `tag${pts > 0 ? " gold" : ""}`, text: tn("tree.left", pts) }),
        h("span", { class: "tag", text: t("tree.taken", { n: hero.passives.length }) }),
        h("span", { class: "muted", style: "font-size:12px", text: t("tree.help") }),
        h("span", { class: "grow" }),
        h("button", { class: "btn alt", text: "-", on: { click: () => zoom(0.8) } }),
        h("button", { class: "btn alt", text: "+", on: { click: () => zoom(1.25) } }),
        h("button", { class: "btn alt", text: t("tree.centre"), on: { click: () => { cam.centred = ""; centre(); draw(); } } }));

    const taken = new Set(hero.passives);
    const start = PASSIVES[`start_${hero.cls}`]!;
    const isOpen = (n: PassiveNode) => !taken.has(n.id) && n.kind !== "start" && n.links.some(l => l === start.id || taken.has(l));
    let hover: PassiveNode | null = null;
    let selected: PassiveNode | null = null;

    const centre = () => {
        if (cam.centred === hero.cls) return;
        cam.x = -start.x * 0.6; cam.y = -start.y * 0.6; cam.z = 0.55; cam.centred = hero.cls;
    };
    centre();

    const toScreen = (n: PassiveNode, w: number, hh: number): [number, number] => [w / 2 + (n.x + cam.x) * cam.z, hh / 2 + (n.y + cam.y) * cam.z];
    const radius = (n: PassiveNode) => (n.kind === "keystone" ? 16 : n.kind === "notable" ? 12 : n.kind === "start" ? 14 : 7) * Math.max(0.6, cam.z);

    function draw(): void {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth || 600, hh = canvas.clientHeight || 460;
        if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
        const g = canvas.getContext("2d")!;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.imageSmoothingEnabled = false;
        // Night sky: the tree is a constellation of embers. Stars drift at half the pan speed.
        g.fillStyle = "#120e0b"; g.fillRect(0, 0, w, hh);
        for (const [sx, sy, b] of STARS) {
            const x = Math.round(w / 2 + (sx + cam.x * 0.5) * cam.z * 0.8), y = Math.round(hh / 2 + (sy + cam.y * 0.5) * cam.z * 0.8);
            if (x < 0 || y < 0 || x > w || y > hh) continue;
            g.fillStyle = b > 0.8 ? "#fff0b8" : b > 0.5 ? "#8a7a64" : "#4a3d31";
            g.fillRect(x, y, b > 0.9 ? 2 : 1, b > 0.9 ? 2 : 1);
        }
        // Links: dark roads, lit ember-orange with a hot core where both ends are taken.
        for (const n of Object.values(PASSIVES)) {
            const [x1, y1] = toScreen(n, w, hh);
            for (const l of n.links) {
                if (l < n.id) continue;
                const m = PASSIVES[l]!;
                const [x2, y2] = toScreen(m, w, hh);
                const on = (taken.has(n.id) || n.id === start.id) && (taken.has(l) || l === start.id);
                g.lineCap = "square";
                g.strokeStyle = on ? "#ff5a36" : "#3a2f25"; g.lineWidth = on ? 6 : 4;
                g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
                if (on) { g.strokeStyle = "#ffc233"; g.lineWidth = 2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
            }
        }
        // Nodes: pixel gems (diamonds), bigger for notables and keystones.
        const gem = (x: number, y: number, r: number, fill: string, edge: string) => {
            r = Math.round(r); x = Math.round(x); y = Math.round(y);
            g.fillStyle = edge;
            for (let i = -r - 2; i <= r + 2; i++) { const span = r + 2 - Math.abs(i); g.fillRect(x - span, y + i, span * 2 + 1, 1); }
            g.fillStyle = fill;
            for (let i = -r; i <= r; i++) { const span = r - Math.abs(i); g.fillRect(x - span, y + i, span * 2 + 1, 1); }
            g.fillStyle = "rgba(255,255,255,.55)";
            g.fillRect(x - Math.round(r / 2), y - Math.round(r / 2), Math.max(1, Math.round(r / 3)), Math.max(1, Math.round(r / 3)));
        };
        for (const n of Object.values(PASSIVES)) {
            const [x, y] = toScreen(n, w, hh);
            if (x < -30 || y < -30 || x > w + 30 || y > hh + 30) continue;
            const r = radius(n);
            const own = taken.has(n.id) || n.id === start.id;
            const open = isOpen(n);
            let fill = own ? "#ffc233" : open ? "#f3e7d3" : "#4a3d31";
            if (n.kind === "keystone") fill = own ? "#ff5a36" : open ? "#ffb3a3" : "#5a3328";
            if (n.kind === "notable" && !own) fill = open ? "#c9b6ff" : "#3d3052";
            if (open && !own) gem(x, y, r + 3, "rgba(255,194,51,.25)", "rgba(255,194,51,.12)");
            gem(x, y, r, fill, "#000000");
            if (n.kind === "ring" && !own) { g.fillStyle = "#19b3a3"; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
            if (n.kind === "start") gem(x, y, r * 0.5, n.cls === hero.cls ? "#ff5a36" : "#6b5d4b", "#000000");
            if (n === hover || n === selected) { g.strokeStyle = "#ff5a36"; g.lineWidth = 2; g.strokeRect(Math.round(x - r - 6), Math.round(y - r - 6), Math.round(2 * r + 12), Math.round(2 * r + 12)); }
            if ((n.kind === "notable" || n.kind === "keystone" || n.kind === "start") && cam.z > 0.45) {
                const label = (n.kind === "start" ? (n.cls ? className(n.cls) : "") : nodeName(n)).toUpperCase();
                const t = textSprite(label, own ? "#ffc233" : "#e6d9b8", "#000000");
                g.drawImage(t, Math.round(x - t.width), Math.round(y + r + 6), t.width * 2, t.height * 2);
            }
        }
    }

    function showInfo(n: PassiveNode | null): void {
        info.replaceChildren();
        info.hidden = !n;
        if (!n) return;
        const pinned = n === selected;
        info.classList.toggle("pinned", pinned);
        const own = taken.has(n.id);
        const name = n.kind === "start" && n.cls ? `${nodeName(n)} - ${className(n.cls)}` : nodeName(n);
        info.append(h("h3", { text: n.kind === "notable" ? t("tree.notable", { name }) : n.kind === "keystone" ? t("tree.keystone", { name }) : name }));
        for (const m of n.mods) info.append(h("div", { text: modText(m) }));
        if (n.kind === "keystone" && KEYSTONE_TEXT[n.name]) info.append(h("div", { class: "muted", style: "font-style:italic", text: keystoneText(n.name) }));
        if (n.kind === "start") info.append(h("div", { class: "muted", text: n.cls === hero.cls ? t("tree.yourSeat") : t("tree.otherSeat") }));
        const row = h("div", { class: "row", style: "margin-top:6px" });
        if (own) {
            const ok = canRefund(hero, n.id), cost = refundCost(hero), afford = c.state.dust >= cost;
            row.append(h("button", { class: "btn alt", text: t("tree.refund", { n: cost }), attrs: ok && afford ? {} : { disabled: "" }, title: !ok ? t("tree.depends") : afford ? "" : tErr(`needs ${cost} ember dust`),
                on: { click: () => c.act(s => refund(s, n.id)) } }));
        } else if (n.kind !== "start") {
            const err = canAllocate(hero, n.id);
            row.append(h("button", { class: "btn", text: t("tree.take"), attrs: err ? { disabled: "" } : {}, title: err ? tErr(err) : "", on: { click: () => c.act(s => allocate(s, n.id)) } }));
            if (err) row.append(h("span", { class: "muted", text: tErr(err) }));
        }
        if (pinned) info.append(row);
        else if (!own && n.kind !== "start") { const e = canAllocate(hero, n.id); info.append(h("div", { class: "muted", style: "margin-top:4px;font-size:12px", text: e ? tErr(e) : t("tree.clickTake") })); }
        else if (own) info.append(h("div", { class: "muted", style: "margin-top:4px;font-size:12px", text: t("tree.clickPin") }));
        pixelize(info);
        place(n);
    }

    /** Beside the node, on whichever side has room, inside the map. */
    function place(n: PassiveNode): void {
        const w = canvas.clientWidth, hh = canvas.clientHeight;
        const [x, y] = toScreen(n, w, hh);
        const r = radius(n) + 14, bw = info.offsetWidth, bh = info.offsetHeight, pad = canvas.clientLeft + 6;
        let left = x + r + pad;
        if (left + bw > w - 4) left = x - r - bw + pad;
        left = Math.max(pad, Math.min(left, w - bw));
        const top = Math.max(pad, Math.min(y - bh / 2 + pad, hh - bh));
        info.style.left = Math.round(left) + "px"; info.style.top = Math.round(top) + "px";
    }

    const pick = (ev: PointerEvent | MouseEvent): PassiveNode | null => {
        // The canvas has a framed border: measure from its content box.
        const rect = canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left - canvas.clientLeft, my = ev.clientY - rect.top - canvas.clientTop;
        let best: PassiveNode | null = null, bd = Infinity;
        for (const n of Object.values(PASSIVES)) {
            const [x, y] = toScreen(n, canvas.clientWidth, canvas.clientHeight);
            const d = Math.hypot(x - mx, y - my);
            if (d < radius(n) + 6 && d < bd) { best = n; bd = d; }
        }
        return best;
    };

    let drag: { x: number; y: number; moved: number } | null = null;
    canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; });
    canvas.addEventListener("pointermove", e => {
        if (drag) {
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            drag.moved += Math.abs(dx) + Math.abs(dy);
            cam.x += dx / cam.z; cam.y += dy / cam.z;
            drag.x = e.clientX; drag.y = e.clientY;
            draw();
            const shown = hover ?? selected;
            if (shown && !info.hidden) place(shown);
            return;
        }
        const n = pick(e);
        if (n !== hover) { hover = n; showInfo(n ?? selected); draw(); canvas.style.cursor = n ? "pointer" : "grab"; }
    });
    canvas.addEventListener("pointerup", e => {
        const wasClick = drag && drag.moved < 6;
        drag = null; canvas.style.cursor = "grab";
        if (!wasClick) return;
        const n = pick(e);
        selected = n;
        if (n && isOpen(n) && !canAllocate(hero, n.id)) { c.act(s => allocate(s, n.id)); return; }
        showInfo(n); draw();
    });
    canvas.addEventListener("pointerleave", () => { if (!drag && hover) { hover = null; showInfo(selected); draw(); } });
    canvas.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 0.89); }, { passive: false });
    function zoom(f: number): void { cam.z = Math.max(0.25, Math.min(1.6, cam.z * f)); draw(); const n = hover ?? selected; if (n && !info.hidden) place(n); }

    showInfo(null);
    const asc = ascCard(c);
    // The map takes the height the tab has (at least 320px); drawn once it is in the document.
    const fitHeight = () => {
        const body = canvas.closest(".body") as HTMLElement | null;
        if (!body) return;
        const want = Math.max(320, Math.round(body.clientHeight - head.offsetHeight - 44));
        if (Math.abs(canvas.clientHeight - want) > 2) canvas.style.height = want + "px";
        draw();
    };
    requestAnimationFrame(() => {
        fitHeight();
        const body = canvas.closest(".body");
        if (!body) return;
        const ro = new ResizeObserver(() => { if (!canvas.isConnected) { ro.disconnect(); return; } fitHeight(); });
        ro.observe(body);
    });
    return h("div", { class: "col" }, head, wrap, asc);
}

function ascCard(c: Ctx): HTMLElement {
    const hero = c.state.hero;
    const card = h("div", { class: "card col" });
    const left = ascPointsLeft(hero);
    card.append(h("h3", { text: hero.asc && ASCENDANCIES[hero.asc] ? tn("asc.titleNamed", left, { name: ascName(hero.asc) }) : tn("asc.title", left) }));
    if (!hero.asc) {
        card.append(h("div", { class: "muted", text: hero.ascPoints > 0 ? t("asc.choose") : t("asc.earn") }));
        const row = h("div", { class: "grid2" });
        for (const a of Object.values(ASCENDANCIES).filter(x => x.cls === hero.cls)) {
            row.append(h("div", { class: "skill" },
                h("span", { style: `flex:none;width:12px;align-self:stretch;background:${a.color};border:2px solid #1a1410` }),
                h("div", { class: "grow" }, h("div", { class: "nm", text: ascName(a.id) }), h("div", { class: "ds", text: ascBlurb(a.id) }),
                    ...a.nodes.map(n => h("div", { class: "ds muted", text: t("asc.node", { name: ascNodeName(n.id), mods: n.mods.map(m => modText(m)).join(t("common.list")) }) })),
                    h("button", { class: "btn", style: "margin-top:6px", text: t("asc.become", { name: ascName(a.id) }), attrs: hero.ascPoints > 0 ? {} : { disabled: "" },
                        on: { click: () => c.act(s => chooseAscendancy(s, a.id)) } }))));
        }
        card.append(row);
        return card;
    }
    const a = ASCENDANCIES[hero.asc]!;
    const grid = h("div", { class: "grid2" });
    for (const n of a.nodes) {
        const own = hero.ascNodes.includes(n.id);
        grid.append(h("div", { class: `skill${own ? " on" : ""}`, on: { click: () => { if (!own) c.act(s => takeAscNode(s, n.id)); } } },
            h("div", { class: "grow" }, h("div", { class: "nm", text: ascNodeName(n.id) }), ...n.mods.map(md => h("div", { class: "ds", text: modText(md) }))),
            h("div", { class: "tag", text: own ? t("asc.taken") : left > 0 ? t("asc.take") : t("asc.locked") })));
    }
    card.append(grid);
    return card;
}
