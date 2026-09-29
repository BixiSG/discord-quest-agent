// The Log tab: the chronicle with its filters, and the echoes.

import { ECHOES, ECHO_ORDER } from "../core/data";
import { echoText, echoWho, pinName, logText } from "../i18n/names";
import { hint } from "./hints";
import { h } from "./dom";
import { glyph } from "./glyphs";
import { t } from "../i18n";
import { chips } from "./common";
import type { Ctx } from "./views";

const LOG_GLYPH: Record<string, Parameters<typeof glyph>[0]> = { level: "regen", loot: "gem", death: "chaos", zone: "world", boss: "atlas", info: "log" };

const LOG_KINDS: Record<string, string> = { level: "var(--gold)", loot: "var(--r-enchanted)", death: "var(--ember)", zone: "var(--teal)", boss: "var(--violet)", info: "var(--paper2)" };

let logFilter = "all";

export function logView(c: Ctx): HTMLElement {
    const log = c.state.log;
    const n = (k: string) => log.filter(e => e.kind === k).length;
    const filter = chips<string>([["all", t("log.all"), log.length], ...Object.keys(LOG_KINDS).filter(k => n(k)).map(k => [k, t(`logkind.${k}`), n(k)] as [string, string, number]),
        ["echoes", t("log.echoes"), c.state.echoes.length]],
        logFilter, v => { logFilter = v; c.rerender(); });
    const tip = c.state.echoes.length ? hint(c, "echoes") : null;
    if (logFilter === "echoes") return h("div", { class: "card log" }, h("h3", { text: t("log.title") }), h("div", { style: "margin-bottom:8px" }, filter), tip, echoesView(c));
    const el = h("div", { class: "card log" }, h("h3", { text: t("log.title") }), h("div", { style: "margin-bottom:8px" }, filter), tip);
    const now = Date.now();
    for (const e of [...log].reverse()) {
        if (logFilter !== "all" && e.kind !== logFilter) continue;
        const color = LOG_KINDS[e.kind] ?? "var(--paper2)";
        el.append(h("div", { class: `entry k-${e.kind}` }, h("span", { class: "lg", style: `background:${color}`, title: t(`logkind.${e.kind}`) }, glyph(LOG_GLYPH[e.kind] ?? "log", 14)), h("span", { class: "grow", text: logText(e) }),
            h("span", { class: "muted num when", text: e.t > 1e12 ? `${fmtAgo(now - e.t)}` : "" })));
    }
    return el;
}

/** The echoes: pages heard, in the order of the story; unheard ones say where they wait. */
function echoesView(c: Ctx): HTMLElement {
    const st = c.state;
    const box = h("div", { class: "col echoes", style: "gap:8px" },
        h("div", { class: "split row" }, h("b", { text: t("echoes.title") }), h("span", { class: "num", text: t("echoes.count", { n: st.echoes.length, total: ECHO_ORDER.length }) })),
        h("div", { class: "muted", style: "font-size:12px", text: t("echoes.note") }));
    for (const id of ECHO_ORDER) {
        const heard = st.echoes.includes(id);
        const pin = ECHOES[id]!.pinnacle;
        box.append(h("div", { class: `echo${heard ? "" : " unheard"}` },
            h("b", { text: heard ? echoWho(id) : pin ? pinName(pin) : "???" }),
            h("div", { class: heard ? "story" : "muted", text: heard ? echoText(id) : pin ? t("echoes.unknownPin", { pin: pinName(pin) }) : t("echoes.unknown") })));
    }
    return box;
}

function fmtAgo(ms: number): string {
    if (ms < 60e3) return t("ago.now");
    const m = Math.floor(ms / 60e3);
    if (m < 60) return t("ago.m", { n: m });
    const hh = Math.floor(m / 60);
    return hh < 48 ? t("ago.h", { n: hh }) : t("ago.d", { n: Math.floor(hh / 24) });
}
