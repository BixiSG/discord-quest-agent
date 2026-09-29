// Passive tree view: a canvas with pan (drag) and zoom (wheel, buttons).
// Click a lit node to take it; click a taken node to see its refund.

import { ASCENDANCIES, KEYSTONE_TEXT, PASSIVES, type PassiveNode } from "../core/data";
import { allocate, ascPointsLeft, canAllocate, canRefund, chooseAscendancy, pointsLeft, refund, refundCost, takeAscNode } from "../core/passives";
import { h } from "./dom";
import { modText } from "./text";
import type { Ctx } from "./views";

// Pan and zoom survive re-renders of the view.
const cam = { x: 0, y: 0, z: 0.55, centred: "" };

const COLORS = { line: "#111111", taken: "#ffc233", open: "#ffffff", locked: "#9a917f", ring: "#19b3a3", keystone: "#ff5a36", notable: "#8b5cf6" };

export function treeView(c: Ctx): HTMLElement {
    const hero = c.state.hero;
    const canvas = h("canvas", { style: "width:100%;height:460px;display:block;cursor:grab;background:#fff4dc;border:3px solid #111;touch-action:none" });
    const info = h("div", { class: "card", style: "min-height:92px" });
    const pts = pointsLeft(hero);
    const head = h("div", { class: "row" },
        h("span", { class: "tag", style: pts > 0 ? "background:var(--gold)" : "", text: `${pts} point${pts === 1 ? "" : "s"} left` }),
        h("span", { class: "tag", text: `${hero.passives.length} taken` }),
        h("span", { class: "muted", style: "font-size:11px", text: "Drag to pan, wheel to zoom. Lit nodes can be taken." }),
        h("span", { class: "grow" }),
        h("button", { class: "btn alt", text: "-", on: { click: () => zoom(0.8) } }),
        h("button", { class: "btn alt", text: "+", on: { click: () => zoom(1.25) } }),
        h("button", { class: "btn alt", text: "Centre", on: { click: () => { cam.centred = ""; centre(); draw(); } } }));

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
        g.fillStyle = "#fff4dc"; g.fillRect(0, 0, w, hh);
        // Links.
        for (const n of Object.values(PASSIVES)) {
            const [x1, y1] = toScreen(n, w, hh);
            for (const l of n.links) {
                if (l < n.id) continue;
                const m = PASSIVES[l]!;
                const [x2, y2] = toScreen(m, w, hh);
                const on = (taken.has(n.id) || n.id === start.id) && (taken.has(l) || l === start.id);
                g.strokeStyle = on ? "#ff5a36" : "#b9ad95";
                g.lineWidth = on ? 5 : 3;
                g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
            }
        }
        // Nodes.
        for (const n of Object.values(PASSIVES)) {
            const [x, y] = toScreen(n, w, hh);
            if (x < -30 || y < -30 || x > w + 30 || y > hh + 30) continue;
            const r = radius(n);
            const own = taken.has(n.id) || n.id === start.id;
            const open = isOpen(n);
            let fill: string = own ? COLORS.taken : open ? COLORS.open : COLORS.locked;
            if (!own && n.kind === "keystone") fill = open ? "#ffb3a3" : "#c98b7f";
            g.fillStyle = COLORS.line;
            if (n.kind === "notable" || n.kind === "keystone") { g.fillRect(x - r - 2, y - r - 2, 2 * r + 4, 2 * r + 4); g.fillStyle = fill; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
            else { g.beginPath(); g.arc(x, y, r + 2, 0, Math.PI * 2); g.fill(); g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
            if (n.kind === "ring" && !own) { g.fillStyle = COLORS.ring; g.beginPath(); g.arc(x, y, r * 0.45, 0, Math.PI * 2); g.fill(); }
            if (n.kind === "start") {
                g.fillStyle = n.cls === hero.cls ? "#ff5a36" : "#9a917f";
                g.beginPath(); g.arc(x, y, r * 0.55, 0, Math.PI * 2); g.fill();
            }
            if (n === hover || n === selected) { g.strokeStyle = "#ff5a36"; g.lineWidth = 3; g.strokeRect(x - r - 5, y - r - 5, 2 * r + 10, 2 * r + 10); }
            if ((n.kind === "notable" || n.kind === "keystone" || n.kind === "start") && cam.z > 0.45) {
                g.font = "bold 11px Segoe UI, sans-serif"; g.textAlign = "center";
                const label = n.kind === "start" ? (n.cls ?? "").toUpperCase() : n.name;
                g.fillStyle = "#fff4dc"; g.fillText(label, x + 1, y + r + 15);
                g.fillStyle = "#111"; g.fillText(label, x, y + r + 14);
            }
        }
    }

    function showInfo(n: PassiveNode | null): void {
        info.replaceChildren();
        if (!n) { info.append(h("div", { class: "muted", text: "Hover a node to read it." })); return; }
        const own = taken.has(n.id);
        info.append(h("h3", { text: `${n.name}${n.kind === "notable" ? " (notable)" : n.kind === "keystone" ? " (keystone)" : ""}` }));
        for (const m of n.mods) info.append(h("div", { text: modText(m) }));
        if (n.kind === "keystone" && KEYSTONE_TEXT[n.name]) info.append(h("div", { class: "muted", style: "font-style:italic", text: KEYSTONE_TEXT[n.name]! }));
        if (n.kind === "start") info.append(h("div", { class: "muted", text: n.cls === hero.cls ? "Your ember seat." : "Another calling starts here." }));
        const row = h("div", { class: "row", style: "margin-top:6px" });
        if (own) {
            const ok = canRefund(hero, n.id);
            row.append(h("button", { class: "btn alt", text: `Refund (${refundCost(hero)} dust)`, attrs: ok ? {} : { disabled: "" }, title: ok ? "" : "Other taken nodes depend on it",
                on: { click: () => c.act(s => refund(s, n.id)) } }));
        } else if (n.kind !== "start") {
            const err = canAllocate(hero, n.id);
            row.append(h("button", { class: "btn", text: "Take", attrs: err ? { disabled: "" } : {}, title: err ?? "", on: { click: () => c.act(s => allocate(s, n.id)) } }));
            if (err) row.append(h("span", { class: "muted", text: err }));
        }
        info.append(row);
    }

    const pick = (ev: PointerEvent | MouseEvent): PassiveNode | null => {
        const rect = canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
        let best: PassiveNode | null = null, bd = Infinity;
        for (const n of Object.values(PASSIVES)) {
            const [x, y] = toScreen(n, rect.width, rect.height);
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
    canvas.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 0.89); }, { passive: false });
    function zoom(f: number): void { cam.z = Math.max(0.25, Math.min(1.6, cam.z * f)); draw(); }

    showInfo(null);
    const asc = ascCard(c);
    // Draw once the canvas is in the document and has a size.
    requestAnimationFrame(draw);
    return h("div", { class: "col" }, head, canvas, info, asc);
}

function ascCard(c: Ctx): HTMLElement {
    const hero = c.state.hero;
    const card = h("div", { class: "card col" });
    const left = ascPointsLeft(hero);
    card.append(h("h3", { text: `Ascendancy${hero.asc ? `: ${ASCENDANCIES[hero.asc]!.name}` : ""} (${left} point${left === 1 ? "" : "s"} left)` }));
    if (!hero.asc) {
        card.append(h("div", { class: "muted", text: hero.ascPoints > 0 ? "Choose your path. This is permanent for this hero." : "Pass a Trial (the first opens in Act 1 after the Sunken Chapel) to earn ascendancy points." }));
        const row = h("div", { class: "grid2" });
        for (const a of Object.values(ASCENDANCIES).filter(x => x.cls === hero.cls)) {
            row.append(h("div", { class: "skill", style: `border-left:10px solid ${a.color}` },
                h("div", { class: "grow" }, h("div", { class: "nm", text: a.name }), h("div", { class: "ds", text: a.blurb }),
                    ...a.nodes.map(n => h("div", { class: "ds muted", text: `${n.name}: ${n.mods.map(modText).join(", ")}` })),
                    h("button", { class: "btn", style: "margin-top:6px", text: `Become ${a.name}`, attrs: hero.ascPoints > 0 ? {} : { disabled: "" },
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
            h("div", { class: "grow" }, h("div", { class: "nm", text: n.name }), ...n.mods.map(md => h("div", { class: "ds", text: modText(md) }))),
            h("div", { class: "tag", text: own ? "taken" : left > 0 ? "take" : "locked" })));
    }
    card.append(grid);
    return card;
}
