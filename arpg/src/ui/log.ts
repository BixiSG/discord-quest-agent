// The Log tab: the chronicle with its filters, and the echoes.

import { ECHOES, ECHO_ORDER, FEATS, FEAT_GROUPS, FEAT_ORDER, RENOWN_DAMAGE, RENOWN_LIFE, type FeatGroup } from "../core/data";
import { featProgress, renownOf, setTitle } from "../core/feats";
import type { GameState } from "../core/state";
import { echoText, echoWho, featName, featText, pinName, logText } from "../i18n/names";
import { hint } from "./hints";
import { fmt, h } from "./dom";
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
        ["echoes", t("log.echoes"), c.state.echoes.length], ["feats", t("log.feats"), c.state.feats.length]],
        logFilter, v => { logFilter = v; c.rerender(); });
    const tip = c.state.echoes.length ? hint(c, "echoes") : null;
    if (logFilter === "echoes") return h("div", { class: "card log" }, h("h3", { text: t("log.title") }), h("div", { style: "margin-bottom:8px" }, filter), tip, echoesView(c));
    if (logFilter === "feats") return h("div", { class: "card log" }, h("h3", { text: t("log.title") }), h("div", { style: "margin-bottom:8px" }, filter), featsView(c));
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

/** What the Log view shows changes with: the chronicle, echoes, feats (and, on the Feats chip, their progress). */
export function logSig(s: GameState): string {
    const base = `${s.log.length}:${s.log[s.log.length - 1]?.t ?? 0}:${s.echoes.length}:${s.feats.length}:${s.title ?? ""}`;
    return logFilter === "feats" ? `${base}:${FEAT_ORDER.map(id => Math.floor((featProgress(s, id) / Math.max(1, FEATS[id]!.goal)) * 100)).join(",")}` : base;
}

const GROUP_GLYPH: Record<FeatGroup, Parameters<typeof glyph>[0]> = { road: "world", hunt: "skills", collect: "gem", forge: "forge", depths: "atlas" };

/** Feats by group: done or how far along, the renown each pays, and the titles to wear. */
function featsView(c: Ctx): HTMLElement {
    const st = c.state;
    const renown = renownOf(st.feats);
    const box = h("div", { class: "col feats", style: "gap:10px" },
        h("div", { class: "split row" }, h("b", { text: t("feats.title") }), h("span", { class: "num", text: t("feats.count", { n: st.feats.length, total: FEAT_ORDER.length }) })),
        h("div", { class: "muted", style: "font-size:12px", text: t("feats.note") }),
        h("div", { class: "renown" }, glyph("sun", 16), h("b", { class: "grow", text: t("feats.renown", { n: renown, dmg: RENOWN_DAMAGE * renown, life: RENOWN_LIFE * renown }) })),
        h("div", { class: "row", style: "gap:8px" }, h("span", { class: "tag dawn", text: st.title ? t("feats.wearing", { name: featName(st.title) }) : t("feats.noTitle") }),
            st.title ? h("button", { class: "btn alt small", text: t("feats.takeOff"), on: { click: () => c.act(s => setTitle(s, null)) } }) : null));
    for (const g of FEAT_GROUPS) {
        const rows = h("div", { class: "contracts" });
        for (const id of FEAT_ORDER.filter(x => FEATS[x]!.group === g)) {
            const def = FEATS[id]!;
            const done = st.feats.includes(id);
            const p = featProgress(st, id);
            const worn = st.title === id;
            rows.append(h("div", { class: `contract feat${done ? " done" : ""}` },
                h("span", { class: "cg" }, glyph(GROUP_GLYPH[g], 16)),
                h("div", { class: "grow col", style: "gap:3px;min-width:0" },
                    h("div", { class: "row", style: "gap:6px;flex-wrap:wrap" }, h("b", { text: featName(id) }),
                        def.title ? h("span", { class: "tag", text: t("feats.titleTag") }) : null,
                        h("span", { class: "tag", text: t("feats.pill", { n: def.renown }) })),
                    h("span", { class: "muted", style: "font-size:12px", text: featText(id) }),
                    !done && def.goal > 1 ? h("div", { class: "meter" }, h("i", { style: `width:${Math.min(100, (p / def.goal) * 100).toFixed(1)}%` }), h("span", { class: "num", text: `${fmt(p)} / ${fmt(def.goal)}` })) : null),
                done && def.title ? (worn ? h("span", { class: "tag dawn", text: t("feats.worn") })
                    : h("button", { class: "btn small", text: t("feats.wear"), on: { click: () => c.act(s => setTitle(s, id), t("feats.wearing", { name: featName(id) })) } })) : null));
        }
        box.append(h("div", { class: "sec", text: t(`feats.group.${g}`) }), rows);
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
