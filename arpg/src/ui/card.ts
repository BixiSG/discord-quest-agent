// Launcher card for the Quest Agent panel (400 px wide). The game itself
// opens in its own window; the card only shows the last saved summary.

import { CLASSES, ZONES } from "../core/data";
import { fmtDuration, h } from "./dom";
import type { Summary } from "./app";

export interface CardApi {
    t(key: string, params?: Record<string, unknown>): string;
    theme(): string;
}

const CARD_CSS = `
:host { all: initial; display: block; }
.c { font: 13px/1.35 "Segoe UI", system-ui, sans-serif; color: #111; background: #fff4dc; border: 3px solid #111; box-shadow: 5px 5px 0 #111; margin: 8px 10px 14px 4px; }
.top { background: #ff5a36; border-bottom: 3px solid #111; padding: 6px 10px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; display: flex; justify-content: space-between; }
.in { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.hero { font-weight: 900; font-size: 16px; }
.muted { color: #5b5446; font-size: 12px; }
.xp { height: 10px; border: 2px solid #111; background: #fff; } .xp i { display: block; height: 100%; background: #ffc233; }
button { cursor: pointer; font: inherit; font-weight: 900; padding: 8px 12px; background: #ffc233; color: #111; border: 3px solid #111; box-shadow: 3px 3px 0 #111; text-transform: uppercase; }
button:hover { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 #111; }
button:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 #111; }
.dark .c { background: #2a2533; color: #f7f1e6; } .dark .muted { color: #bdb3a3; }
`;

export function mountCard(el: HTMLElement, api: CardApi, summary: Summary | null, isOpen: boolean, onOpen: () => void): { unmount(): void } {
    const holder = document.createElement("div");
    const root = holder.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CARD_CSS;
    root.append(style);
    const wrap = h("div", { class: api.theme() === "dark" ? "dark" : "" });
    const inner = h("div", { class: "in" });
    const c = h("div", { class: "c" }, h("div", { class: "top" }, h("span", { text: api.t("title") }), h("span", { text: "idle arpg" })), inner);
    if (summary) {
        const zone = ZONES[summary.zone]?.name ?? summary.zone;
        inner.append(
            h("div", { class: "hero", text: `${summary.name}` }),
            h("div", { class: "muted", text: api.t("card.line", { level: summary.level, cls: CLASSES[summary.cls]?.name ?? summary.cls, zone }) }),
            h("div", { class: "xp" }, h("i", { style: `width:${Math.round(summary.xpFrac * 100)}%` })),
            h("div", { class: "muted", text: api.t("card.away", { time: fmtDuration(Math.max(0, Date.now() - summary.savedAt)) }) }),
        );
    } else {
        inner.append(h("div", { text: api.t("card.new") }));
    }
    inner.append(h("button", { text: isOpen ? api.t("card.focus") : summary ? api.t("card.play") : api.t("card.start"), on: { click: onOpen } }));
    inner.append(h("div", { class: "muted", text: api.t("card.hint") }));
    wrap.append(c);
    root.append(wrap);
    el.append(holder);
    return { unmount() { holder.remove(); } };
}
