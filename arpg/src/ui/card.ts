// Launcher card for the Quest Agent panel (400 px wide). The game itself
// opens in its own window; the card shows the last saved summary in the
// game's own look (pixel frames and type, the hero in their scenery) and
// what the window is doing: closed, open, or folded into the mini strip.

import { CLASSES, ZONES } from "../core/data";
import { CSS } from "./css";
import { fmtDuration, h } from "./dom";
import { frameVars } from "./gfx/frames";
import { pixelize } from "./gfx/pix";
import { portrait, scenery } from "./gfx/portrait";
import { loadSprites } from "./gfx/sprites";
import { installTips } from "./tips";
import { loadPixelFont } from "./gfx/webfont";
import type { Summary } from "./app";

export interface CardApi {
    t(key: string, params?: Record<string, unknown>): string;
    theme(): string;
}

/** What the game window is doing. */
export type CardStatus = "closed" | "open" | "mini";

export interface CardActions {
    /** Opens the game, or brings an open window forward. */
    open(): void;
    /** Folds the open window into the strip, or back. */
    mini(on: boolean): void;
}

const CARD_CSS = `
:host { display: block; }
.hc { position: relative; margin: 8px 10px 14px 4px; border: 3px solid var(--line); background: var(--paper); box-shadow: 5px 5px 0 var(--line); }
.hc .bar { height: 30px; cursor: default; padding-right: 8px; }
.hc .logo { font-size: 16px; }
.hc .state { margin-left: auto; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.hc .state.live { padding: 3px 6px; background: #1a1410; color: #19b3a3; }
.hc .in { display: flex; flex-direction: column; gap: 10px; padding: 10px; }
.hc .chero { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: start; overflow: visible; white-space: normal; }
.hc .pic { line-height: 0; border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; }
.hc .pic canvas { image-rendering: pixelated; width: 176px; height: 132px; display: block; }
.hc .facts { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.hc .name { font: 700 16px/1.05 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; overflow-wrap: anywhere; }
.hc .facts .muted { font-size: 12px; }
.hc .xpbar { margin: 2px 0 0; }
.hc .xpl { font: 700 8px/1 var(--mono); color: var(--muted); }
.hc .acts { display: flex; gap: 8px; flex-wrap: wrap; }
.hc .acts .btn { flex: 1 1 auto; }
.hc .hint { font-size: 12px; color: var(--muted); }
.hc.new .chero { grid-template-columns: 1fr; }
.hc.new .pic canvas { width: 100%; height: auto; aspect-ratio: 4 / 3; }
`;

export function mountCard(el: HTMLElement, api: CardApi, summary: Summary | null, status: CardStatus, act: CardActions): { unmount(): void } {
    void loadPixelFont();
    const holder = document.createElement("div");
    const root = holder.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS + CARD_CSS;
    root.append(style);
    const dark = api.theme() === "dark";
    const wrap = h("div", { class: `hm${dark ? " dark" : ""}` });
    for (const [k, v] of Object.entries(frameVars(dark))) wrap.style.setProperty(k, v);

    const stateText = status === "open" ? api.t("card.stateOpen") : status === "mini" ? api.t("card.stateMini") : "";
    const bar = h("div", { class: "bar" }, h("span", { class: "logo", text: api.t("title") }),
        stateText ? h("span", { class: "state live", text: stateText }) : h("span", { class: "state", text: "idle arpg" }));
    const inner = h("div", { class: "in" });
    const card = h("div", { class: `hc${summary ? "" : " new"}` }, bar, inner);

    // The picture: the hero where they were last seen, or the first shore for a new game.
    const pic = h("div", { class: "pic" });
    const paint = () => {
        let c: HTMLCanvasElement;
        if (summary) {
            const z = (summary.zoneId && ZONES[summary.zoneId]) || { id: summary.zoneId ?? "", name: summary.zone, palette: [summary.sky ?? "#1a1410", "#111", "#111"] as [string, string, string] };
            c = portrait(z, summary.cls, 88, 66);
        } else c = scenery(ZONES.a1_shore!, 120, 90);
        c.setAttribute("aria-hidden", "true");
        pic.replaceChildren(c);
    };
    paint();
    void loadSprites().then(() => { if (holder.isConnected) paint(); });

    if (summary) {
        const zone = ZONES[summary.zone]?.name ?? summary.zone;
        const xp = Math.max(0, Math.min(1, summary.xpFrac));
        const seen = status === "closed" ? api.t("card.away", { time: fmtDuration(Math.max(0, Date.now() - summary.savedAt)) }) : status === "mini" ? api.t("card.inMini") : api.t("card.inWindow");
        inner.append(h("div", { class: "chero" }, pic, h("div", { class: "facts" },
            h("div", { class: "name", text: summary.name }),
            h("div", { class: "muted", text: api.t("card.line", { level: summary.level, cls: CLASSES[summary.cls]?.name ?? summary.cls, zone }) }),
            h("div", { class: "xpbar", title: `${(xp * 100).toFixed(1)}%` }, h("i", { style: `width:${(xp * 100).toFixed(1)}%` })),
            h("div", { class: "xpl", text: `${(xp * 100).toFixed(0)}% XP` }),
            h("div", { class: "muted", text: seen }))));
    } else {
        inner.append(h("div", { class: "chero" }, pic, h("div", { class: "story", text: api.t("card.new") })));
    }

    const acts = h("div", { class: "acts" });
    if (status === "closed") acts.append(h("button", { class: "btn hot", text: summary ? api.t("card.play") : api.t("card.start"), on: { click: () => act.open() } }));
    else if (status === "open") acts.append(
        h("button", { class: "btn", text: api.t("card.show"), on: { click: () => act.open() } }),
        h("button", { class: "btn alt", text: api.t("card.fold"), on: { click: () => act.mini(true) } }));
    else acts.append(h("button", { class: "btn", text: api.t("card.unfold"), on: { click: () => act.mini(false) } }));
    inner.append(acts, h("div", { class: "hint", text: status === "closed" ? api.t("card.hint") : api.t("card.hintOpen") }));

    wrap.append(card);
    root.append(wrap);
    el.append(holder);
    pixelize(card);
    installTips(card, card);
    return { unmount() { holder.remove(); } };
}
